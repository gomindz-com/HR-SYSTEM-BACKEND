import prisma from "../config/prisma.config.js";
import { recordAttendance } from "../services/biometricAttendanceService.js";

const METHOD_ACCESS_CONTROL = "client.index.accessControl";
const MSGTYPE_ACCESS_CONTROL = "AccessControl";

/**
 * Parse DoLynk time: string "YYYY-MM-DD HH:mm:ss" or number (ms since epoch).
 */
function parseDolynkTime(timeStrOrMs) {
  if (timeStrOrMs == null) return new Date();
  if (typeof timeStrOrMs === "number") return new Date(timeStrOrMs);
  const str = String(timeStrOrMs).trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(" ", "T") + "Z");
  }
  return new Date(str);
}

/**
 * Normalize DoLynk payload into { userID, deviceSN, timestamp }.
 * Supports: (1) msgType "AccessControl" with userId, deviceId, localTime/utcTime
 *           (2) method "client.index.accessControl" with params.data
 */
function normalizePayload(body) {
  if (body.msgType === MSGTYPE_ACCESS_CONTROL) {
    const userId = body.userId != null ? String(body.userId) : null;
    const deviceSN = body.deviceId != null ? String(body.deviceId).trim() : null;
    const ms = body.localTime != null ? body.localTime : body.utcTime;
    const timestamp = parseDolynkTime(ms);
    return { userID: userId, deviceSN, timestamp };
  }
  if (body.method === METHOD_ACCESS_CONTROL && body.params?.data) {
    const data = body.params.data;
    const userID = data.userID != null ? String(data.userID) : null;
    const deviceSN = data.deviceSN != null ? String(data.deviceSN).trim() : null;
    const timestamp = parseDolynkTime(data.time);
    return { userID, deviceSN, timestamp };
  }
  return null;
}

/** Log full webhook body only when explicitly debugging. Leave false in production. */
const LOG_BODY = process.env.DOLYNK_DEBUG_SIGNATURE === "true";

export async function dolynkWebhookController(req, res) {
  try {
    const body = req.body || {};

    if (LOG_BODY) {
      console.log("[DoLynk] --- Webhook body (copy this to map attendance fields) ---");
      console.log(JSON.stringify(body, null, 2));
      console.log("[DoLynk] --- End webhook body ---");
    }

    const normalized = normalizePayload(body);
    if (!normalized) {
      return res.status(200).send("ACK");
    }

    const { userID, deviceSN, timestamp } = normalized;

    if (!deviceSN || userID == null) {
      console.warn("[DoLynk] Missing userID or deviceSN in payload");
      return res.status(200).send("ACK");
    }

    const device = await prisma.biometricDevice.findFirst({
      where: { serialNumber: deviceSN, isActive: true },
    });

    if (!device) {
      console.warn(`[DoLynk] Unknown or inactive deviceSN: ${deviceSN}`);
      return res.status(200).send("ACK");
    }
    const normalizedEvent = {
      companyId: device.companyId,
      deviceId: device.id,
      biometricUserId: userID,
      timestamp,
    };

    await recordAttendance(normalizedEvent);

    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastSeen: new Date() },
    });

    console.log(`[DoLynk] Punch: deviceSN=${deviceSN}, userId=${userID}, time=${timestamp.toISOString()}`);
    return res.status(200).send("ACK");
  } catch (error) {
    console.error("[DoLynk] Webhook error:", error.message);
    return res.status(200).send("ACK");
  }
}
