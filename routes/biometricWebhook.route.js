import { getAdapter } from "../adapters/registry.js";
import prisma from "../config/prisma.config.js";
import { recordAttendance } from "../services/biometricAttendanceService.js";

/**
 * NEW: ZKTeco ADMS Controller
 * Handles the "Push" protocol where the device ID is in the payload/query
 */
export const zktecoAdmsController = async (req, res) => {
    try {
        // ADMS devices often send serial number in query params
        const { SN } = req.query; 

        const device = await prisma.biometricDevice.findUnique({
            where: { serialNumber: SN },
            include: { vendorConfig: true }
        });

        if (!device || !device.isActive) return res.status(200).send('OK'); // ACK anyway to stop retries

        const adapter = getAdapter('ZKTECO');
        const normalizedEvents = adapter.parsePushPayload(req.body, device);

        // ZK ADMS often sends multiple logs in one push
        for (const event of normalizedEvents) {
            await recordAttendance(event);
        }

        // ADMS requires a specific plain-text "OK" response
        res.status(200).send('OK');

    } catch (error) {
        console.error(`[ADMS] Error: ${error.message}`);
        res.status(500).send('ERROR');
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

        const adapter = getAdapter(vendor);
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