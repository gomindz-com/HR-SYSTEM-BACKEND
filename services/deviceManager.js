import prisma from '../config/prisma.config.js';
import { getAdapter, isStreamingDevice } from '../adapters/registry.js';
import { withDecryptedSecrets } from '../lib/encryption.js';
import { recordAttendance } from './biometricAttendanceService.js';

// Store cleanup functions and health monitors
const activeDevices = new Map();

/**
 * Start a device. Only Suprema opens a local stream.
 * ZKTeco (ADMS push) and Dahua (DoLynk webhook) are event-driven; we don't start a listener for them.
 */
const startDevice = async (device) => {
    try {
        if (activeDevices.has(device.id)) return;

        // ZKTeco: push-based (ADMS webhook); no local listener
        if (!isStreamingDevice(device.vendor)) {
            console.log(`[DeviceManager] ${device.name} (ZKTeco push) — health monitor only`);
            return;
        }

        // Dahua: DoLynk webhook only; no local stream
        if (device.vendor === 'DAHUA') {
            console.log(`[DeviceManager] ${device.name} (DoLynk) — webhook only`);
            return;
        }

        const deviceWithSecrets = withDecryptedSecrets(device);
        const adapter = await getAdapter(device.vendor);
        const onEvent = async (normalizedEvent) => {
            await recordAttendance(normalizedEvent);
            await updateDeviceHealth(device.id);
        };

        // Suprema needs vendorConfig
        const cleanup = device.vendor === 'SUPREMA'
            ? adapter.startListening(deviceWithSecrets, deviceWithSecrets.vendorConfig, onEvent)
            : await adapter.startListening(deviceWithSecrets, onEvent);

        if (typeof cleanup === 'function') {
            activeDevices.set(device.id, cleanup);
        }
        console.log(`[DeviceManager] Suprema stream started: ${device.name}`);

    } catch (error) {
        console.error(`[DeviceManager] Failed to start ${device.name}:`, error);
    }
};

/**
 * Update device lastSeen. Used by Suprema stream; DoLynk and ZKTeco webhooks update lastSeen in their controllers.
 */
const updateDeviceHealth = async (deviceId) => {
    await prisma.biometricDevice.update({
        where: { id: deviceId },
        data: { lastSeen: new Date() }
    });
};

/**
 * Restart device: stop then start. Only Suprema has an active stream to reconnect; ZKTeco/Dahua are no-ops.
 */
const restartDevice = async (deviceId) => {
    await stopDevice(deviceId);
    const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
    if (device && device.isActive) await startDevice(device);
};

/**
 * Start All Active Devices on Boot
 */
const startAllDevices = async () => {
    try {
        const devices = await prisma.biometricDevice.findMany({
            where: { isActive: true },
            include: { vendorConfig: true }
        });

        for (const device of devices) {
            await startDevice(device);
        }
        
        console.log('[DeviceManager] All device initializations complete');
    } catch (error) {
        console.error('[DeviceManager] Startup error:', error);
    }
};

const stopDevice = async (deviceId) => {
    const cleanup = activeDevices.get(deviceId);
    if (cleanup) {
        cleanup(); // Closes WebSocket or stream
        activeDevices.delete(deviceId);
    }
};

const stopAllDevices = async () => {
    for (const [deviceId] of activeDevices.entries()) await stopDevice(deviceId);
    console.log('[DeviceManager] All active streams/sockets closed');
};

export { startDevice, stopDevice, restartDevice, startAllDevices, stopAllDevices };