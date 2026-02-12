import crypto from "crypto";

const SIGNATURE_HEADER = "x-dolynk-signature";

/**
 * Verify DoLynk webhook signature: HMAC-SHA256 of raw body with DAHUA_APP_SECRET.
 * Compare with x-dolynk-signature header using timing-safe comparison.
 */
export function verifyDolynkSignature(req, res, next) {
  const secret = process.env.DAHUA_APP_SECRET;
  if (!secret) {
    return res.status(500).send("Server misconfiguration");
  }

  const rawBody = req.rawBody;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    return res.status(401).send("Invalid request");
  }

  const received = req.headers[SIGNATURE_HEADER] || req.headers["X-Dolynk-Signature"];
  if (!received || typeof received !== "string" || !received.trim()) {
    return res.status(401).send("Missing signature");
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expectedHex = hmac.digest("hex");
  const receivedTrimmed = received.trim();

  if (receivedTrimmed.length !== expectedHex.length) {
    return res.status(401).send("Invalid signature");
  }

  try {
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const receivedBuf = Buffer.from(receivedTrimmed, "hex");
    if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return res.status(401).send("Invalid signature");
    }
  } catch (_) {
    return res.status(401).send("Invalid signature");
  }

  next();
}
