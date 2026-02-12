import prisma from "../config/prisma.config.js";
import { recordAttendance } from "../services/biometricAttendanceService.js";

const METHOD_ACCESS_CONTROL = "client.index.accessControl";

/**
 * Parse DoLynk time string (e.g. "2026-02-12 14:00:00") to Date.
 */
function parseDolynkTime(timeStr) {
  if (!timeStr) return new Date();
  const str = String(timeStr).trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(" ", "T") + "Z");
  }
  return new Date(str);
}

/**
 * DoLynk Pro webhook: access control events. Verify signature before this.
 * Payload: method, params.data { userID, deviceSN, time }.
 */
export async function dolynkWebhookController(req, res) {
  try {
    const body = req.body || {};
    const method = body.method;

    if (method !== METHOD_ACCESS_CONTROL) {
      return res.status(200).send("ACK");
    }

    const data = body.params?.data || {};
    const userID = data.userID != null ? String(data.userID) : null;
    const deviceSN = data.deviceSN != null ? String(data.deviceSN).trim() : null;
    const timeStr = data.time;

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

    const timestamp = parseDolynkTime(timeStr);
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

    console.log(`[DoLynk] Punch: deviceSN=${deviceSN}, userID=${userID}, time=${timestamp.toISOString()}`);
    return res.status(200).send("ACK");
  } catch (error) {
    console.error("[DoLynk] Webhook error:", error.message);
    return res.status(200).send("ACK");
  }
}
