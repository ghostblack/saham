import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { IDX_TICKERS } from '../src/lib/tickers';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike, checkTurnaround, checkCariBottom } from '../src/lib/screener';
import { calculateMultipleSMAs, calculateMACD } from '../src/lib/indicators';

// Delay helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function processAllTickers(tickers: typeof IDX_TICKERS) {
    console.log(`\n--- Starting Optimized Single-Pass Screening ---`);
    const resultsAwan: any[] = [];
    const resultsBottom: any[] = [];
    const resultsTurnaround: any[] = [];

    const period2 = new Date();
    const periodDaily1 = new Date();
    periodDaily1.setFullYear(period2.getFullYear() - 1);
    
    const periodMonthly1 = new Date();
    periodMonthly1.setFullYear(period2.getFullYear() - 3);

    const CHUNK_SIZE = 5;
    for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
        const chunk = tickers.slice(i, i + CHUNK_SIZE);
        
        if (i % 50 === 0 && i !== 0) {
            console.log(`Progress: ${i}/${tickers.length} tickers processed...`);
        }

        await Promise.all(chunk.map(async (ticker) => {
            try {
                // Fetch Daily and Monthly data in parallel for this ticker
                const [dailyData, monthlyData] = await Promise.all([
                    getHistoricalData(ticker, periodDaily1, period2, '1d'),
                    getHistoricalData(ticker, periodMonthly1, period2, '1mo')
                ]);

                // 1. DIATAS AWAN / CARI BOTTOM logic (Daily)
                if (dailyData && dailyData.length >= 200) {
                    const validDaily = (dailyData as any[]).filter(d => d.close !== null && d.close !== undefined);
                    if (validDaily.length >= 200) {
                        const closes = validDaily.map(d => d.close);
                        const volumes = validDaily.map(d => d.volume || 0);
                        const opens = validDaily.map(d => d.open);
                        const lows = validDaily.map(d => d.low);
                        const currentPrice = closes[closes.length - 1];
                        const currentVolume = volumes[volumes.length - 1];
                        const currentOpen = opens[opens.length - 1];

                        // Check Diatas Awan
                        const gainFromOpen = (currentPrice - currentOpen) / currentOpen;
                        if (gainFromOpen <= 0.05) {
                            const smaPeriods = [5, 10, 20, 50, 100];
                            const smaData = calculateMultipleSMAs(closes, smaPeriods);
                            const macdData = calculateMACD(closes);
                            const latestSmas: Record<number, number | null> = {};
                            smaPeriods.forEach(p => { latestSmas[p] = smaData[p][smaData[p].length - 1]; });

                            const validation = validateSmaCriteria(currentPrice, latestSmas, smaPeriods);
                            const volumeInfo = checkVolumeSpike(volumes);

                            if (validation) {
                                const mLine = macdData.macdLine;
                                const sLine = macdData.signalLine;
                                const len = mLine.length;
                                let macdStatus = 'Neutral';
                                if (len >= 2) {
                                    const currM = mLine[len - 1], prevM = mLine[len - 2];
                                    const currS = sLine[len - 1], prevS = sLine[len - 2];
                                    if (currM !== null && prevM !== null && currS !== null && prevS !== null) {
                                        if (currM > currS && prevM <= prevS) macdStatus = 'Golden Cross';
                                        else if (currM < currS && prevM >= prevS) macdStatus = 'Dead Cross';
                                        else if (currM > currS) macdStatus = 'Above Signal';
                                        else macdStatus = 'Below Signal';
                                    }
                                }

                                resultsAwan.push({
                                    ticker, price: currentPrice, volume: currentVolume,
                                    volumeRatio: volumeInfo.ratio, isVolumeSpike: volumeInfo.isSpike,
                                    isRocket: volumeInfo.isRocket, macdStatus, ...validation,
                                    smaFullData: { 10: smaData[10].slice(-40), 20: smaData[20].slice(-40), 50: smaData[50].slice(-40), 100: smaData[100].slice(-40) },
                                    ohlcData: validDaily.slice(-40).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                    sparkline: closes.slice(-40)
                                });
                                console.log(`[AWAN] FOUND: ${ticker}`);
                            }
                        }

                        // Check Cari Bottom
                        const smaDataBottom = calculateMultipleSMAs(closes, [10, 20, 50, 100, 200]);
                        const macdDataBottom = calculateMACD(closes);
                        const volumeInfoBottom = checkVolumeSpike(volumes);
                        const bottomResult = checkCariBottom(
                            closes, opens, lows,
                            smaDataBottom[10], smaDataBottom[20], smaDataBottom[50], smaDataBottom[100],
                            macdDataBottom.macdLine, macdDataBottom.signalLine
                        );
                        if (bottomResult.isValid) {
                            resultsBottom.push({
                                ticker, price: currentPrice, volume: currentVolume,
                                volumeRatio: volumeInfoBottom.ratio, isVolumeSpike: volumeInfoBottom.isSpike,
                                gainFromCross: bottomResult.gainPercentage,
                                smaValues: { '10': smaDataBottom[10][smaDataBottom[10].length - 1], '20': smaDataBottom[20][smaDataBottom[20].length - 1] },
                                smaFullData: { 10: smaDataBottom[10].slice(-40), 20: smaDataBottom[20].slice(-40), 50: smaDataBottom[50].slice(-40), 100: smaDataBottom[100].slice(-40) },
                                ohlcData: validDaily.slice(-40).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                sparkline: closes.slice(-40)
                            });
                            console.log(`[BOTTOM] FOUND: ${ticker}`);
                        }
                    }
                }

                // 2. TURNAROUND logic (Monthly)
                if (monthlyData && monthlyData.length >= 6) {
                    const validMonthly = (monthlyData as any[]).filter(d => d.close !== null && d.close !== undefined);
                    if (validMonthly.length >= 6) {
                        const mCloses = validMonthly.map(d => d.close);
                        const mVolumes = validMonthly.map(d => d.volume || 0);
                        const mMacd = calculateMACD(mCloses);
                        const isTurnaround = checkTurnaround(mCloses, mVolumes, mMacd.macdLine, mMacd.signalLine);
                        if (isTurnaround) {
                            const volumeInfoT = checkVolumeSpike(mVolumes, 6);
                            
                            // Find MACD cross index to calculate gain from signal
                            let crossIndex = -1;
                            for (let j = mMacd.macdLine.length - 1; j >= 1; j--) {
                                if (mMacd.macdLine[j]! > mMacd.signalLine[j]! && mMacd.macdLine[j-1]! <= mMacd.signalLine[j-1]!) {
                                    crossIndex = j;
                                    break;
                                }
                            }
                            const crossPrice = crossIndex !== -1 ? mCloses[crossIndex] : mCloses[mCloses.length - 1];
                            const gainFromCross = ((mCloses[mCloses.length - 1] - crossPrice) / crossPrice) * 100;

                            resultsTurnaround.push({
                                ticker, price: mCloses[mCloses.length - 1], volume: mVolumes[mVolumes.length - 1],
                                isVolumeSpike: volumeInfoT.isSpike, volumeRatio: volumeInfoT.ratio, smaValues: {},
                                gainFromCross,
                                sparkline: mCloses.slice(-40)
                            });
                            console.log(`[TURNAROUND] FOUND: ${ticker}`);
                        }
                    }
                }
            } catch (e) {
                console.error(`Error processing ${ticker}:`, e);
            }
        }));

        // Delay after each batch for rate limiting
        const baseDelay = 1200; // Slightly faster delay since we are doing more work per batch but fewer batches total
        const jitter = Math.random() * 300;
        await sleep(baseDelay + jitter); 
    }

    return {
        diatas_awan: resultsAwan,
        cari_bottom: resultsBottom,
        turnaround: resultsTurnaround
    };
}

