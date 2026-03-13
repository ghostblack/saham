import { NextResponse } from 'next/server';
import { getHistoricalData, validateSmaCriteria, checkVolumeSpike } from '@/lib/screener';
import { calculateMultipleSMAs, calculateMACD } from '@/lib/indicators';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  
  try {
    const period2 = new Date();
    const period1 = new Date();
    period1.setFullYear(period2.getFullYear() - 1); // 1 year for daily

    let data = null;
    let retries = 3;
    let lastError = null;

    while (retries > 0) {
      try {
        data = await getHistoricalData(ticker, period1, period2, '1d');
        if (data && data.length > 0) break; // Success
      } catch (err) {
        lastError = err;
      }
      retries--;
      if (retries > 0) {
        console.warn(`Rate limit or error fetching ${ticker}, retrying in 1.5s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    if (!data || !Array.isArray(data) || data.length < 200) {
      return NextResponse.json({ error: `Not enough data for ticker ${ticker}` }, { status: 404 });
    }

    // Filter out invalid data entries
    const validData = (data as any[]).filter(d => d.close !== null && d.close !== undefined);
    
    if (validData.length < 200) {
        return NextResponse.json({ error: `Not enough valid data for ticker ${ticker}` }, { status: 404 });
    }

    const closes = validData.map(d => d.close);
    const volumes = validData.map(d => d.volume || 0);
    const opens = validData.map(d => d.open);
    const highs = validData.map(d => d.high);
    const lows = validData.map(d => d.low);

    const currentPrice = closes[closes.length - 1];
    const currentOpen = opens[opens.length - 1];

    const smaPeriods = [5, 10, 20, 50, 100];
    const smaData = calculateMultipleSMAs(closes, smaPeriods);
    const macdData = calculateMACD(closes);
    
    const latestSmas: Record<number, number | null> = {};
    smaPeriods.forEach(p => {
      const values = smaData[p];
      latestSmas[p] = values[values.length - 1];
    });

    const validation = validateSmaCriteria(currentPrice, latestSmas, smaPeriods);
    const volumeInfo = checkVolumeSpike(volumes);

    // Calculate MACD Status
    const mLine = macdData.macdLine;
    const sLine = macdData.signalLine;
    const len = mLine.length;
    let macdStatus = 'Neutral';

    if (len >= 2) {
      const currM = mLine[len - 1];
      const prevM = mLine[len - 2];
      const currS = sLine[len - 1];
      const prevS = sLine[len - 2];

      if (currM !== null && prevM !== null && currS !== null && prevS !== null) {
        if (currM > currS && prevM <= prevS) {
          macdStatus = 'Golden Cross';
        } else if (currM < currS && prevM >= prevS) {
          macdStatus = 'Dead Cross';
        } else if (currM > currS) {
          macdStatus = 'Above Signal';
        } else {
          macdStatus = 'Below Signal';
        }
      }
    }

    const result = {
      ticker,
      price: currentPrice,
      volume: volumes[volumes.length - 1],
      volumeRatio: volumeInfo.ratio,
      isVolumeSpike: volumeInfo.isSpike,
      isRocket: volumeInfo.isRocket,
      macdStatus,
      status: validation?.status || 'N/A',
      tightness: validation?.tightness || 0,
      distance: validation?.distance || 0,
      smaValues: validation?.smaValues || latestSmas,
      smaFullData: {
        10: smaData[10].slice(-40),
        20: smaData[20].slice(-40),
        50: smaData[50].slice(-40),
        100: smaData[100].slice(-40)
      },
      ohlcData: (data as any[]).slice(-40).map(d => ({
        x: new Date(d.date).getTime(),
        y: [d.open, d.high, d.low, d.close]
      })),
      sparkline: closes.slice(-40)
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error fetching detail for ${ticker}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
