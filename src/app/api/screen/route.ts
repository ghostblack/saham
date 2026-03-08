import { NextResponse } from 'next/server';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike } from '@/lib/screener';
import { calculateMultipleSMAs } from '@/lib/indicators';
import { IDX_TICKERS } from '@/lib/tickers';

// In-memory cache for screening results (1 hour)
let cache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000;

const SMA_PERIODS = [3, 5, 20, 50, 100, 200];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const now = Date.now();

    // Create a ReadableStream to stream progress and results
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            if (cache && (now - cache.timestamp < CACHE_DURATION) && !forceRefresh) {
                sendEvent({ type: 'progress', current: IDX_TICKERS.length, total: IDX_TICKERS.length });
                sendEvent({ type: 'results', data: cache.data, cached: true });
                controller.close();
                return;
            }

            const results = [];
            const period2 = new Date();
            const period1 = new Date();
            period1.setFullYear(period2.getFullYear() - 1);

            const batchSize = 5;
            const total = IDX_TICKERS.length;

            for (let i = 0; i < total; i += batchSize) {
                const batch = IDX_TICKERS.slice(i, i + batchSize);

                // Send progress update
                sendEvent({
                    type: 'progress',
                    current: i,
                    total
                });

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
                            sparkline: closes.slice(-20)
                        };
                    }
                    return null;
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults.filter(r => r !== null));

                if (i + batchSize < total) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            // Final progress update
            sendEvent({ type: 'progress', current: total, total });

            // Send final results
            cache = { data: results, timestamp: now };
            sendEvent({ type: 'results', data: results, cached: false });

            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
