import { NextResponse } from 'next/server';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike } from '@/lib/screener';
import { calculateMultipleSMAs } from '@/lib/indicators';
import { IDX_TICKERS } from '@/lib/tickers';

// In-memory cache for screening results (1 hour)
let cache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000;

const SMA_PERIODS = [3, 5, 20, 50, 100, 200];

export async function GET(request: Request) {
    const now = Date.now();

    // GET only returns cached data if available
    if (cache && (now - cache.timestamp < CACHE_DURATION)) {
        return NextResponse.json({ results: cache.data, cached: true });
    }

    return NextResponse.json({ results: [], cached: false });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { tickers, forceRefresh } = body;

        if (!tickers || !Array.isArray(tickers)) {
            return NextResponse.json({ error: 'Invalid tickers' }, { status: 400 });
        }

        const period2 = new Date();
        const period1 = new Date();
        period1.setFullYear(period2.getFullYear() - 1);

        const results = [];

        // Process this specific batch
        const batchPromises = tickers.map(async (ticker) => {
            const data = await getHistoricalData(ticker, period1, period2);
            if (!data || data.length < 200) return null;

            const closes = (data as any[]).map(d => d.close);
            const volumes = (data as any[]).map(d => d.volume);
            const currentPrice = closes[closes.length - 1];
            const currentVolume = volumes[volumes.length - 1];

            const smaData = calculateMultipleSMAs(closes, SMA_PERIODS);
            const latestSmas: Record<number, number | null> = {};
            SMA_PERIODS.forEach(p => {
                const values = smaData[p];
                latestSmas[p] = values[values.length - 1];
            });

            const validation = validateSmaCriteria(currentPrice, latestSmas, SMA_PERIODS);
            const volumeInfo = checkVolumeSpike(volumes);

            if (validation) {
                return {
                    ticker,
                    price: currentPrice,
                    volume: currentVolume,
                    volumeRatio: volumeInfo.ratio,
                    isVolumeSpike: volumeInfo.isSpike,
                    ...validation,
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
        return NextResponse.json({ error: 'Inernal server error' }, { status: 500 });
    }
}
