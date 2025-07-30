// Universal QR code system - using environment variable
export const verifyQrPayload = (qrPayload) => {
  try {
    console.log("🔍 Verifying QR payload:", {
      qrPayload,
      type: typeof qrPayload,
    });

    // Simple validation for universal QR format
    // Check if it matches our universal QR identifier from environment
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
};
