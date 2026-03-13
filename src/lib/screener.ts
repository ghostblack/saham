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
 * FITUR 2: CARI BOTTOM (Bottoming & MA 20 Bounce)
 * Syarat:
 * 1. Harga sebelumnya berada di bawah semua MA (10, 20, 50, 100) dalam 40 hari terakhir (fase downtrend).
 * 2. MA 10 (Orange) sudah memotong MA 20 (Hijau) ke atas dalam 20 hari terakhir.
 * 3. Harga saat ini sedang "mantul" (bounce) atau retest di MA 20.
 * 4. Harga CLOSE saat ini berada di atas MA 20, tapi jaraknya tidak lebih dari 3% dari MA 20.
 */
export function checkCariBottom(
    closes: number[],
    opens: number[],
    lows: number[],
    volumes: number[],
    sma10: (number | null)[],
    sma20: (number | null)[],
    sma50: (number | null)[],
    sma100: (number | null)[],
    macdLine: (number | null)[],
    signalLine: (number | null)[]
): { isValid: boolean; gainPercentage?: number } {
    if (closes.length < 60 || sma100.length < 60 || volumes.length < 60) return { isValid: false };

    const len = closes.length;
    const latestClose = closes[len - 1];
    const latestMA20 = sma20[len - 1];
    const latestMA10 = sma10[len - 1];

    if (latestMA20 === null || latestMA10 === null) return { isValid: false };

    // 1. MUST have been in a "Real Downtrend" 20-10 days ago
    // (Price < MA10, MA20, MA50, MA100)
    let confirmedDowntrendHistory = false;
    for (let i = len - 25; i < len - 10; i++) {
        const c = closes[i];
        const m10 = sma10[i];
        const m20 = sma20[i];
        const m50 = sma50[i];
        const m100 = sma100[i];
        
        if (m10 !== null && m20 !== null && m50 !== null && m100 !== null) {
            if (c < m10 && c < m20 && c < m50 && c < m100) {
                confirmedDowntrendHistory = true;
                break;
            }
        }
    }
    if (!confirmedDowntrendHistory) return { isValid: false };

    // 2. Find the FIRST Golden Cross (MA10 > MA20) in the last 5 days
    let crossIndex = -1;
    for (let i = len - 5; i < len; i++) {
        const curr10 = sma10[i];
        const prev10 = sma10[i - 1];
        const curr20 = sma20[i];
        const prev20 = sma20[i - 1];

        if (curr10 !== null && prev10 !== null && curr20 !== null && prev20 !== null) {
            if (curr10 > curr20 && prev10 <= prev20) {
                crossIndex = i;
                break;
            }
        }
    }
    if (crossIndex === -1) return { isValid: false };

    // 3. Survival & Persistence Check:
    // Price must have survived 1 to 3 days above MA20 since the cross
    const daysSinceCross = (len - 1) - crossIndex;
    if (daysSinceCross < 1 || daysSinceCross > 3) return { isValid: false };

    // All days since cross must remain above MA20
    for (let i = crossIndex; i < len; i++) {
        const c = closes[i];
        const m20 = sma20[i];
        if (m20 === null || c < m20) return { isValid: false };
    }

    // 4. No New Low: Low after cross must be >= Low on cross day
    const crossLow = lows[crossIndex];
    for (let i = crossIndex + 1; i < len; i++) {
        if (lows[i] < crossLow) return { isValid: false };
    }

    // 5. Volume Confirmation: "tiba tiba ada volume lebih besar"
    // Ratio > 1.5x average on cross day OR current day
    const calculateAvgVolume = (index: number) => {
        const period = 20;
        const prevVols = volumes.slice(Math.max(0, index - period), index);
        if (prevVols.length === 0) return 0;
        return prevVols.reduce((a, b) => a + b, 0) / prevVols.length;
    };

    const crossAvg = calculateAvgVolume(crossIndex);
    const currAvg = calculateAvgVolume(len - 1);
    const crossVolRatio = crossAvg > 0 ? volumes[crossIndex] / crossAvg : 1;
    const currVolRatio = currAvg > 0 ? volumes[len - 1] / currAvg : 1;

    if (crossVolRatio < 1.5 && currVolRatio < 1.5) return { isValid: false };

    // 6. GAIN CAP: Gain from cross price must not exceed 5%
    const crossPrice = closes[crossIndex];
    const gainFromCross = ((latestClose - crossPrice) / crossPrice) * 100;
    if (gainFromCross > 5) return { isValid: false };

    return { isValid: true, gainPercentage: gainFromCross };
}

/**
 * Bottom Break Sideways:
 * 1. Sideways for 30+ days (price range < 12%)
 * 2. Breakout above the sideways range & MA20 in the last 1-3 days
 * 3. Volume spike (>1.8x average) on breakout
 */
