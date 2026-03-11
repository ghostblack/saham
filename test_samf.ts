import { getHistoricalData, validateSmaCriteria, checkVolumeSpike } from "./src/lib/screener";
import { calculateMultipleSMAs } from "./src/lib/indicators";

async function checkSAMF() {
    const period2 = new Date();
    const period1 = new Date();
    period1.setFullYear(period2.getFullYear() - 1);

    const ticker = "SAMF";
    const data = await getHistoricalData(ticker, period1, period2, '1d');
    
    if (!data) {
        console.log("No data for SAMF");
        return;
    }

    const closes = data.map((d: any) => d.close);
    const volumes = data.map((d: any) => d.volume);
    const opens = data.map((d: any) => d.open);

    const currentPrice = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];
    const currentOpen = opens[opens.length - 1];

    console.log(`Current Price: ${currentPrice}`);
    console.log(`Current Open: ${currentOpen}`);
    console.log(`Current Volume: ${currentVolume}`);

    const gainFromOpen = (currentPrice - currentOpen) / currentOpen;
    console.log(`Gain from open: ${(gainFromOpen * 100).toFixed(2)}% (Limit: <= 5%) \nPasses? ${gainFromOpen <= 0.05}`);

    const SMA_PERIODS = [5, 10, 20, 50, 100, 200];
    const smaData = calculateMultipleSMAs(closes, SMA_PERIODS);
    
    const latestSmas: Record<number, number | null> = {};
    SMA_PERIODS.forEach(p => {
        const values = smaData[p];
        latestSmas[p] = values[values.length - 1];
    });

    console.log("\nSMA Values (latest):", latestSmas);
    
    const corePeriods = SMA_PERIODS.filter(p => p !== 5);
    const coreSmas = corePeriods.map(p => latestSmas[p]).filter((v): v is number => v !== null);

    const isAboveAllCore = coreSmas.every(sma => currentPrice > sma);
    console.log(`\nIs price above all core SMAs (10, 20, 50, 100, 200)? ${isAboveAllCore}`);

    const maxSma = Math.max(...coreSmas);
    const distance = (currentPrice - maxSma) / maxSma;
    console.log(`Distance from max SMA: ${(distance * 100).toFixed(2)}% (Limit: 0-3%)`);
    console.log(`Passes Distance? ${distance >= 0 && distance <= 0.03}`);

    const volumeInfo = checkVolumeSpike(volumes);
    console.log(`\nVolume Spike? ${volumeInfo.isSpike} (Ratio: ${volumeInfo.ratio.toFixed(2)}x)`);
}

checkSAMF();
