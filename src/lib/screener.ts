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
 * FITUR MEMBUMI (Reversal Akumulasi)
 * Syarat:
 * 1. Ada minimal 1 hari penurunan (merah) di 1-2 hari terakhir.
 * 2. Pada hari penurunan tersebut, volume perdagangan harus signifikan/melonjak.
 * 3. Hari ini: volume harus KECIL (lebih rendah dari volume hari penurunan).
 * 4. Hari ini: ukuran body candle KECIL (buka & tutup hampir sama) ATAU berbentuk Hammer.
 */
export function checkMembumi(
    closes: number[],
    opens: number[],
    highs: number[],
    lows: number[],
    volumes: number[]
): { isValid: boolean; volumeRatio: number } {
    if (closes.length < 15) return { isValid: false, volumeRatio: 0 };

    const currentClose = closes[closes.length - 1];
    const currentOpen = opens[opens.length - 1];
    const currentHigh = highs[highs.length - 1];
    const currentLow = lows[lows.length - 1];
    const currentVolume = volumes[volumes.length - 1];

    let dropIndex = -1;
    let maxDropVolume = 0;

    // 1 & 2. Cari hari penurunan dengan volume terbesar di 1-2 hari terakhir (index length-3 dan length-2)
    // i = length - 3 (lusa), length - 2 (kemarin)
    for (let i = closes.length - 3; i <= closes.length - 2; i++) {
        const isRed = closes[i] < opens[i] || (i > 0 && closes[i] < closes[i-1]);
        if (isRed && volumes[i] > maxDropVolume) {
            dropIndex = i;
            maxDropVolume = volumes[i];
        }
    }

    if (dropIndex === -1) return { isValid: false, volumeRatio: 0 }; 

    // Cek seberapa signifikan volume hari penurunan itu dibanding rata-rata 5 hari sebelumnya
    const prev5Vol = volumes.slice(dropIndex - 5, dropIndex);
    if (prev5Vol.length === 0) return { isValid: false, volumeRatio: 0 };
    const avgPrev5Vol = prev5Vol.reduce((a, b) => a + b, 0) / prev5Vol.length;
    const volumeRatio = avgPrev5Vol > 0 ? maxDropVolume / avgPrev5Vol : 0;

    // Volume drop minimal harus lebih tinggi dari average (threshold 1.2x as discussed)
    if (volumeRatio < 1.2) return { isValid: false, volumeRatio: 0 };

    // 3. Hari ini volume harus kecil (kurang dari volume saat drop kemarin)
    if (currentVolume >= maxDropVolume) return { isValid: false, volumeRatio };

    // 4. Hari ini candle kecil ATAU hammer
    const isHammer = isHammerPattern(currentClose, currentOpen, currentHigh, currentLow);
    const bodySizePercent = Math.abs(currentClose - currentOpen) / currentOpen;
    const isSmallBody = bodySizePercent <= 0.015; // Body maksimal 1.5%

    if (!isHammer && !isSmallBody) return { isValid: false, volumeRatio };

    return { isValid: true, volumeRatio };
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
