// services/deviceManager.js
import { PrismaClient } from '@prisma/client';
import { getAdapter, isStreamingDevice } from '../adapters/registry.js';
import { recordAttendance } from './biometricAttendanceService.js';

const prisma = new PrismaClient();

// Store cleanup functions for active streaming devices
const activeDevices = new Map();

/**
 * Start listening to a single streaming device
 * Only called for devices with host (local/streaming devices)
 * 
 * WHO USES THIS: Admin API when they click "Activate" on a device
 * WHY IT'S USEFUL: Device starts immediately without server restart
 */
const startDevice = async (device) => {
    try {
        if (activeDevices.has(device.id)) {
            console.log(`[DeviceManager] Device ${device.id} already active`);
            return;
        }

        // Only start if it's a streaming device
        if (!isStreamingDevice(device.vendor)) {
            console.log(`[DeviceManager] Device ${device.name} is webhook-based, no need to start`);
            return;
        }

        const adapter = getAdapter(device.vendor);

        // Start listening and store cleanup function
        const cleanup = adapter.startListening(device, async (normalizedEvent) => {
            await recordAttendance(normalizedEvent);
        });

        activeDevices.set(device.id, cleanup);
        console.log(`[DeviceManager] Started streaming: ${device.name}`);

    } catch (error) {
        console.error(`[DeviceManager] Failed to start device:`, error);
    }
};

/**
 * Stop listening to a device
 * 
 * WHO USES THIS: Admin API when they click "Deactivate" on a device
 * WHY IT'S USEFUL: Device stops immediately without server restart
 */
const stopDevice = async (deviceId) => {
    const cleanup = activeDevices.get(deviceId);

    if (cleanup) {
        cleanup();
        activeDevices.delete(deviceId);
        console.log(`[DeviceManager] Stopped device ${deviceId}`);
    }
};

/**
 * Restart a device
 * 
 * WHO USES THIS: Admin API for troubleshooting connection issues
 * WHY IT'S USEFUL: Can fix stuck connections without full restart
 */
const restartDevice = async (deviceId) => {
    await stopDevice(deviceId);

    const device = await prisma.biometricDevice.findUnique({
        where: { id: deviceId }
    });

    if (device && device.host) {
        await startDevice(device);
    }
};

/**
 * Start all active streaming devices (devices with host field)
 * Webhook devices don't need to be "started" - they push to us
 * 
 * WHO USES THIS: the application automatically on server startup (app.js)
 * WHY IT'S ESSENTIAL: Without this, no streaming devices work at all
 */
const startAllDevices = async () => {
    try {
        const devices = await prisma.biometricDevice.findMany({
            where: {
                isActive: true,
                host: { not: null }  // Only streaming devices
            }
        });

        console.log(`[DeviceManager] Starting ${devices.length} streaming devices...`);

        for (const device of devices) {
            await startDevice(device);
        }

        console.log('[DeviceManager] All streaming devices started');
    } catch (error) {
        console.error('[DeviceManager] Error starting devices:', error);
    }
};

/**
 * Stop all devices
 * 
 * WHO USES THIS: the application automatically on graceful shutdown
 * WHY IT'S ESSENTIAL: Prevents memory leaks and ensures clean restart
 */
const stopAllDevices = async () => {
    for (const [deviceId, cleanup] of activeDevices.entries()) {
        cleanup();
        activeDevices.delete(deviceId);
    }
    console.log('[DeviceManager] All devices stopped');
};

export {
    startDevice,      // Nice to have - for admin UX
    stopDevice,       // Nice to have - for admin UX
    restartDevice,    // Nice to have - for troubleshooting
    startAllDevices,  // ESSENTIAL - for system to work
    stopAllDevices    // ESSENTIAL - for clean shutdown
};