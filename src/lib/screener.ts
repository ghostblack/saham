import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

/**
 * Fetches historical data for a given ticker.
 * IDX stocks should have the suffix .JK
 */
export async function getHistoricalData(ticker: string, period1: Date, period2: Date, interval: '1d' | '1wk' | '1mo' = '1d') {
    try {
        const symbol = ticker.endsWith('.JK') ? ticker : `${ticker}.JK`;
        const results = await yahooFinance.historical(symbol, {
            period1,
            period2,
            interval,
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
    const corePeriods = periods.filter(p => p !== 5);
    const coreSmas = corePeriods.map(p => smas[p]).filter((v): v is number => v !== null);

    if (coreSmas.length !== corePeriods.length) return null;

    // 1. Price above core MAs (10, 20, 50, 100, 200)
    const isAboveAllCore = coreSmas.every(sma => currentPrice > sma);
    if (!isAboveAllCore) return null;

    // 2. MAs are tight (Max MA - Min MA) / Price < 20%
    const maxSma = Math.max(...coreSmas);
    const minSma = Math.min(...coreSmas);
    const tightness = (maxSma - minSma) / currentPrice;
    // Dihilangkan syarat isTight sesuai permintaan User agar tidak terlalu membatasi

    // 3. Price hasn't run up much (0-3% above the highest core MA)
    const distance = (currentPrice - maxSma) / maxSma;
    const isLowBreakout = distance >= 0 && distance <= 0.03;
    if (!isLowBreakout) return null;

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
    if (volumes.length < period + 1) return { isSpike: false, ratio: 1 };

    const currentVolume = volumes[volumes.length - 1];
    const previousVolumes = volumes.slice(-(period + 1), -1);
    const avgVolume = previousVolumes.reduce((a, b) => a + b, 0) / period;

    const ratio = currentVolume / avgVolume;
    return {
        isSpike: ratio > 2.0,
        ratio
    };
}

/**
 * FITUR 2: SWING MINGGUAN
 * Syarat:
 * 1. Harga mulai sideaway setelah dibawah semua MA dalam 20 hari terakhir.
 * 2. Harga close pertama kali diatas MA 20 (bisa terjadi hingga 15 hari lalu).
 * 3. MA 10 pertama kali diatas MA 20 (bisa terjadi hingga 15 hari lalu).
 * 5. MACD harian baru saja Golden Cross (potong Signal ke atas) dalam 5 hari terakhir, atau sedang akan cross.
 * 6. (BARU) Kenaikan intra-day (Open ke Close hari ini) tidak lebih dari 5%.
 */
export function checkSwingMingguan(
    closes: number[],
    opens: number[],
    sma10: (number | null)[],
    sma20: (number | null)[],
    sma50: (number | null)[],
    sma100: (number | null)[],
    sma200: (number | null)[],
    macdLine: (number | null)[],
    signalLine: (number | null)[]
): { isValid: boolean; gainPercentage?: number } {
    if (closes.length < 20 || sma100.length < 20) return { isValid: false };

    const len = closes.length;

    // 1. Harga mulai sideaway setelah dibawah semua MA (kecuali MA200) dalam 20 hari terakhir
    let everBelowAllMA = false;
    for (let i = len - 20; i < len; i++) {
        const c = closes[i];
        const m20 = sma20[i];
        const m50 = sma50[i];
        const m100 = sma100[i];
        
        if (m20 !== null && m50 !== null && m100 !== null) {
            if (c < m20 && c < m50 && c < m100) {
                everBelowAllMA = true;
                break;
            }
        }
    }

    if (!everBelowAllMA) return { isValid: false };

    // 2 & 3. Cek crossover MA10 di atas MA20 atau Harga Close di atas MA20 dalam 15 hari terakhir
    const lookback = 15;
    const startIndex = Math.max(1, len - lookback);
    
    let crossFoundIndex = -1;
    let crossPrice = 0;

    for (let i = len - 1; i >= startIndex; i--) {
        const currentClose = closes[i];
        const prevClose = closes[i - 1];
        
        const currentMA20 = sma20[i];
        const prevMA20 = sma20[i - 1];
        
        const currentMA10 = sma10[i];
        const prevMA10 = sma10[i - 1];

        if (currentMA20 !== null && prevMA20 !== null && currentMA10 !== null && prevMA10 !== null) {
            const isCloseCrossUpMA20 = currentClose > currentMA20 && prevClose <= prevMA20;
            const isMA10CrossUpMA20 = currentMA10 > currentMA20 && prevMA10 <= prevMA20;

            if (isCloseCrossUpMA20 || isMA10CrossUpMA20) {
                crossFoundIndex = i;
                crossPrice = currentClose;
                break; // Ambil crossover paling baru yang ditemukan (karena loop mundur dari array terakhir)
            }
        }
    }

    if (crossFoundIndex === -1) return { isValid: false };

    // 4. Harga saat ini belum naik lebih dari 5% dari harga saat terjadinya crossover
    const latestClose = closes[len - 1];
    const latestMA20 = sma20[len - 1];

    if (latestMA20 === null) return { isValid: false };

    // Opsional tambahan stabilitas: Harga saat ini harus tetap berada di atas MA20
    if (latestClose < latestMA20) return { isValid: false };

    // Toleransi kenaikan maksimal 5% dari harga cross
    const isGainAcceptable = latestClose <= crossPrice * 1.05;
    if (!isGainAcceptable) return { isValid: false };

    // Kenaikan intra-day (Open ke Close hari ini) maksimal 5% agar tidak beli saham yang sudah terbang di pucuk
    const latestOpen = opens[len - 1];
    const intradayGain = (latestClose - latestOpen) / latestOpen;
    if (intradayGain > 0.05) return { isValid: false };

    // 7. (BARU) Pastikan MA10 SAAT INI harus berada di atas MA20.
    // Jika MA10 pernah memotong MA20 ke atas (dalam 15 hari lalu), tapi sekarang sudah memotong ke bawah lagi (dead cross), 
    // maka setup ini sudah batal/invalid.
    const latestMA10 = sma10[len - 1];
    if (latestMA10 === null || latestMA10 <= latestMA20) return { isValid: false };

    const gainPercentage = ((latestClose - crossPrice) / crossPrice) * 100;

    // 5. MACD Golden Cross dalam 5 hari terakhir
    let hasMacdCross = false;
    const macdLookback = 5;
    const macdStartIndex = Math.max(1, len - macdLookback);
    
    for (let i = len - 1; i >= macdStartIndex; i--) {
        const currMacd = macdLine[i];
        const prevMacd = macdLine[i - 1];
        const currSignal = signalLine[i];
        const prevSignal = signalLine[i - 1];

        if (currMacd !== null && prevMacd !== null && currSignal !== null && prevSignal !== null) {
            // Golden Cross: MACD tadinya <= Signal, sekarang > Signal
            if (currMacd > currSignal && prevMacd <= prevSignal) {
                hasMacdCross = true;
                break;
            }
        }
    }

    if (!hasMacdCross) {
        // Toleransi: Jika MACD saat ini sudah di atas signal meskipun cross-nya terjadi lebih dari 5 hari lalu
        const latestMacd = macdLine[len - 1];
        const latestSignal = signalLine[len - 1];
        if (latestMacd === null || latestSignal === null || latestMacd <= latestSignal) {
            return { isValid: false };
        }
    }

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
