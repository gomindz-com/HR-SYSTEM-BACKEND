import prisma from "../config/prisma.config.js";
import { getAdapter, isStreamingDevice } from "../adapters/registry.js";
import { startDevice, stopDevice } from "../services/deviceManager.js";
import { encrypt, withDecryptedSecrets } from "../lib/encryption.js";


const VendorTypes = {
    DAHUA: 'DAHUA',
    ZKTECO: 'ZKTECO',
    SUPREMA: 'SUPREMA',
};

function redactDevice(device) {
    if (!device) return device;
    const { password, vendorConfig, ...rest } = device;
    const out = { ...rest, password: password ? '[REDACTED]' : undefined };
    if (vendorConfig) {
        out.vendorConfig = {
            ...vendorConfig,
            apiKey: vendorConfig.apiKey ? '[REDACTED]' : null,
            apiSecret: vendorConfig.apiSecret ? '[REDACTED]' : null
        };
    }
    return out;
}

const createDevice = async (req, res) => {

    const companyId = req.user.companyId;
    if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company id is required' });
    }

    const raw = req.body;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const vendor = typeof raw.vendor === 'string' ? raw.vendor.trim().toUpperCase() : '';
    const serialNumber = raw.serialNumber != null ? String(raw.serialNumber).trim() : null;
    const host = raw.host != null ? String(raw.host).trim() : null;
    const port = raw.port != null ? (typeof raw.port === 'number' ? raw.port : parseInt(raw.port, 10)) : null;
    const username = raw.username != null ? String(raw.username).trim() : null;
    const password = raw.password != null ? String(raw.password) : null;
    const vendorConfigId = raw.vendorConfigId != null ? String(raw.vendorConfigId).trim() || null : null;
    const cloudDeviceId = raw.cloudDeviceId != null ? String(raw.cloudDeviceId).trim() || null : null;

    const errors = [];

    if (!name) errors.push('name is required');
    if (!vendor) errors.push('vendor is required');
    else if (!VendorTypes[vendor]) errors.push(`vendor must be one of: ${Object.values(VendorTypes).join(', ')}`);

    if (vendor === VendorTypes.DAHUA) {
        if (!host) errors.push('host is required for Dahua');
        if (username == null || username === '') errors.push('username is required for Dahua');
        // port optional (adapter defaults to 80); password optional (some devices use empty)
    }

    if (vendor === VendorTypes.ZKTECO) {
        if (!serialNumber) errors.push('serial number is required for ZKTeco');
        // vendorConfigId optional (only needed for cloud features; push-only uses just serialNumber)
    }

    if (vendor === VendorTypes.SUPREMA) {
        if (!vendorConfigId) errors.push('vendor config is required for Suprema');
        if (!cloudDeviceId) errors.push('cloud device id is required for Suprema');
    }

    if (errors.length) {
        return res.status(400).json({ success: false, message: errors.join('; '), errors });
    }

    try {


        const encryptedPassword = (password !== null && password !== '') ? encrypt(password) : undefined;
        const portNum = (port != null && !Number.isNaN(port) && port > 0) ? port : undefined;

        const device = await prisma.biometricDevice.create({
            data: {
                name,
                vendor,
                serialNumber: serialNumber || undefined,
                host: host || undefined,
                port: portNum,
                username: username || undefined,
                password: encryptedPassword,
                vendorConfigId: vendorConfigId || undefined,
                cloudDeviceId: cloudDeviceId || undefined,
                isActive: false,
                companyId
            }
        });
        res.status(201).json({ success: true, message: 'Device created successfully', data: redactDevice(device) });
    } catch (error) {

        console.log("Error creating device: ", error);
        res.status(500).json({ success: false, message: error.message });
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

        const deviceWithSecrets = withDecryptedSecrets(device);
        const adapter = await getAdapter(device.vendor);
        const connected = await adapter.testConnection(deviceWithSecrets, deviceWithSecrets.vendorConfig);

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

        if (isStreamingDevice(device.vendor)) {
            const deviceWithConfig = await prisma.biometricDevice.findUnique({
                where: { id: device.id },
                include: { vendorConfig: true }
            });
            await startDevice(deviceWithConfig);
        }

        res.json({ success: true, device: redactDevice(device) });
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

        res.json({ success: true, device: redactDevice(device) });
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

        res.json(devices.map(redactDevice));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateDevice = async (req, res) => {
    try {
        const { password, ...restBody } = req.body;
        const data = { ...restBody };
        if (password !== undefined) data.password = encrypt(password);

        const device = await prisma.biometricDevice.update({
            where: { id: req.params.id },
            data
        });

        res.json(redactDevice(device));
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