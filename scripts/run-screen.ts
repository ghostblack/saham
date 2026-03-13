import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { IDX_TICKERS } from '../src/lib/tickers';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike, checkTurnaround, checkCariBottom } from '../src/lib/screener';
import { calculateMultipleSMAs, calculateMACD } from '../src/lib/indicators';

// Delay helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runStrategy(strategy: 'diatas_awan' | 'cari_bottom' | 'turnaround', tickers: typeof IDX_TICKERS) {
    console.log(`\n--- Starting Strategy: ${strategy} ---`);
    const results = [];
    const period2 = new Date();
    const period1 = new Date();

    if (strategy === 'turnaround') {
        period1.setFullYear(period2.getFullYear() - 3); // 3 years for monthly
    } else {
        period1.setFullYear(period2.getFullYear() - 1); // 1 year for daily
    }

    const interval = strategy === 'turnaround' ? '1mo' : '1d';
    const minDataLen = strategy === 'turnaround' ? 6 : 200;

    for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        
        if (i % 50 === 0 && i !== 0) {
            console.log(`Processed ${i}/${tickers.length} tickers for ${strategy}...`);
        }

        try {
            const data = await getHistoricalData(ticker, period1, period2, interval as any);
            await sleep(1000); // 1 second delay per ticker to respect Yahoo Finance limits!

            if (!data || data.length < minDataLen) continue;

            const validData = (data as any[]).filter(d => d.close !== null && d.close !== undefined);
            if (validData.length < minDataLen) continue;

            const closes = validData.map(d => d.close);
            const volumes = validData.map(d => d.volume || 0);
            const opens = validData.map(d => d.open);
            const highs = validData.map(d => d.high);
            const lows = validData.map(d => d.low);

            const currentPrice = closes[closes.length - 1];
            const currentVolume = volumes[volumes.length - 1];
            const currentOpen = opens[opens.length - 1];

            let isValid = false;
            let validationData: any = {};

            if (strategy === 'cari_bottom') {
                const smaData = calculateMultipleSMAs(closes, [10, 20, 50, 100, 200]);
                const macdData = calculateMACD(closes);
                const result = checkCariBottom(
                    closes, opens, lows,
                    smaData[10], smaData[20], smaData[50], smaData[100],
                    macdData.macdLine, macdData.signalLine
                );
                isValid = result.isValid;
                if (isValid) {
                    validationData = {
                        volumeRatio: 0,
                        gainFromCross: result.gainPercentage,
                        smaValues: {
                            '10': smaData[10][smaData[10].length - 1] || 0,
                            '20': smaData[20][smaData[20].length - 1] || 0
                        },
                        smaFullData: {
                            10: smaData[10].slice(-40),
                            20: smaData[20].slice(-40),
                            50: smaData[50].slice(-40),
                            100: smaData[100].slice(-40)
                        },
                        ohlcData: validData.slice(-40).map(d => ({
                            x: new Date(d.date).getTime(),
                            y: [d.open, d.high, d.low, d.close]
                        }))
                    };
                }
            } else if (strategy === 'turnaround') {
                const macdData = calculateMACD(closes);
                isValid = checkTurnaround(closes, volumes, macdData.macdLine, macdData.signalLine);
                if (isValid) {
                    validationData = {
                        isVolumeSpike: true,
                        volumeRatio: 1,
                        smaValues: {}
                    };
                }
            } else {
                // diatas_awan
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

                        isValid = true;
                        validationData = {
                            volumeRatio: volumeInfo.ratio,
                            isVolumeSpike: volumeInfo.isSpike,
                            isRocket: volumeInfo.isRocket,
                            macdStatus,
                            ...validation,
                            smaFullData: {
                                10: smaData[10].slice(-40),
                                20: smaData[20].slice(-40),
                                50: smaData[50].slice(-40),
                                100: smaData[100].slice(-40)
                            },
                            ohlcData: validData.slice(-40).map(d => ({
                                x: new Date(d.date).getTime(),
                                y: [d.open, d.high, d.low, d.close]
                            }))
                        };
                    }
                }
            }

            if (isValid) {
                console.log(`[${strategy}] FOUND: ${ticker}`);
                results.push({
                    ticker,
                    price: currentPrice,
                    volume: currentVolume,
                    ...validationData,
                    sparkline: closes.slice(-40)
                });
            }
        } catch (e) {
            console.error(`Error processing ${ticker} for ${strategy}:`, e);
        }
    }

    // Save to Firestore
    try {
        console.log(`\nSaving ${results.length} results to system/screening_results_${strategy}`);
        const cacheRef = doc(db, 'system', `screening_results_${strategy}`);
        await setDoc(cacheRef, { results, timestamp: Date.now() });
        console.log('Saved successfully.');
    } catch (e) {
        console.error(`Failed to save to Firestore for ${strategy}:`, e);
    }
}

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        console.error("FATAL: ADMIN_EMAIL or ADMIN_PASSWORD not set in environment.");
        process.exit(1);
    }

    try {
        console.log('Authenticating with Firebase...');
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        console.log('Authenticated successfully.');

        // Take a small subset if testing
        const IS_TEST = process.env.IS_TEST === 'true';
        const tickersToRun = IS_TEST ? IDX_TICKERS.slice(0, 10) : IDX_TICKERS;

        console.log(`Starting screening job for ${tickersToRun.length} tickers...`);

        await runStrategy('diatas_awan', tickersToRun);
        await runStrategy('cari_bottom', tickersToRun);
        await runStrategy('turnaround', tickersToRun);

        console.log('\nAll screening jobs completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error("FATAL ERROR in main loop:", e);
        process.exit(1);
    }
}

main();
