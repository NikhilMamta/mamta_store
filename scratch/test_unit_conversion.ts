import { convertIssueToBaseUOM, convertBaseToIssueUOM, getFactorFromMaster, getIssueUomFromMaster } from '../src/lib/unitConversion';

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function runTests() {
    console.log("Running unit conversion helper tests...");

    // Test convertIssueToBaseUOM
    assert(convertIssueToBaseUOM(200, 1000) === 0.2, "200 ml / 1000 = 0.2 LTR");
    assert(convertIssueToBaseUOM(5, 0) === 5, "Factor 0 should safe-fallback to 1");
    assert(convertIssueToBaseUOM(5, -1) === 5, "Factor -1 should safe-fallback to 1");
    assert(convertIssueToBaseUOM(6, 12) === 0.5, "6 pcs / 12 = 0.5 Box");

    // Test convertBaseToIssueUOM
    assert(convertBaseToIssueUOM(2, 1000) === 2000, "2 LTR * 1000 = 2000 ml");
    assert(convertBaseToIssueUOM(5, 0) === 5, "Factor 0 should safe-fallback to 1");
    assert(convertBaseToIssueUOM(0.5, 12) === 6, "0.5 Box * 12 = 6 pcs");

    // Test getFactorFromMaster
    const mockFactors: Record<number, number> = {
        101: 1000,
        102: 12
    };
    assert(getFactorFromMaster(101, mockFactors) === 1000, "Should get 1000 for item 101");
    assert(getFactorFromMaster(999, mockFactors) === 1, "Should fallback to 1 for unconfigured item");
    assert(getFactorFromMaster(undefined, mockFactors) === 1, "Should fallback to 1 for undefined item");

    // Test getIssueUomFromMaster
    const mockUoms: Record<number, string> = {
        101: 'ml',
        102: 'pcs'
    };
    assert(getIssueUomFromMaster(101, mockUoms) === 'ml', "Should get 'ml' for item 101");
    assert(getIssueUomFromMaster(999, mockUoms) === undefined, "Should get undefined for unconfigured item");

    console.log("All unit conversion utility tests passed successfully! ✅");
}

try {
    runTests();
} catch (error: any) {
    console.error("Test suite failed:", error.message);
    process.exit(1);
}
