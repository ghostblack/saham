import { NextResponse } from 'next/server';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike, checkTurnaround, checkSwingMingguan } from '@/lib/screener';
import { calculateMultipleSMAs, calculateMACD } from '@/lib/indicators';
import { IDX_TICKERS } from '@/lib/tickers';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// In-memory cache for screening results keyed by strategy
let cache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_DURATION = 15 * 60 * 1000;

const SMA_PERIODS = [5, 10, 20, 50, 100, 200];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const strategy = searchParams.get('strategy') || 'diatas_awan';
    const now = Date.now();

    // 1. Check in-memory cache first
    const stratCache = cache[strategy];
    if (stratCache && (now - stratCache.timestamp < CACHE_DURATION)) {
        return NextResponse.json({ results: stratCache.data, cached: true, timestamp: stratCache.timestamp });
    }

    // 2. Fallback to Firestore global cache
    try {
        const cacheRef = doc(db, 'system', `screening_results_${strategy}`);
        const snap = await getDoc(cacheRef);

        if (snap.exists()) {
            const data = snap.data();
            const firestoreTimestamp = data.timestamp || 0;

            if (now - firestoreTimestamp < CACHE_DURATION) {
                // Refresh in-memory cache
                cache[strategy] = { data: data.results, timestamp: firestoreTimestamp };
                return NextResponse.json({
                    results: data.results,
                    cached: true,
                    timestamp: firestoreTimestamp
                });
            }
        }
    } catch (e) {
        console.error('Error fetching Firestore cache:', e);
    }

    return NextResponse.json({ results: [], cached: false, timestamp: null });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tickers, forceRefresh, strategy = 'diatas_awan' } = body;

        if (!tickers || !Array.isArray(tickers)) {
            return NextResponse.json({ error: 'Invalid tickers' }, { status: 400 });
        }

        const period2 = new Date();
        const period1 = new Date();

        if (strategy === 'turnaround') {
            period1.setFullYear(period2.getFullYear() - 3); // Butuh 3 tahun untuk MACD bulanan & smoothing
        } else {
            period1.setFullYear(period2.getFullYear() - 1); // 1 tahun untuk harian
        }

        const results = [];

        // Process this specific batch
        const batchPromises: Promise<any>[] = tickers.map(async (ticker) => {
            const interval = strategy === 'turnaround' ? '1mo' : '1d';
            const data = await getHistoricalData(ticker, period1, period2, interval);
            // Untuk turnaround butuh setidaknya 6 data bulanan. Untuk daily butuh 200 data harian.
            const minDataLen = strategy === 'turnaround' ? 6 : 200;
            if (!data || data.length < minDataLen) return null;

            const closes = (data as any[]).map(d => d.close);
            const volumes = (data as any[]).map(d => d.volume);
            const opens = (data as any[]).map(d => d.open);
            const highs = (data as any[]).map(d => d.high);
            const lows = (data as any[]).map(d => d.low);

            const currentPrice = closes[closes.length - 1];
            const currentVolume = volumes[volumes.length - 1];
            const currentOpen = opens[opens.length - 1];

            let isValid = false;
            let validationData: any = {};

            if (strategy === 'swing_mingguan') {
                const smaData = calculateMultipleSMAs(closes, [10, 20, 50, 100, 200]);
                const macdData = calculateMACD(closes);
                const result = checkSwingMingguan(
                    closes,
                    opens,
                    smaData[10],
                    smaData[20],
                    smaData[50],
                    smaData[100],
                    smaData[200],
                    macdData.macdLine,
                    macdData.signalLine
                );
                
                isValid = result.isValid;
                if (isValid) {
                    validationData = {
                        volumeRatio: 0,
                        gainFromCross: result.gainPercentage,
                        smaValues: {
                            '10': smaData[10][smaData[10].length - 1] || 0,
                            '20': smaData[20][smaData[20].length - 1] || 0
                        }
                    };
                }
            } else if (strategy === 'turnaround') {
                const macdData = calculateMACD(closes);
                isValid = checkTurnaround(closes, volumes, macdData.macdLine, macdData.signalLine);
                if (isValid) {
                    validationData = {
                        isVolumeSpike: true, // Asumsinya ada volume akumulasi
                        volumeRatio: 1,
                        smaValues: {}
                    };
                }
            } else {
                // diatas_awan
                const gainFromOpen = (currentPrice - currentOpen) / currentOpen;
                if (gainFromOpen <= 0.05) {
                    const smaData = calculateMultipleSMAs(closes, SMA_PERIODS);
                    const latestSmas: Record<number, number | null> = {};
                    SMA_PERIODS.forEach(p => {
                        const values = smaData[p];
                        latestSmas[p] = values[values.length - 1];
                    });

                    const validation = validateSmaCriteria(currentPrice, latestSmas, SMA_PERIODS);
                    const volumeInfo = checkVolumeSpike(volumes);

                    if (validation && volumeInfo.isSpike) {
                        isValid = true;
                        validationData = {
                            volumeRatio: volumeInfo.ratio,
                            isVolumeSpike: volumeInfo.isSpike,
                            ...validation
                        };
                    }
                }
            }

            if (isValid) {
                return {
                    ticker,
                    price: currentPrice,
                    volume: currentVolume,
                    ...validationData,
                    sparkline: closes.slice(-20)
                };
            }
            return null;
        });

        const batchResults = await Promise.all(batchPromises);
        const filteredResults = batchResults.filter(r => r !== null);

        // Manage internal cache if this is integrated into a larger sequence
        // (Note: This simple POST doesn't update the global cache yet, 
        // the client will handle aggregation and potentially a final "save cache" call or similar,
        // but for now let's just return the batch results.)

        return NextResponse.json({ results: filteredResults });
    } catch (error) {
        console.error('Error in batch screening:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { results, strategy = 'diatas_awan' } = body;

        if (!results || !Array.isArray(results)) {
            return NextResponse.json({ error: 'Invalid results' }, { status: 400 });
        }

        const timestamp = Date.now();

        // 1. Update Firestore
        const cacheRef = doc(db, 'system', `screening_results_${strategy}`);
        await setDoc(cacheRef, { results, timestamp });

        // 2. Update in-memory
        cache[strategy] = { data: results, timestamp };

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving global cache:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
