// Simple QR validation test
function verifyQrPayload(qrPayload) {
  try {
    console.log("🔍 Verifying QR payload:", {
      qrPayload,
      type: typeof qrPayload,
    });

    if (typeof qrPayload === "string" && qrPayload === "ATTENDANCE_QR_2025") {
      console.log("✅ QR payload validated successfully");
      return { isValid: true, data: qrPayload };
    }

    console.log("❌ QR payload validation failed:", {
      qrPayload,
      expected: "ATTENDANCE_QR_2025",
      isString: typeof qrPayload === "string",
      matches: qrPayload === "ATTENDANCE_QR_2025",
    });
    return null;
  } catch (error) {
    console.error("❌ Error in Verify Qr Payload", error);
    return null;
  }
}

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
