import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { IDX_TICKERS } from '../src/lib/tickers';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike, checkTurnaround, checkBottoming, checkDiatasAwanTiered, isHammerPattern } from '../src/lib/screener';
import { calculateMultipleSMAs, calculateMACD, calculateRSI } from '../src/lib/indicators';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Delay helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function processAllTickers(tickers: typeof IDX_TICKERS) {
    console.log(`\n--- [${new Date().toLocaleTimeString()}] Starting Optimized Screening ---`);
    const resultsAwan: any[] = [];
    const resultsBottom: any[] = [];
    const resultsTurnaround: any[] = [];

    const period2 = new Date();
    const periodDaily1 = new Date();
    periodDaily1.setFullYear(period2.getFullYear() - 1);
    
    const periodMonthly1 = new Date();
    periodMonthly1.setFullYear(period2.getFullYear() - 3);

    // --- PHASE 1: PRE-FILTERING (DISABLED - Using all tickers) ---
    const liquidTickers = tickers;
    console.log(`Phase 1 Pre-filter skipped. Processing all ${liquidTickers.length} tickers.`);

    // --- PHASE 2: DETAILED SCREENING ---
    const CHUNK_SIZE = 3; // Reduced concurrency for stability
    for (let i = 0; i < liquidTickers.length; i += CHUNK_SIZE) {
        const chunk = liquidTickers.slice(i, i + CHUNK_SIZE);
        
        if (i % 30 === 0 && i !== 0) {
            console.log(`Progress: ${i}/${liquidTickers.length} processed...`);
        }

        await Promise.all(chunk.map(async (ticker) => {
            try {
                // Stochastic delay to avoid robotic patterns
                await sleep(Math.random() * 500);

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
                        const highs = validDaily.map(d => d.high);
                        const currentPrice = closes[closes.length - 1];
                        const currentVolume = volumes[volumes.length - 1];
                        const currentOpen = opens[opens.length - 1];

                        // Check Diatas Awan
                        // Check Diatas Awan (Tiered)
                        const smaPeriodsAwan = [3, 5, 10, 20, 50, 100];
                        const smaDataAwan = calculateMultipleSMAs(closes, smaPeriodsAwan);
                        const macdDataAwan = calculateMACD(closes);
                        const volumeInfoAwan = checkVolumeSpike(volumes, 10);
                        
                        const latestSmasAwan: Record<number, number | null> = {};
                        smaPeriodsAwan.forEach(p => { latestSmasAwan[p] = smaDataAwan[p][smaDataAwan[p].length - 1]; });

                        const tieredResult = checkDiatasAwanTiered(currentPrice, volumes, latestSmasAwan, macdDataAwan.macdLine, macdDataAwan.signalLine);
                        
                        if (tieredResult.isValid) {
                            resultsAwan.push({
                                ticker, price: currentPrice, volume: currentVolume,
                                volumeRatio: volumeInfoAwan.ratio, isVolumeSpike: volumeInfoAwan.isSpike,
                                tier: tieredResult.tier, // "Emas", "Silver"
                                status: tieredResult.status, // "Beli Sekarang", "Mulai Beli"
                                smaValues: latestSmasAwan,
                                ohlcData: validDaily.slice(-40).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                sparkline: closes.slice(-40)
                            });
                            console.log(`[AWAN] FOUND (${tieredResult.tier}): ${ticker}`);
                        }

                        // Check Bottoming (Reversal)
                        const smaDataM = calculateMultipleSMAs(closes, [5, 10, 20, 50, 100]);
                        const macdDataM = calculateMACD(closes);
                        const bResult = checkBottoming(
                            closes, opens, highs, lows, volumes,
                            smaDataM[5], smaDataM[10], smaDataM[20], smaDataM[50], smaDataM[100],
                            macdDataM.macdLine, macdDataM.signalLine
                        );
                        
                        if (bResult.isValid) {
                            resultsBottom.push({
                                ticker, price: currentPrice, volume: currentVolume,
                                volumeRatio: bResult.volumeRatio, isVolumeSpike: true,
                                gainFromCross: bResult.gainPercentage,
                                smaValues: {
                                    '10': smaDataM[10][smaDataM[10].length - 1] || 0,
                                    '20': smaDataM[20][smaDataM[20].length - 1] || 0
                                },
                                ohlcData: validDaily.slice(-40).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                sparkline: closes.slice(-40)
                            });
                            console.log(`[BOTTOMING] FOUND: ${ticker}`);
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
                                ohlcData: validMonthly.slice(-12).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                sparkline: mCloses.slice(-12)
                            });
                            console.log(`[TURNAROUND] FOUND: ${ticker}`);
                        }
                    }
                }
            } catch (e: any) {
                console.error(`Error processing ${ticker}:`, e.message);
            }
        }));
    }

    return {
        diatas_awan: resultsAwan,
        cari_bottom: resultsBottom,
        turnaround: resultsTurnaround
    };
}

async function main() {
    let email = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!email || !adminPassword) {
        console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD ENV.");
        process.exit(1);
    }

    // Auto-append domain if missing (as per README instructions)
    if (!email.includes('@')) {
        email = `${email}@nexus.stock`;
    }

    try {
        console.log(`Authenticating with Firebase as ${email}...`);
        await signInWithEmailAndPassword(auth, email, adminPassword);
        console.log('Authenticated successfully.');

        const IS_TEST = process.env.IS_TEST === 'true';
        const tickersToRun = IS_TEST ? IDX_TICKERS.slice(0, 10) : IDX_TICKERS;

        console.log(`Starting optimized screening job for ${tickersToRun.length} tickers...`);

        const allResults = await processAllTickers(tickersToRun);

        console.log(`\nScreening complete. Saving all results atomically...`);
        const timestamp = Date.now();
        
        await Promise.all([
            setDoc(doc(db, 'system', 'screening_results_diatas_awan'), { results: allResults.diatas_awan, timestamp }),
            setDoc(doc(db, 'system', 'screening_results_membumi'), { results: allResults.cari_bottom, timestamp }),
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
