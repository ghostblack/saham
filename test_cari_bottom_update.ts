import { checkCariBottom } from "./src/lib/screener";

function testCheckCariBottom() {
    console.log("Testing checkCariBottom...");

    // Generate dummy data: 60 points
    const closes = new Array(60).fill(100);
    const opens = new Array(60).fill(100);
    const lows = new Array(60).fill(95);
    const sma10 = new Array(60).fill(110);
    const sma20 = new Array(60).fill(115);
    const sma50 = new Array(60).fill(120);
    const sma100 = new Array(60).fill(130);
    const macdLine = new Array(60).fill(0);
    const signalLine = new Array(60).fill(0);

    // 1. Setup Downtrend: Price < all MAs (10, 20, 50, 100)
    // In our case, 100 < 110, 115, 120, 130. This is already a downtrend.

    // 2. Setup Golden Cross: MA 10 crosses MA 20 upwards at index 50
    for (let i = 50; i < 60; i++) {
        sma10[i] = 120; // Above MA 20
        sma20[i] = 118;
    }
    // Cross-check: at index 50, curr10=120, prev10=110, curr20=118, prev20=115. 
    // prev10(110) <= prev20(115) AND curr10(120) > curr20(118) -> Cross!

    // 3. Setup Price Bounce at MA 20: 
    // Latest close (index 59) should be above MA 20 (118) but <= 3% distance.
    const latestMA20 = 118;
    closes[59] = latestMA20 * 1.02; // 120.36 (2% above)
    sma10[59] = 122; // Stay above MA 20

    const result1 = checkCariBottom(closes, opens, lows, sma10, sma20, sma50, sma100, macdLine, signalLine);
    console.log("Result 1 (Expect Valid):", result1.isValid);
    if (!result1.isValid) console.error("FAILED Case 1");

    // Case 2: Distance too far (> 3%)
    closes[59] = latestMA20 * 1.05; // 5% above
    const result2 = checkCariBottom(closes, opens, lows, sma10, sma20, sma50, sma100, macdLine, signalLine);
    console.log("Result 2 (Expect Invalid - distance too far):", result2.isValid);
    if (result2.isValid) console.error("FAILED Case 2");

    // Case 3: Price below MA 20
    closes[59] = latestMA20 * 0.98; // 2% below
    const result3 = checkCariBottom(closes, opens, lows, sma10, sma20, sma50, sma100, macdLine, signalLine);
    console.log("Result 3 (Expect Invalid - below MA 20):", result3.isValid);
    if (result3.isValid) console.error("FAILED Case 3");
}

testCheckCariBottom();
