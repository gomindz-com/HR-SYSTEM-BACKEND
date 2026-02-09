/**
 * Hourly backup: pull attendance records from Dahua devices via recordFinder
 * and fill any gaps the real-time stream may have missed (e.g. network blips).
 */
import cron from "node-cron";
import prisma from "../config/prisma.config.js";
import { getAdapter } from "../adapters/registry.js";
import { withDecryptedSecrets } from "../lib/encryption.js";
import { recordAttendance } from "../services/biometricAttendanceService.js";

async function runDahuaBackup() {
    try {
        const devices = await prisma.biometricDevice.findMany({
            where: { vendor: "DAHUA", isActive: true },
            include: { vendorConfig: true },
        });
        if (devices.length === 0) return;

        const end = new Date();
        const start = new Date(end.getTime() - 2 * 60 * 60 * 1000); // last 2 hours
        const adapter = await getAdapter("DAHUA");
        if (typeof adapter.fetchAttendanceRecords !== "function") return;

        for (const device of devices) {
            const deviceWithSecrets = withDecryptedSecrets(device);
            const records = await adapter.fetchAttendanceRecords(deviceWithSecrets, start, end);
            for (const rec of records) {
                await recordAttendance({
                    companyId: device.companyId,
                    deviceId: device.id,
                    biometricUserId: rec.UserID,
                    timestamp: rec.timestamp,
                    eventType: "CHECK_IN",
                });
            }
            if (records.length > 0) {
                console.log(`[Dahua] Backup: ${device.name} synced ${records.length} record(s)`);
            }
        }
    } catch (err) {
        console.error("[Dahua] Backup cron error:", err.message);
    }
}

export default function initDahuaBackupCron() {
    cron.schedule("5 * * * *", runDahuaBackup, { scheduled: true });
    console.log("🕐 Dahua attendance backup cron initialized - runs every hour at :05");
    return { success: true };
}
