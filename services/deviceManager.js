import prisma from '../config/prisma.config.js';
import { getAdapter, isStreamingDevice } from '../adapters/registry.js';
import { withDecryptedSecrets } from '../lib/encryption.js';
import { recordAttendance } from './biometricAttendanceService.js';

// Store cleanup functions and health monitors
const activeDevices = new Map();

/**
 * Start a device (Streaming for Dahua/Suprema)
 */
const startDevice = async (device) => {
    try {
        if (activeDevices.has(device.id)) return;

        // Webhook/Push devices (ZKTeco ADMS) don't start a local listener
        if (!isStreamingDevice(device.vendor)) {
            console.log(`[DeviceManager] ${device.name} (Push-based) is managed by health monitor only`);
            return;
        }

        // Dahua: fully DoLynk — all events come from DoLynk webhook; never start local stream
        if (device.vendor === 'DAHUA') {
            console.log(`[DeviceManager] ${device.name} uses DoLynk; skipping local stream`);
            return;
        }

        const deviceWithSecrets = withDecryptedSecrets(device);
        const adapter = await getAdapter(device.vendor);
        const onEvent = async (normalizedEvent) => {
            await recordAttendance(normalizedEvent);
            await updateDeviceHealth(device.id);
        };

        // Suprema needs vendorConfig; Dahua only needs (device, onEvent)
        const cleanup = device.vendor === 'SUPREMA'
            ? adapter.startListening(deviceWithSecrets, deviceWithSecrets.vendorConfig, onEvent)
            : await adapter.startListening(deviceWithSecrets, onEvent);

        if (typeof cleanup === 'function') {
            activeDevices.set(device.id, cleanup);
        }
        console.log(`[DeviceManager] Monitoring stream/socket for: ${device.name}`);

    } catch (error) {
        console.error(`[DeviceManager] Failed to start ${device.name}:`, error);
    }
};

/**
 * Health Monitor: Tracks "Last Seen" for all devices
 * Essential for ZKTeco ADMS since we don't 'start' them
 */
const updateDeviceHealth = async (deviceId) => {
    await prisma.biometricDevice.update({
        where: { id: deviceId },
        data: { lastSeen: new Date() }
    });
};

/**
 * Restart Device (Force reconnect for Dahua/Suprema)
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
        cleanup(); // Closes WebSocket or Destroys Dahua Stream
        activeDevices.delete(deviceId);
    }
};

const stopAllDevices = async () => {
    for (const [deviceId] of activeDevices.entries()) await stopDevice(deviceId);
    console.log('[DeviceManager] All active streams/sockets closed');
};

export { startDevice, stopDevice, restartDevice, startAllDevices, stopAllDevices };