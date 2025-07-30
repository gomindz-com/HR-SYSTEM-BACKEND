import { verifyQrPayload } from "./lib/utils.js";

console.log("🧪 Testing QR Code Validation...\n");

// Test cases
const testCases = [
  "ATTENDANCE_QR_2025", // Should pass
  "ATTENDANCE_QR_2024", // Should fail
  "invalid_qr", // Should fail
  "", // Should fail
  null, // Should fail
  undefined, // Should fail
  123, // Should fail
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: Testing "${testCase}"`);
  const result = verifyQrPayload(testCase);
  console.log(`Result: ${result ? "✅ PASS" : "❌ FAIL"}`);
  if (result) {
    console.log(`Data:`, result);
  }
  console.log("---");
});

console.log("✅ QR validation tests completed!");
