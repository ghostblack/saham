import { NextResponse } from 'next/server';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike, checkTurnaroundFollowTrend, checkBottoming, checkDiatasAwanTiered, isHammerPattern } from '@/lib/screener';
import { calculateMultipleSMAs, calculateMACD, calculateRSI } from '@/lib/indicators';
import { IDX_TICKERS } from '@/lib/tickers';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// In-memory cache for screening results keyed by strategy
let cache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_DURATION = 15 * 60 * 1000;

const SMA_PERIODS = [3, 5, 10, 20, 50, 100, 200];

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
            const periodDaily1 = new Date();
            periodDaily1.setFullYear(period2.getFullYear() - 1);
            
            const periodWeekly1 = new Date();
            periodWeekly1.setFullYear(period2.getFullYear() - 2);

            // Fetch Daily Data
            const dailyData = await getHistoricalData(ticker, periodDaily1, period2, '1d');
            if (!dailyData) return null;

            // Ensure we only process valid data points
            const validDaily = (dailyData as any[]).filter(d => d.close !== null && d.close !== undefined && d.volume !== null);
            if (validDaily.length < 200) return null;

            const closes = validDaily.map(d => d.close);
            const volumes = validDaily.map(d => d.volume);
            const opens = validDaily.map(d => d.open);
            const highs = validDaily.map(d => d.high);
            const lows = validDaily.map(d => d.low);

            const currentPrice = closes[closes.length - 1];
            const currentVolume = volumes[volumes.length - 1];
            const currentOpen = opens[opens.length - 1];

            let isValid = false;
            let validationData: any = {};

            if (strategy === 'membumi' || strategy === 'cari_bottom') {
                const smaData = calculateMultipleSMAs(closes, [5, 10, 20, 50, 100]);
                const macdData = calculateMACD(closes);
                const result = checkBottoming(
                    closes, opens, highs, lows, volumes,
                    smaData[5], smaData[10], smaData[20], smaData[50], smaData[100],
                    macdData.macdLine, macdData.signalLine
                );
                isValid = result.isValid;
                if (isValid) {
                    validationData = {
                        isVolumeSpike: true,
                        volumeRatio: result.volumeRatio,
                        gainFromCross: result.gainPercentage,
                        smaValues: {
                            '10': smaData[10][smaData[10].length - 1] || 0,
                            '20': smaData[20][smaData[20].length - 1] || 0
                        },
                        ohlcData: (dailyData as any[]).slice(-40).map(d => ({
                            x: new Date(d.date).getTime(),
                            y: [d.open, d.high, d.low, d.close]
                        }))
                    };
                }
            } else if (strategy === 'turnaround') {
                const weeklyData = await getHistoricalData(ticker, periodWeekly1, period2, '1wk');
                if (!weeklyData) return null;
                
                const validWeekly = (weeklyData as any[]).filter(d => d.close !== null && d.close !== undefined);
                if (validWeekly.length < 20) return null;

                const dailyMacd = calculateMACD(closes);
                const dailySma = calculateMultipleSMAs(closes, [20]);
                const weeklyCloses = validWeekly.map(d => d.close);
                const weeklyMacd = calculateMACD(weeklyCloses);

                const result = checkTurnaroundFollowTrend(
                    closes, volumes, dailySma[20], 
                    dailyMacd.macdLine, dailyMacd.signalLine,
                    weeklyMacd.macdLine, weeklyMacd.signalLine
                );

                isValid = result.isValid;
                if (isValid) {
                    validationData = {
                        status: result.status,
                        distanceToMA20: result.distanceToMA20,
                        smaValues: {
                            '20': dailySma[20][dailySma[20].length - 1]
                        },
                        ohlcData: (dailyData as any[]).slice(-40).map(d => ({
                            x: new Date(d.date).getTime(),
                            y: [d.open, d.high, d.low, d.close]
                        }))
                    };
                }
            } else {
                // diatas_awan (Tiered: Emas & Silver)
                const smaPeriodsTiered = [3, 5, 10, 20, 50, 100];
                const smaData = calculateMultipleSMAs(closes, smaPeriodsTiered);
                const macdData = calculateMACD(closes);
                const volumeInfo = checkVolumeSpike(volumes);
                
                const smas: Record<number, number | null> = {};
                smaPeriodsTiered.forEach(p => {
                    const values = smaData[p];
                    smas[p] = values[values.length - 1];
                });

                const prevPrice = closes[closes.length - 2];
                const dailyChangePercent = ((currentPrice - prevPrice) / prevPrice) * 100;

                const tieredResult = checkDiatasAwanTiered(currentPrice, dailyChangePercent, volumes, smas, macdData.macdLine, macdData.signalLine);
                
                if (tieredResult.isValid) {
                    isValid = true;
                    validationData = {
                        tier: tieredResult.tier, // "Emas", "Silver"
                        status: tieredResult.status, // "Beli Sekarang", "Mulai Beli"
                        volumeRatio: volumeInfo.ratio,
                        isVolumeSpike: volumeInfo.isSpike,
                        smaValues: smas,
                        ohlcData: (dailyData as any[]).slice(-40).map(d => ({
                            x: new Date(d.date).getTime(),
                            y: [d.open, d.high, d.low, d.close]
                        }))
                    };
                }
            }

            if (isValid) {
                return {
                    ticker,
                    price: currentPrice,
                    volume: currentVolume,
                    ...validationData,
                    sparkline: closes.slice(-40)
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