async function main() {
    process.on('uncaughtException', (err) => {
        console.error('UNCAUGHT EXCEPTION:', err);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
        process.exit(1);
    });

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    console.log('--- Optimized Screening Script Started ---');
    
    if (!adminEmail || !adminPassword) {
        console.error("FATAL: ADMIN_EMAIL/PASSWORD not set.");
        process.exit(1);
    }

    let email = adminEmail.trim();
    if (!email.includes('@')) email = `${email}@nexus.stock`;

    try {
        console.log(`Authenticating with Firebase as ${email}...`);
        await signInWithEmailAndPassword(auth, email, adminPassword);
        console.log('Authenticated successfully.');

        const IS_TEST = process.env.IS_TEST === 'true';
        const tickersToRun = IS_TEST ? IDX_TICKERS.slice(0, 10) : IDX_TICKERS;

        console.log(`Starting optimized single-pass job for ${tickersToRun.length} tickers...`);

        const allResults = await processAllTickers(tickersToRun);

        console.log(`\nScreening complete. Saving all results atomically...`);
        const timestamp = Date.now();
        
        await Promise.all([
            setDoc(doc(db, 'system', 'screening_results_diatas_awan'), { results: allResults.diatas_awan, timestamp }),
            setDoc(doc(db, 'system', 'screening_results_cari_bottom'), { results: allResults.cari_bottom, timestamp }),
            setDoc(doc(db, 'system', 'screening_results_turnaround'), { results: allResults.turnaround, timestamp })
        ]);

        console.log('All results saved successfully to Firestore.');
        process.exit(0);
    } catch (e: any) {
        console.error("FATAL ERROR:", e);
        process.exit(1);
    }
}

main().catch(err => {
    console.log(`[${new Date().toISOString()}] Top-level main() failed:`, err);
    process.exit(1);
});
