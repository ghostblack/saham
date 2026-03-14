import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { IDX_TICKERS } from '../src/lib/tickers';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike, checkTurnaroundFollowTrend, checkBottoming, checkDiatasAwanTiered, isHammerPattern } from '../src/lib/screener';
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
    
    const periodWeekly1 = new Date();
    periodWeekly1.setFullYear(period2.getFullYear() - 2);

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

                const [dailyData, weeklyData] = await Promise.all([
                    getHistoricalData(ticker, periodDaily1, period2, '1d'),
                    getHistoricalData(ticker, periodWeekly1, period2, '1wk')
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

                        // GLOBAL FILTER: Price must not have risen more than 5% from OPEN
                        const gainFromOpen = ((currentPrice - currentOpen) / currentOpen) * 100;
                        if (gainFromOpen > 5) {
                            return; // Skip this stock
                        }

                        // Check Diatas Awan
                        // Check Diatas Awan (Tiered)
                        const smaPeriodsAwan = [3, 5, 10, 20, 50, 100];
                        const smaDataAwan = calculateMultipleSMAs(closes, smaPeriodsAwan);
                        const macdDataAwan = calculateMACD(closes);
                        const volumeInfoAwan = checkVolumeSpike(volumes, 10);
                        
                        const latestSmasAwan: Record<number, number | null> = {};
                        smaPeriodsAwan.forEach(p => { latestSmasAwan[p] = smaDataAwan[p][smaDataAwan[p].length - 1]; });

                        const prevPriceAwan = closes[closes.length - 2];
                        const dailyChangePercentAwan = ((currentPrice - prevPriceAwan) / prevPriceAwan) * 100;

                        const tieredResult = checkDiatasAwanTiered(currentPrice, dailyChangePercentAwan, volumes, latestSmasAwan, macdDataAwan.macdLine, macdDataAwan.signalLine);
                        
                        if (tieredResult.isValid) {
                            const rsiDataAwan = calculateRSI(closes);
                            const currentRsiAwan = rsiDataAwan[rsiDataAwan.length - 1];

                            resultsAwan.push({
                                ticker, price: currentPrice, volume: currentVolume,
                                volumeRatio: volumeInfoAwan.ratio, isVolumeSpike: volumeInfoAwan.isSpike,
                                tier: tieredResult.tier, // "Emas", "Silver"
                                status: tieredResult.status, // "Beli Sekarang", "Mulai Beli"
                                distance: tieredResult.distance,
                                rsi: currentRsiAwan,
                                smaValues: latestSmasAwan,
                                ohlcData: validDaily.slice(-40).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                sparkline: closes.slice(-40)
                            });
                            console.log(`[AWAN] FOUND (${tieredResult.tier}): ${ticker}`);
                        }

                        // Check Bottoming (Reversal)
                        const smaDataM = calculateMultipleSMAs(closes, [3, 5, 10, 20, 50, 100, 200]);
                        const macdDataM = calculateMACD(closes);
                        const bResult = checkBottoming(
                            closes, opens, highs, lows, volumes,
                            smaDataM[5], smaDataM[10], smaDataM[20], smaDataM[50], smaDataM[100],
                            macdDataM.macdLine, macdDataM.signalLine
                        );
                        
                        if (bResult.isValid) {
                            const rsiDataM = calculateRSI(closes);
                            const currentRsiM = rsiDataM[rsiDataM.length - 1];
                            const ma3M = smaDataM[3][smaDataM[3].length - 1];
                            
                            let maTargetM: number | null = null;
                            let distanceToTargetM: number | null = null;
                            
                            // Find nearest MA above current price from [20, 50, 100, 200]
                            const targetPeriods = [20, 50, 100, 200];
                            for (const p of targetPeriods) {
                                const maVal = smaDataM[p][smaDataM[p].length - 1];
                                if (maVal && currentPrice < maVal) {
                                    maTargetM = p;
                                    distanceToTargetM = ((maVal - currentPrice) / currentPrice) * 100;
                                    break;
                                }
                            }

                            resultsBottom.push({
                                ticker, price: currentPrice, volume: currentVolume,
                                volumeRatio: bResult.volumeRatio, isVolumeSpike: true,
                                gainFromCross: bResult.gainPercentage,
                                rsi: currentRsiM,
                                distance: ma3M ? ((currentPrice - ma3M) / ma3M) * 100 : 0,
                                maTarget: maTargetM,
                                distanceToTarget: distanceToTargetM,
                                smaValues: {
                                    '3': ma3M || 0,
                                    '10': smaDataM[10][smaDataM[10].length - 1] || 0,
                                    '20': smaDataM[20][smaDataM[20].length - 1] || 0,
                                    '50': smaDataM[50][smaDataM[50].length - 1] || 0,
                                    '100': smaDataM[100][smaDataM[100].length - 1] || 0,
                                    '200': smaDataM[200][smaDataM[200].length - 1] || 0
                                },
                                ohlcData: validDaily.slice(-40).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                sparkline: closes.slice(-40)
                            });
                            console.log(`[BOTTOMING] FOUND: ${ticker}`);
                        }
                    }
                }

                // 2. TURNAROUND logic (Follow the Trend: Weekly + Daily + MA20 Retest)
                if (weeklyData && weeklyData.length >= 20 && dailyData && dailyData.length >= 60) {
                    const dCloses = (dailyData as any[]).map(d => d.close);
                    const dVolumes = (dailyData as any[]).map(d => d.volume || 0);
                    const dOpens = (dailyData as any[]).map(d => d.open);
                    const wCloses = (weeklyData as any[]).map(d => d.close);

                    const currentPriceT = dCloses[dCloses.length - 1];
                    const currentOpenT = dOpens[dOpens.length - 1];
                    const gainFromOpenT = ((currentPriceT - currentOpenT) / currentOpenT) * 100;

                    if (gainFromOpenT <= 5) {
                        const dMacd = calculateMACD(dCloses);
                        const wMacd = calculateMACD(wCloses);
                        const dSma = calculateMultipleSMAs(dCloses, [3, 20]);

                        const resultT = checkTurnaroundFollowTrend(
                            dCloses, dVolumes, dSma[20],
                            dMacd.macdLine, dMacd.signalLine,
                            wMacd.macdLine, wMacd.signalLine
                        );

                        if (resultT.isValid) {
                            const rsiDataT = calculateRSI(dCloses);
                            const currentRsiT = rsiDataT[rsiDataT.length - 1];
                            const dSmaExtra = calculateMultipleSMAs(dCloses, [3, 20, 50, 100, 200]);
                            const ma3T = dSmaExtra[3][dSmaExtra[3].length - 1];

                            let maTargetT: number | null = null;
                            let distanceToTargetT: number | null = null;
                            
                            // Find nearest MA above current price from [50, 100, 200]
                            const targetPeriods = [50, 100, 200];
                            for (const p of targetPeriods) {
                                const maVal = dSmaExtra[p][dSmaExtra[p].length - 1];
                                if (maVal && currentPriceT < maVal) {
                                    maTargetT = p;
                                    distanceToTargetT = ((maVal - currentPriceT) / currentPriceT) * 100;
                                    break;
                                }
                            }

                            resultsTurnaround.push({
                                ticker, price: currentPriceT, volume: dVolumes[dVolumes.length - 1],
                                status: resultT.status,
                                distanceToMA20: resultT.distanceToMA20,
                                distance: ma3T ? ((currentPriceT - ma3T) / ma3T) * 100 : 0,
                                rsi: currentRsiT,
                                maTarget: maTargetT,
                                distanceToTarget: distanceToTargetT,
                                smaValues: { 
                                    '3': ma3T,
                                    '20': dSmaExtra[20][dSmaExtra[20].length - 1],
                                    '50': dSmaExtra[50][dSmaExtra[50].length - 1],
                                    '100': dSmaExtra[100][dSmaExtra[100].length - 1],
                                    '200': dSmaExtra[200][dSmaExtra[200].length - 1]
                                },
                                ohlcData: (dailyData as any[]).slice(-40).map(d => ({ x: new Date(d.date).getTime(), y: [d.open, d.high, d.low, d.close] })),
                                sparkline: dCloses.slice(-40)
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
