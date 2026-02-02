

import { getAdapter } from "../adapters/registry.js";
import prisma from "../config/prisma.config.js";
import { recordAttendance } from "../services/biometricAttendanceService";


export const biometricWebhookController = async (req, res) => {
    try {
        const { vendor, deviceId } = req.params;


        const device = await prisma.biometricDevice.findUnique({
            where: { id: deviceId },
            include: {
                vendorConfig: true
            }
        })


        if (!device || !device.isActive) {
            return res.status(404).json({
                error: 'Device not found or inactive'
            })
        }



        const adapter = getAdapter(vendor);
        const normalizedEvent = adapter.parseWebhookPayload(
            req.body,
            device,
            device.vendorConfig
        )


        // Record attendance

        const attendance = await recordAttendance(normalizedEvent);


        res.status(200).json({
            success: true,
            message: 'Attendance recorded successfully',
            attendanceId: attendance?.id
        })


    } catch (error) {
        console.error(`[Biometric Webhook] Error processing webhook: ${error.message}`)
        return res.status(500).json({
            error: 'Internal server error'
        })
    }
}