export function checkBottomBreakSideways(
    closes: number[],
    lows: number[],
    highs: number[],
    volumes: number[],
    sma20: (number | null)[]
): { isValid: boolean; gainPercentage?: number } {
    if (closes.length < 40 || sma20.length < 40) return { isValid: false };

    const len = closes.length;
    const latestClose = closes[len - 1];
    
    // 1. Sideways Check (33 to 3 days ago, ~30 days)
    const windowStart = len - 33;
    const windowEnd = len - 3;
    if (windowStart < 0) return { isValid: false };

    const windowHighs = highs.slice(windowStart, windowEnd);
    const windowLows = lows.slice(windowStart, windowEnd);
    
    const maxH = Math.max(...windowHighs);
    const minL = Math.min(...windowLows);
    const priceRange = (maxH - minL) / minL;

    // Must be sideways (range <= 12%)
    if (priceRange > 0.12) return { isValid: false };

    // 2. Breakout Check (last 1-3 days)
    let breakoutFound = false;
    for (let i = len - 3; i < len; i++) {
        const valMA20 = sma20[i];
        if (closes[i] > maxH && valMA20 !== null && closes[i] > valMA20) {
            breakoutFound = true;
            break;
        }
    }
    if (!breakoutFound) return { isValid: false };

    // 3. Volume Confirmation
    const calculateAvgVolume = (index: number) => {
        const period = 20;
        const prevVols = volumes.slice(Math.max(0, index - period), index);
        return prevVols.length > 0 ? prevVols.reduce((a, b) => a + b, 0) / prevVols.length : 0;
    };

    let volumeConfirmed = false;
    for (let i = len - 3; i < len; i++) {
        const avg = calculateAvgVolume(i);
        if (avg > 0 && volumes[i] / avg >= 1.8) {
            volumeConfirmed = true;
            break;
        }
    }
    if (!volumeConfirmed) return { isValid: false };

    const gainFromBreak = ((latestClose - maxH) / maxH) * 100;
    if (gainFromBreak > 10) return { isValid: false };

    return { isValid: true, gainPercentage: gainFromBreak };
}

/**
 * FITUR 3: TURNAROUND (Monthly MACD & Sideways Breakout)
 * Mencari saham yang reversal dari tren turun jangka panjang berdasarkan MACD bulanan
 * dan disertai akumulasi volume.
 */
export function checkTurnaround(
    monthlyCloses: number[],
    monthlyVolumes: number[],
    monthlyMacdLine: (number | null)[],
    monthlySignalLine: (number | null)[]
) {
    if (monthlyCloses.length < 6 || monthlyMacdLine.length < 6) return false;

    const currentClose = monthlyCloses[monthlyCloses.length - 1];
    const currentVolume = monthlyVolumes[monthlyVolumes.length - 1];
    const prevVolume = monthlyVolumes[monthlyVolumes.length - 2];

    // 1. Monthly MACD Crossover (Baru cross/mulai cross ke atas)
    let hasGoldenCross = false;
    const daysToCheck = 2; // Cek 2 bulan terakhir
    const startIndex = monthlyMacdLine.length - daysToCheck - 1;

    for (let i = Math.max(1, startIndex); i < monthlyMacdLine.length; i++) {
        const prevMacd = monthlyMacdLine[i - 1];
        const prevSignal = monthlySignalLine[i - 1];
        const currentMacd = monthlyMacdLine[i];
        const currentSignal = monthlySignalLine[i];

        if (prevMacd !== null && prevSignal !== null && currentMacd !== null && currentSignal !== null) {
            // Jika MACD tadinya di bawah signal lalu memotong ke atas
            if (prevMacd <= prevSignal && currentMacd > currentSignal) {
                hasGoldenCross = true;
                break;
            }
        }
    }

    if (!hasGoldenCross) {
        // Toleransi: jika saat ini MACD menempel/mulai di atas signal (baru akan cross bulan ini)
        const currentMacd = monthlyMacdLine[monthlyMacdLine.length - 1];
        const currentSignal = monthlySignalLine[monthlySignalLine.length - 1];
        if (currentMacd === null || currentSignal === null || currentMacd < currentSignal) {
            return false;
        }
    }

    // 2. Accumulation Volume (Bulan ini ATAU bulan lalu harus lebih besar dari rata-rata 6 bulan sebelumnya)
    const prev6MonthsVol = monthlyVolumes.slice(-8, -2); // Ambil 6 bulan sebelum 2 bulan terakhir
    const avg6MonthsVol = prev6MonthsVol.reduce((a, b) => a + b, 0) / prev6MonthsVol.length;

    // Syarat akumulasi: volume bulan ini atau kemaren harus melonjak > 1.2x dari rata-rata lama
    if (currentVolume <= avg6MonthsVol * 1.2 && prevVolume <= avg6MonthsVol * 1.2) {
        return false;
    }

    // 3. Sideways Breakout (Harga saat ini harus lebih tinggi/mulai naik dibanding harga rata-rata 3-5 bulan lalu)
    const prev3to5MonthsCloses = monthlyCloses.slice(-6, -2);
    const avgSidewaysPrice = prev3to5MonthsCloses.reduce((a, b) => a + b, 0) / prev3to5MonthsCloses.length;

    // Bebas apakah dia breakout atau mulai naik pelan-pelan sedemikian rupa
    if (currentClose <= avgSidewaysPrice * 1.02) { // minimal 2% di atas rata2 area sideways
        return false;
    }

    return true;
}
