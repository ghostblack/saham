import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

/**
 * Fetches historical data for a given ticker.
 * IDX stocks should have the suffix .JK
 */
export async function getHistoricalData(ticker: string, period1: Date, period2: Date) {
    try {
        const symbol = ticker.endsWith('.JK') ? ticker : `${ticker}.JK`;
        const results = await yahooFinance.historical(symbol, {
            period1,
            period2,
            interval: '1d',
        });
        return results;
    } catch (error) {
        console.error(`Error fetching data for ${ticker}:`, error);
        return null;
    }
}

/**
 * Validates if the stock meets the SMA criteria.
 */
export function validateSmaCriteria(
    currentPrice: number,
    smas: Record<number, number | null>,
    periods: number[]
) {
    const smaValues = periods.map(p => smas[p]).filter((v): v is number => v !== null);

    if (smaValues.length !== periods.length) return null;

    // 1. Price above all MAs
    const isAboveAll = smaValues.every(sma => currentPrice > sma);
    if (!isAboveAll) return null;

    // 2. MAs are tight (Max MA - Min MA) / Price < 5%
    const maxSma = Math.max(...smaValues);
    const minSma = Math.min(...smaValues);
    const tightness = (maxSma - minSma) / currentPrice;
    const isTight = tightness < 0.20;
    if (!isTight) return null;

    // 3. Price hasn't run up much (0-3% above the highest MA)
    const distance = (currentPrice - maxSma) / maxSma;
    const isLowBreakout = distance >= 0 && distance <= 0.03;
    if (!isLowBreakout) return null;

    return {
        tightness,
        distance,
        smaValues: periods.reduce((acc, p, i) => ({ ...acc, [p]: smaValues[i] }), {})
    };
}

/**
 * Checks for a volume spike compared to average.
 */
export function checkVolumeSpike(volumes: number[], period: number = 20) {
    if (volumes.length < period + 1) return { isSpike: false, ratio: 1 };

    const currentVolume = volumes[volumes.length - 1];
    const previousVolumes = volumes.slice(-(period + 1), -1);
    const avgVolume = previousVolumes.reduce((a, b) => a + b, 0) / period;

    const ratio = currentVolume / avgVolume;
    return {
        isSpike: ratio > 1.5,
        ratio
    };
}
