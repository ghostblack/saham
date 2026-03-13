/**
 * Calculates the Simple Moving Average (SMA) for a given set of data points.
 * @param data Array of numbers (usually closing prices).
 * @param period The number of periods for the SMA.
 * @returns An array of SMA values, where the first (period - 1) values are null or undefined.
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  if (data.length < period) {
    return new Array(data.length).fill(null);
  }

  const sma: (number | null)[] = new Array(data.length).fill(null);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period];
    }
    if (i >= period - 1) {
      sma[i] = sum / period;
    }
  }

  return sma;
}

/**
 * Calculates multiple SMAs at once.
 */
export function calculateMultipleSMAs(data: number[], periods: number[]) {
  const results: Record<number, (number | null)[]> = {};
  periods.forEach((period) => {
    results[period] = calculateSMA(data, period);
  });
  return results;
}

/**
 * Calculates the Exponential Moving Average (EMA).
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
  if (data.length < period) {
    return new Array(data.length).fill(null);
  }

  const ema: (number | null)[] = new Array(data.length).fill(null);

  // Calculate initial SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / period;

  const multiplier = 2 / (period + 1);

  // Calculate EMA for the rest of the data
  for (let i = period; i < data.length; i++) {
    const prevEma = ema[i - 1] as number;
    ema[i] = (data[i] - prevEma) * multiplier + prevEma;
  }

  return ema;
}

/**
 * Calculates the MACD (Moving Average Convergence Divergence).
 * Returns macdLine, signalLine, and histogram.
 */
export function calculateMACD(
  data: number[],
  shortPeriod: number = 12,
  longPeriod: number = 26,
  signalPeriod: number = 9
) {
  const shortEma = calculateEMA(data, shortPeriod);
  const longEma = calculateEMA(data, longPeriod);

  const macdLine: (number | null)[] = new Array(data.length).fill(null);
  const macdLineForSignal: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (shortEma[i] !== null && longEma[i] !== null) {
      const macdVal = (shortEma[i] as number) - (longEma[i] as number);
      macdLine[i] = macdVal;
      macdLineForSignal.push(macdVal);
    }
  }

  const signalEma = calculateEMA(macdLineForSignal, signalPeriod);

  const signalLine: (number | null)[] = new Array(data.length).fill(null);
  const histogram: (number | null)[] = new Array(data.length).fill(null);

  // Align the signal line back to the original data's indices
  let signalIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] !== null) {
      if (signalEma[signalIdx] !== null) {
        signalLine[i] = signalEma[signalIdx];
        histogram[i] = (macdLine[i] as number) - (signalLine[i] as number);
      }
      signalIdx++;
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates the Relative Strength Index (RSI).
 * @param data Array of closing prices.
 * @param period The period for RSI (standard is 14).
 */
export function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  if (data.length <= period) {
    return new Array(data.length).fill(null);
  }

  const rsi: (number | null)[] = new Array(data.length).fill(null);
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    }

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsi;
}
