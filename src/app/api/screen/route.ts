import { NextResponse } from 'next/server';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike } from '@/lib/screener';
import { calculateMultipleSMAs } from '@/lib/indicators';
import { IDX_TICKERS } from '@/lib/tickers';

// In-memory cache for screening results (1 hour)
let cache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000;

const SMA_PERIODS = [5, 20, 50, 100, 200];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const now = Date.now();
    if (cache && (now - cache.timestamp < CACHE_DURATION) && !forceRefresh) {
        return NextResponse.json({ results: cache.data, cached: true });
    }

    const results = [];
    const period2 = new Date();
    const period1 = new Date();
    period1.setFullYear(period2.getFullYear() - 1); // Get 1 year of data

    // For this demo, we'll process tickers in small batches to avoid timeouts and rate limits
    const batchSize = 10;
    for (let i = 0; i < IDX_TICKERS.length; i += batchSize) {
        const batch = IDX_TICKERS.slice(i, i + batchSize);
        const batchPromises = batch.map(async (ticker) => {
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
                    sparkline: closes.slice(-20) // last 20 days for sparkline
                };
            }
            return null;
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(r => r !== null));

        // Optional: Small delay between batches to be nice to Yahoo
        if (i + batchSize < IDX_TICKERS.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    cache = { data: results, timestamp: now };
    return NextResponse.json({ results, cached: false });
}
