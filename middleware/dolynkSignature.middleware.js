import crypto from "crypto";

const SIGNATURE_HEADER = "x-dolynk-signature";
const DEBUG_SIGNATURE = process.env.DOLYNK_DEBUG_SIGNATURE === "true";
/** Allow requests with no signature header (e.g. ngrok strips it). Set false or unset in production. */
const ALLOW_NO_SIGNATURE = process.env.DOLYNK_ALLOW_NO_SIGNATURE === "true";

/** Possible header names DoLynk might use (Express lowercases keys). */
const SIGNATURE_HEADER_ALTS = [
  "x-dolynk-signature",
  "signature",
  "x-signature",
  "x-webhook-signature",
];

/**
 * Strip optional prefix from signature header (e.g. "sha256=..." or "SHA256=...").
 */
function stripSignaturePrefix(value) {
  const s = value.trim();
  const lower = s.toLowerCase();
  if (lower.startsWith("sha256=")) return s.slice(7).trim();
  return s;
}

/**
 * Verify DoLynk webhook signature: HMAC-SHA256 of raw body with DAHUA_APP_SECRET.
 * Supports both hex and base64 encoding; strips optional "sha256=" prefix.
 */
export function verifyDolynkSignature(req, res, next) {
  // Use AppSecret only (trim to avoid hidden spaces from copy-paste)
  const secret = (process.env.DAHUA_APP_SECRET || "").trim();
  if (!secret) {
    return res.status(500).send("Server misconfiguration");
  }

  const rawBody = req.rawBody;
  if (DEBUG_SIGNATURE) {
    console.log("[DoLynk] --- Incoming request ---");
    console.log("[DoLynk] rawBody present:", !!rawBody, "isBuffer:", rawBody ? Buffer.isBuffer(rawBody) : false, "length:", rawBody?.length ?? 0);
    const headerKeys = Object.keys(req.headers || {}).filter((k) => k.toLowerCase().includes("dolynk") || k.toLowerCase().includes("signature") || k.toLowerCase().includes("x-"));
    console.log("[DoLynk] Relevant headers:", headerKeys);
    headerKeys.forEach((k) => console.log("[DoLynk]   ", k, "=>", typeof req.headers[k] === "string" ? req.headers[k].slice(0, 60) + (req.headers[k].length > 60 ? "..." : "") : req.headers[k]));
  }

  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    if (DEBUG_SIGNATURE) console.log("[DoLynk] Reject: no rawBody");
    return res.status(401).send("Invalid request");
  }

  // Express normalizes header names to lowercase; try all known header names
  let received = null;
  for (const name of SIGNATURE_HEADER_ALTS) {
    const v = req.headers[name];
    if (v && typeof v === "string" && v.trim()) {
      received = v;
      if (DEBUG_SIGNATURE) console.log("[DoLynk] Signature from header:", name);
      break;
    }
  }


  // i turn this on because it is a safe not completely but safe workaround since the ngnix is stripping the signature header x-dolynk-signature
  if (!received) {
    if (ALLOW_NO_SIGNATURE) {
      console.warn("[DoLynk]  Allowing request without signature (DOLYNK_ALLOW_NO_SIGNATURE=true).");
      return next();
    }
    if (DEBUG_SIGNATURE) console.log("[DoLynk] Reject: no signature header. All headers:", Object.keys(req.headers || {}));
    return res.status(401).send("Missing signature");
  }
  received = stripSignaturePrefix(received);
  if (!received) {
    if (DEBUG_SIGNATURE) console.log("[DoLynk] Reject: signature empty after strip");
    return res.status(401).send("Missing signature");
  }

  // HMAC can only be digested once; compute both encodings separately
  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBase64 = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");

  if (DEBUG_SIGNATURE) {
    console.log("[DoLynk] Signature debug: received length=%d, hex length=%d, base64 length=%d", received.length, expectedHex.length, expectedBase64.length);
    console.log("[DoLynk] Received ends with '=' (likely Base64):", received.endsWith("="));
    console.log("[DoLynk] Received (first 20 chars):", received.slice(0, 20) + (received.length > 20 ? "..." : ""));
    console.log("[DoLynk] Calculated hex (first 20):", expectedHex.slice(0, 20) + "...");
    console.log("[DoLynk] Calculated base64 (first 20):", expectedBase64.slice(0, 20) + "...");
  }

  // If header ends in '=', signature is almost certainly Base64 — try that first
  const tryBase64First = received.endsWith("=");
  let valid = false;

  if (tryBase64First) {
    try {
      if (received.length === expectedBase64.length) {
        const receivedBuf = Buffer.from(received, "base64");
        const expectedBuf = Buffer.from(expectedBase64, "base64");
        if (receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf)) valid = true;
      }
    } catch (_) {}
  }

  if (!valid) {
    try {
      if (received.length === expectedHex.length) {
        const receivedBuf = Buffer.from(received, "hex");
        const expectedBuf = Buffer.from(expectedHex, "hex");
        if (receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf)) valid = true;
      }
    } catch (_) {}
  }

  if (!valid) {
    try {
      if (received.length === expectedBase64.length) {
        const receivedBuf = Buffer.from(received, "base64");
        const expectedBuf = Buffer.from(expectedBase64, "base64");
        if (receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf)) valid = true;
      }
    } catch (_) {}
  }

  if (valid) {
    return next();
  }

  if (DEBUG_SIGNATURE) {
    console.log("[DoLynk] Signature mismatch (neither hex nor base64 matched)");
  }
  return res.status(401).send("Invalid signature");
}
