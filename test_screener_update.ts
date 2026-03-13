import { validateSmaCriteria, checkVolumeSpike } from "./src/lib/screener";

function testValidateSmaCriteria() {
    console.log("Testing validateSmaCriteria...");

    const smas = {
        5: 105,
        10: 100,
        20: 95,
        50: 90,
        100: 85,
        200: 80
    };

    // Case 1: Above all core MAs (10, 20, 50, 100) and within 5% distance
    const price1 = 104; // max core SMA is 100. 104 is 4% above 100.
    const result1 = validateSmaCriteria(price1, smas, [5, 10, 20, 50, 100]);
    console.log("Result 1 (Expect Ketat):", result1?.status);
    if (result1?.status !== 'Ketat') console.error("FAILED Case 1");

    // Case 2: Above MA 5 (Super Ketat)
    const price2 = 106; // max core SMA is 100. MA5 is 105. 106 is 6% above 100 -> SHOULD FAIL distance check (max 5%)? 
    // Wait, the user said "jarak ke MA terdekatnya belum naik diatas 5% maksimal".
    // MA terdekat from above is the highest core MA (MA100 in this case).
    // Let's adjust smas for Case 2 to be Super Ketat but still within 5% of MA100.
    const price2_fixed = 104.5;
    const smas2 = { ...smas, 5: 104 };
    const result2 = validateSmaCriteria(price2_fixed, smas2, [5, 10, 20, 50, 100]);
    console.log("Result 2 (Expect Super Ketat):", result2?.status);
    if (result2?.status !== 'Super Ketat') console.error("FAILED Case 2");

    // Case 3: Distance > 5%
    const price3 = 106; // 6% above 100
    const result3 = validateSmaCriteria(price3, smas, [5, 10, 20, 50, 100]);
    console.log("Result 3 (Expect null - distance > 5%):", result3);
    if (result3 !== null) console.error("FAILED Case 3");

    // Case 4: Below core MA (e.g. MA 10)
    const price4 = 99; // below MA 10 (100)
    const result4 = validateSmaCriteria(price4, smas, [5, 10, 20, 50, 100]);
    console.log("Result 4 (Expect null - below MA 10):", result4);
    if (result4 !== null) console.error("FAILED Case 4");
}

function testCheckVolumeSpike() {
    console.log("\nTesting checkVolumeSpike...");

    const volumes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 250];
    const result1 = checkVolumeSpike(volumes);
    console.log("Result 1 (Expect isSpike: true, isRocket: true):", result1);
    if (!result1.isSpike || !result1.isRocket) console.error("FAILED Volume Case 1");

    const volumes2 = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 110];
    const result2 = checkVolumeSpike(volumes2);
    console.log("Result 2 (Expect isSpike: false, isRocket: true):", result2);
    if (result2.isSpike || !result1.isRocket) console.error("FAILED Volume Case 2");
}

testValidateSmaCriteria();
testCheckVolumeSpike();
