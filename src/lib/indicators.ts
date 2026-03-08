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
