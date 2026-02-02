import prisma from "../config/prisma.config.js";
import { getAdapter, isStreamingDevice } from "../adapters/registry.js";
import { startDevice, stopDevice } from "../services/deviceManager.js";

const createDevice = async (req, res) => {
    try {
        const device = await prisma.biometricDevice.create({
            data: {
                ...req.body,
                isActive: false
            }
        });
        res.json(device);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const testDeviceConnection = async (req, res) => {
    try {
        const device = await prisma.biometricDevice.findUnique({
            where: { id: req.params.id },
            include: { vendorConfig: true }
        });

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const adapter = getAdapter(device.vendor);
        const connected = await adapter.testConnection(device, device.vendorConfig);

        res.json({ connected });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const activateDevice = async (req, res) => {
    try {
        const device = await prisma.biometricDevice.update({
            where: { id: req.params.id },
            data: { isActive: true }
        });

        if (device.host && isStreamingDevice(device.vendor)) {
            await startDevice(device);
        }

        res.json({ success: true, device });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deactivateDevice = async (req, res) => {
    try {
        await stopDevice(req.params.id);

        const device = await prisma.biometricDevice.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

        res.json({ success: true, device });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getDevicesByCompany = async (req, res) => {
    try {
        const devices = await prisma.biometricDevice.findMany({
            where: { companyId: parseInt(req.params.companyId) },
            include: { vendorConfig: true }
        });

        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateDevice = async (req, res) => {
    try {
        const device = await prisma.biometricDevice.update({
            where: { id: req.params.id },
            data: req.body
        });

        res.json(device);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const deleteDevice = async (req, res) => {
    try {
        await stopDevice(req.params.id);

        await prisma.biometricDevice.delete({
            where: { id: req.params.id }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export {
    createDevice,
    testDeviceConnection,
    activateDevice,
    deactivateDevice,
    getDevicesByCompany,
    updateDevice,
    deleteDevice
};