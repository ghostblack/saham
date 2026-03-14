import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

/**
 * Fetches historical data for a given ticker.
 * IDX stocks should have the suffix .JK
 */
export async function getHistoricalData(ticker: string, period1: Date, period2: Date, interval: '1d' | '1wk' | '1mo' = '1d', retries = 2) {
    const symbol = ticker.endsWith('.JK') ? ticker : `${ticker}.JK`;
    for (let i = 0; i <= retries; i++) {
        try {
            // Using chart() instead of historical() because it's more reliable for current day data
            // and usually avoids the "null values" error on market transitions.
            const result = await yahooFinance.chart(symbol, {
                period1,
                period2,
                interval,
            });

            if (!result || !result.quotes || result.quotes.length === 0) {
                return null;
            }

            // Map chart data to match the format of historical data used by the rest of the script
            return result.quotes.map(q => ({
                date: q.date,
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume,
                adjclose: q.adjclose || q.close
            }));
        } catch (error: any) {
            if (i === retries) {
                console.error(`Final failure for ${ticker}: ${error.message}`);
                return null;
            }
            
            const waitTime = 2000 * (i + 1);
            console.warn(`Retry ${i + 1}/${retries} for ${ticker} in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return null;
}

/**
 * Validates if the stock meets the SMA criteria.
 */
export function validateSmaCriteria(
    currentPrice: number,
    smas: Record<number, number | null>,
    periods: number[]
) {
    // Core periods: 10, 20, 50, 100
    const corePeriods = [10, 20, 50, 100];
    const coreSmas = corePeriods.map(p => smas[p]).filter((v): v is number => v !== null);

    if (coreSmas.length !== corePeriods.length) return null;

    // 1. MUST be above MA10, MA20, MA50, MA100
    const isAboveAllCore = coreSmas.every(sma => currentPrice > sma);
    if (!isAboveAllCore) return null;

    // 2. Max distance from the nearest MA (usually the highest one) must be <= 5%
    const highestMA = Math.max(...coreSmas);
    const distance = (currentPrice - highestMA) / highestMA;
    if (distance > 0.05) return null;

    // 3. Signal Classification
    const ma5 = smas[5];
    const ma10 = smas[10];
    const ma20 = smas[20];
    
    let status = 'Pantauan'; // Default: Price is above MA10/20/50/100 (isAboveAllCore) but tier is determined below
    let tightStatus = 'Rapat';

    if (ma5 !== null && currentPrice > ma5) {
        status = 'Rekom Beli';
        tightStatus = 'Super Rapat';
    } else if (ma10 !== null && currentPrice > ma10) {
        status = 'Mulai Beli';
        tightStatus = 'Rapat';
    } else if (ma20 !== null && currentPrice > ma20) {
        status = 'Pantauan';
        tightStatus = 'Rapat';
    }

    const maxSma = Math.max(...coreSmas);
    const minSma = Math.min(...coreSmas);
    const tightness = (maxSma - minSma) / currentPrice;

    return {
        status,
        tightStatus, // e.g., Rapat or Super Rapat
        tightness,
        distance,
        smaValues: periods.reduce((acc, p) => ({ ...acc, [p]: smas[p] }), {})
    };
}

/**
 * FITUR: DIATAS AWAN Tiered (Emas vs Silver)
 * Diatas awan yang paling bagus jika harga diatas semua MA: 3, 5, 10, 20, 50, 100
 * Dan belum naik > 5% dari MA dasar (MA 3).
 */
export function checkDiatasAwanTiered(
    currentPrice: number,
    dailyChangePercent: number,
    volumes: number[],
    smas: Record<number, number | null>,
    macdLine: (number | null)[],
    signalLine: (number | null)[]
): { isValid: boolean; tier: 'Emas' | 'Silver' | null; status: string; distance: number } {
    const requiredPeriods = [3, 5, 10, 20, 50, 100];
    
    // 1. MUST be above all MAs: 3, 5, 10, 20, 50, 100
    const allSmasExist = requiredPeriods.every(p => smas[p] !== null && smas[p] !== undefined);
    if (!allSmasExist) return { isValid: false, tier: null, status: '', distance: 0 };

    const isAboveAll = requiredPeriods.every(p => currentPrice > (smas[p] as number));
    if (!isAboveAll) return { isValid: false, tier: null, status: '', distance: 0 };

    // 2. Entry Price Protection (User: "maksimal 3% kenaikan harian dan 3% dari MA 3")
    // a. Daily Change Limit
    if (dailyChangePercent > 3) return { isValid: false, tier: null, status: '', distance: 0 };

    // b. Distance from Base MA (MA 3)
    const baseMa = smas[3] || smas[5] || 0;
    const distanceToMa = ((currentPrice - (baseMa as number)) / (baseMa as number)) * 100;
    if (distanceToMa > 3) return { isValid: false, tier: null, status: '', distance: distanceToMa };

    // 3. Volume Check (Current > Avg 20)
    const volInfo = checkVolumeSpike(volumes, 20);
    const hasVolumeSupport = volInfo.ratio > 1.0; // Current > Avg 20

    // 4. MACD Confirmation for Tiers
    const len = macdLine.length;
    if (len < 2) return { isValid: false, tier: null, status: '', distance: distanceToMa };
    
    const macdVal = macdLine[len - 1];
    const signalVal = signalLine[len - 1];

    if (macdVal === null || signalVal === null) return { isValid: false, tier: null, status: '', distance: distanceToMa };

    // a. Golden Cross or Positive MACD Trend
    // User: "Daily Golden Cross naik tidak death cross turun"
    const isBullishMacd = macdVal > signalVal;

    if (isBullishMacd) {
        return { 
            isValid: true, 
            tier: 'Emas', 
            status: 'Beli Sekarang',
            distance: distanceToMa
        };
    } else {
        return { 
            isValid: true, 
            tier: 'Silver', 
            status: 'Mulai Beli',
            distance: distanceToMa
        };
    }
}

/**
 * Helper: Detects Hammer candlestick pattern.
 */
export function isHammerPattern(close: number, open: number, high: number, low: number) {
    const bodySize = Math.abs(close - open);
    const lowerWick = Math.min(close, open) - low;
    const upperWick = high - Math.max(close, open);
    const totalSize = high - low;

    if (totalSize === 0) return false;

    // Standard Hammer: Lower wick at least 2x body, very small upper wick
    return lowerWick >= 2 * bodySize && upperWick <= bodySize * 0.5;
}

/**
 * FITUR BOTTOMING (Reversal Trend)
 * Syarat:
 * 1. Downtrend Context: Harga < MA 5, 10, 20, 50, 100 selama minimal 1 bulan (20+ hari).
 * 2. Accumulation: Ada kenaikan volume selama fase bottom.
 * 3. Price Trigger: Ada candle hijau yang lebih tinggi dari candle merah sebelumnya + volume.
 * 4. Golden Cross: MA 10 cross di atas MA 20 pertama kali setelah downtrend.
 * 5. Survival: Bertahan di atas MA 20 selama 1-2 hari.
 * 6. Gain Cap: Harga saat ini belum naik > 5% dari harga crossing.
 */
export function checkBottoming(
    closes: number[],
    opens: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
    sma5: (number | null)[],
    sma10: (number | null)[],
    sma20: (number | null)[],
    sma50: (number | null)[],
    sma100: (number | null)[],
    macdLine: (number | null)[],
    signalLine: (number | null)[]
): { isValid: boolean; volumeRatio: number; gainPercentage?: number } {
    if (closes.length < 130) return { isValid: false, volumeRatio: 0 };

    const len = closes.length;
    const latestClose = closes[len - 1];

    // 1. Find the most recent Golden Cross (MA10 > MA20) in the last 7 days
    let crossIndex = -1;
    for (let i = len - 1; i >= len - 7; i--) {
        const c10 = sma10[i];
        const p10 = sma10[i - 1];
        const c20 = sma20[i];
        const p20 = sma20[i - 1];

        if (c10 !== null && p10 !== null && c20 !== null && p20 !== null) {
            if (c10 > c20 && p10 <= p20) {
                crossIndex = i;
                break;
            }
        }
    }

    if (crossIndex === -1) return { isValid: false, volumeRatio: 0 };

    // 2. MACD Confirmation: Bullish cross within the last 10 days
    let macdBullish = false;
    for (let i = len - 1; i >= len - 10; i--) {
        if (macdLine[i] !== null && signalLine[i] !== null && 
            macdLine[i-1] !== null && signalLine[i-1] !== null) {
            if (macdLine[i]! > signalLine[i]!) {
                macdBullish = true;
                break;
            }
        }
    }
    if (!macdBullish) return { isValid: false, volumeRatio: 0 };

    // 2. Downtrend History Check: Before the cross, was it below all MAs for at least 20 days?
    // We check a window before the cross
    let belowAllCount = 0;
    const lookbackStart = Math.max(0, crossIndex - 60);
    const lookbackEnd = crossIndex;
    
    for (let i = lookbackStart; i < lookbackEnd; i++) {
        const c = closes[i];
        const m5 = sma5[i], m10 = sma10[i], m20 = sma20[i], m50 = sma50[i], m100 = sma100[i];
        if (m5 && m10 && m20 && m50 && m100) {
            if (c < m5 && c < m10 && c < m20 && c < m50 && c < m100) {
                belowAllCount++;
            }
        }
    }

    // Must have been in downtrend for at least 20 days in the 60-day window before cross
    if (belowAllCount < 20) return { isValid: false, volumeRatio: 0 };

    // 3. Survival & Persistence: Price must stay above MA20 since cross
    for (let i = crossIndex; i < len; i++) {
        const c = closes[i];
        const m20 = sma20[i];
        if (m20 === null || c < m20) return { isValid: false, volumeRatio: 0 };
    }

    // 4. Gain Cap: Not more than 5% from cross price
    const crossPrice = closes[crossIndex];
    const gainPercentage = ((latestClose - crossPrice) / crossPrice) * 100;
    if (gainPercentage > 5) return { isValid: false, volumeRatio: 0 };

    // 5. Volume Confirmation: Ratio of volume during cross/reversal vs previous bottom
    const avgPrevVol = volumes.slice(crossIndex - 20, crossIndex).reduce((a, b) => a + b, 0) / 20;
    const volumeRatio = volumes[crossIndex] / avgPrevVol;

    return { isValid: true, volumeRatio, gainPercentage };
}

/**
 * Checks for a volume spike compared to average.
 */
export function checkVolumeSpike(volumes: number[], period: number = 20) {
    if (volumes.length < period + 1) return { isSpike: false, ratio: 1, isRocket: false };

    const currentVolume = volumes[volumes.length - 1];
    const previousVolumes = volumes.slice(-(period + 1), -1);
    const avgVolume = previousVolumes.reduce((a, b) => a + b, 0) / period;
    if (avgVolume === 0) return { isSpike: false, ratio: 1, isRocket: false };

    const ratio = currentVolume / avgVolume;
    return {
        isSpike: ratio > 2.0,
        isRocket: currentVolume > avgVolume,
        ratio
    };
}

/**
 * FITUR 3: TURNAROUND (Follow the Trend)
 * Konsep: Beli saat retest MA 20 setelah reversal terkonfirmasi Weekly & Daily MACD.
 */
export function checkTurnaroundFollowTrend(
    dailyCloses: number[],
    dailyVolumes: number[],
    dailySma20: (number | null)[],
    dailyMacdLine: (number | null)[],
    dailySignalLine: (number | null)[],
    weeklyMacdLine: (number | null)[],
    weeklySignalLine: (number | null)[]
): { isValid: boolean; status: string; distanceToMA20: number } {
    if (dailyCloses.length < 20 || dailyMacdLine.length < 2 || weeklyMacdLine.length < 2) {
        return { isValid: false, status: '', distanceToMA20: 0 };
    }

    const currentPrice = dailyCloses[dailyCloses.length - 1];
    const currentSma20 = dailySma20[dailySma20.length - 1];
    
    if (currentSma20 === null) return { isValid: false, status: '', distanceToMA20: 0 };

    // 1. Weekly MACD MUST be Bullish (Golden Cross or Above Signal)
    const wMacd = weeklyMacdLine[weeklyMacdLine.length - 1];
    const wSignal = weeklySignalLine[weeklySignalLine.length - 1];
    if (wMacd === null || wSignal === null || wMacd <= wSignal) {
        return { isValid: false, status: '', distanceToMA20: 0 };
    }

    // 2. Daily MACD MUST be Bullish (Golden Cross or Above Signal)
    const dMacd = dailyMacdLine[dailyMacdLine.length - 1];
    const dSignal = dailySignalLine[dailySignalLine.length - 1];
    if (dMacd === null || dSignal === null || dMacd <= dSignal) {
        return { isValid: false, status: '', distanceToMA20: 0 };
    }

    // 3. Price MUST be above MA 20 BUT close to it (Retest)
    // User: "sedekat mungkin dengan ma 20"
    if (currentPrice < currentSma20) return { isValid: false, status: '', distanceToMA20: 0 };
    
    const distanceToMA20 = ((currentPrice - currentSma20) / currentSma20) * 100;
    
    // Syarat: Jarak ke MA 20 maksimal 2.5% (Retest area)
    if (distanceToMA20 > 2.5) return { isValid: false, status: '', distanceToMA20: 0 };

    // 4. Volume Confirmation (Volume hari ini harus lumayan, minimal > 0.8x avg volume)
    const volInfo = checkVolumeSpike(dailyVolumes, 20);
    if (volInfo.ratio < 0.8) return { isValid: false, status: '', distanceToMA20: 0 };

    return {
        isValid: true,
        status: 'Beli di Support (MA 20)',
        distanceToMA20
    };
}
