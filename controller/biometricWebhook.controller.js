import { getAdapter } from "../adapters/registry.js";
import prisma from "../config/prisma.config.js";
import { recordAttendance } from "../services/biometricAttendanceService.js";

/**
 * NEW: ZKTeco ADMS Controller
 * Handles the "Push" protocol where the device ID is in the payload/query
 */
export const zktecoAdmsController = async (req, res) => {
    const { SN } = req.query;

    // 1. Handle Handshake (GET)
    if (req.method === 'GET') {
        console.log(`[ADMS] Handshake from device: ${SN}`);
        return res.status(200).send('OK'); // Must be plain text "OK"
    }

    // 2. Handle Data Push (POST) - only process attendance logs (ATTLOG)
    if (req.method === 'POST') {
        try {
            if (req.query.table !== 'ATTLOG') {
                return res.status(200).send('OK');
            }

            const device = await prisma.biometricDevice.findUnique({
                where: { serialNumber: SN }
            });

            if (!device) return res.status(200).send('OK'); // ACK to stop retries

            let bodyStr = '';
            if (typeof req.body === 'string') {
                bodyStr = req.body;
            } else if (req.body && typeof req.body === 'object') {
                bodyStr = req.body.data ?? req.body.content ?? req.body.log ?? req.body.payload ?? (typeof req.body[0] === 'string' ? req.body[0] : Object.values(req.body).find(v => typeof v === 'string')) ?? '';
            }
            if (!String(bodyStr).trim()) return res.status(200).send('OK');
            bodyStr = String(bodyStr);

            const adapter = await getAdapter('ZKTECO');
            const normalizedEvents = adapter.parsePushPayload(bodyStr, device);

            for (const event of normalizedEvents) {
                await recordAttendance(event);
            }

            return res.status(200).send('OK');
        } catch (error) {
            console.error(`[ADMS] POST Error: ${error.message}`);
            return res.status(200).send('OK'); // Still send OK to prevent device lockup
        }
    }
};
/**
 * UPDATED: Generic Webhook Controller
 */
export const biometricWebhookController = async (req, res) => {
    try {
        const { vendor, deviceId } = req.params;

        // Suprema Note: Since Suprema moved to WebSockets in 2026, 
        // this controller is now only for pure cloud-webhook vendors

        const device = await prisma.biometricDevice.findUnique({
            where: { id: deviceId },
            include: { vendorConfig: true }
        });

        if (!device || !device.isActive) {
            return res.status(404).json({ error: 'Device inactive' });
        }

        const adapter = await getAdapter(vendor);
        const normalizedEvent = adapter.parseWebhookPayload(
            req.body,
            device,
            device.vendorConfig
        );

        await recordAttendance(normalizedEvent);
        res.status(200).json({ success: true });

    } catch (error) {
        console.error(`[Webhook] Error: ${error.message}`);
        return res.status(500).json({ error: 'Internal error' });
    }
};