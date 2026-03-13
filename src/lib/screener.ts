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
            const results = await yahooFinance.historical(symbol, {
                period1,
                period2,
                interval,
            }, { validateResult: false });
            return results;
        } catch (error: any) {
            const isDataError = error.message?.includes('null values');
            
            // If it's a "null values" error, don't retry.
            // This happens when Yahoo has the entry for today but no OHLC data yet.
            // Retrying 3-9 seconds later won't help; it usually takes hours to fix.
            if (isDataError) {
                console.warn(`[DATA EMPTY] ${ticker} returned null values. Skipping to save time.`);
                return null;
            }

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
    // Core periods for "Diatas Awan": 10, 20, 50, 100
    const corePeriods = [10, 20, 50, 100];
    const coreSmas = corePeriods.map(p => smas[p]).filter((v): v is number => v !== null);

    if (coreSmas.length !== corePeriods.length) return null;

    // 1. Price above core MAs (10, 20, 50, 100)
    const isAboveAllCore = coreSmas.every(sma => currentPrice > sma);
    if (!isAboveAllCore) return null;

    // 2. MAs are tight (Max MA - Min MA) / Price
    const maxSma = Math.max(...coreSmas);
    const minSma = Math.min(...coreSmas);
    const tightness = (maxSma - minSma) / currentPrice;

    // 3. Price distance to nearest MA (highest core MA) must be <= 5%
    const distance = (currentPrice - maxSma) / maxSma;
    if (distance > 0.05) return null;

    const ma5 = smas[5];
    const isSuperKetat = (ma5 !== undefined && ma5 !== null) && (currentPrice > ma5);
    const status = isSuperKetat ? 'Super Ketat' : 'Ketat';

    return {
        status,
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
    sma10: (number | null)[],
    sma20: (number | null)[],
    sma50: (number | null)[],
    sma100: (number | null)[],
    macdLine: (number | null)[],
    signalLine: (number | null)[]
): { isValid: boolean; gainPercentage?: number } {
    if (closes.length < 60 || sma100.length < 60) return { isValid: false };

    const len = closes.length;
    const latestClose = closes[len - 1];
    const latestMA20 = sma20[len - 1];
    const latestMA10 = sma10[len - 1];

    if (latestMA20 === null || latestMA10 === null) return { isValid: false };

    // 1. Cek apakah pernah "di bawah semua MA" dalam 40 hari terakhir (konteks bottoming)
    let everBelowAllMA = false;
    for (let i = len - 60; i < len - 10; i++) {
        const c = closes[i];
        const m10 = sma10[i];
        const m20 = sma20[i];
        const m50 = sma50[i];
        const m100 = sma100[i];
        
        if (m10 !== null && m20 !== null && m50 !== null && m100 !== null) {
            if (c < m10 && c < m20 && c < m50 && c < m100) {
                everBelowAllMA = true;
                break;
            }
        }
    }
    if (!everBelowAllMA) return { isValid: false };

    // 2. Cek crossover MA 10 (Orange) di atas MA 20 (Hijau) dalam 20 hari terakhir
    let crossFoundIndex = -1;
    for (let i = len - 1; i >= len - 20; i--) {
        const curr10 = sma10[i];
        const prev10 = sma10[i - 1];
        const curr20 = sma20[i];
        const prev20 = sma20[i - 1];

        if (curr10 !== null && prev10 !== null && curr20 !== null && prev20 !== null) {
            if (curr10 > curr20 && prev10 <= prev20) {
                crossFoundIndex = i;
                break;
            }
        }
    }
    if (crossFoundIndex === -1) return { isValid: false };

    // 3. Syarat "ANTRI" atau "MANTUL":
    // Harga sekarang harus di atas MA 20
    if (latestClose < latestMA20) return { isValid: false };

    // Jarak harga sekarang ke MA 20 tidak boleh lebih dari 3% (area pantulan)
    const distanceToMA20 = (latestClose - latestMA20) / latestMA20;
    if (distanceToMA20 > 0.03) return { isValid: false };

    // Tambahan: MA 10 harus tetap di atas MA 20
    if (latestMA10 <= latestMA20) return { isValid: false };

    const crossPrice = closes[crossFoundIndex];
    const gainPercentage = ((latestClose - crossPrice) / crossPrice) * 100;

    return { isValid: true, gainPercentage };
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
