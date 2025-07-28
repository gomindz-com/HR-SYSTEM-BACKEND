// Universal QR code system - using environment variable
export const verifyQrPayload = (qrPayload) => {
  try {
    // Simple validation for universal QR format
    // Check if it matches our universal QR identifier from environment
    if (
      typeof qrPayload === "string" &&
      qrPayload === process.env.UNIVERSAL_QR_CODE
    ) {
      return { isValid: true, data: qrPayload };
    }
    return null;
  } catch (error) {
    console.log("Error in Verify Qr Payload", error);
    return null;
  }
};
