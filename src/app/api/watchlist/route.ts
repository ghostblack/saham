import { NextResponse } from 'next/server';
import { getHistoricalData } from '@/lib/screener';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',') || [];

    if (symbols.length === 0) {
        return NextResponse.json({ results: [] });
    }

    const period2 = new Date();
    const period1 = new Date();
    period1.setDate(period2.getDate() - 7); // Just need last few days for current price

    const results = await Promise.all(symbols.map(async (symbol) => {
        try {
            const data = await getHistoricalData(symbol, period1, period2);
            if (!data || data.length === 0) return null;

            const lastEntry = data[data.length - 1];
            return {
                ticker: symbol,
                currentPrice: lastEntry.close,
                change: 0 // Will calculate on frontend
            };
        } catch (e) {
            return null;
        }
    }));

    return NextResponse.json({ results: results.filter(r => r !== null) });
}
