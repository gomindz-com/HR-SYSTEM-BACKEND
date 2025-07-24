import jwt from "jsonwebtoken";

const OFFLINE_GRACE_PERIOD_SECONDS = 15 * 60; // 15 minutes grace

export const verifyQrPayloadOfflineAware = (qrPayload, scannedAt) => {
  try {
    const decoded = jwt.decode(qrPayload, { complete: true });
    if (!decoded) throw new Error("Invalid token");

    const payload = decoded.payload;
    const issuedAt = payload.iat; // seconds since epoch
    const expiresAt = payload.exp;

    const scannedTimestamp = Math.floor(new Date(scannedAt).getTime() / 1000);

    // Check if scannedAt is within valid token lifetime + grace period
    if (
      scannedTimestamp < issuedAt ||
      scannedTimestamp > expiresAt + OFFLINE_GRACE_PERIOD_SECONDS
    ) {
      throw new Error("Token expired for scanned timestamp");
    }

    // Verify signature and expiration normally
    jwt.verify(qrPayload, process.env.QR_SECRET);

    return payload;
  } catch (error) {
    console.log("Error in Verify Qr Payload Offline Aware", error);
    return null;
  }
};

export const generateQrJwt = (companyId) => {
  const payload = {
    data: {
      companyId,
    },
  };

  const token = jwt.sign(payload, process.env.QR_SECRET, { expiresIn: "5m" });
  return token;
};
