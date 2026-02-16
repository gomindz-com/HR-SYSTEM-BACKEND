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
    let vendorConfigId = raw.vendorConfigId != null ? String(raw.vendorConfigId).trim() || null : null;
    const cloudDeviceId = raw.cloudDeviceId != null ? String(raw.cloudDeviceId).trim() || null : null;
    const vendorConfigNested = raw.vendorConfig && typeof raw.vendorConfig === 'object' ? raw.vendorConfig : null;

    const errors = [];

    if (!name) errors.push('name is required');
    if (!vendor) errors.push('vendor is required');
    else if (!VendorTypes[vendor]) errors.push(`vendor must be one of: ${Object.values(VendorTypes).join(', ')}`);

    if (vendor === VendorTypes.DAHUA) {
        if (!serialNumber || !String(serialNumber).trim()) errors.push('serial number is required for Dahua (DoLynk)');
    }
    

    if (vendor === VendorTypes.ZKTECO) {
        if (!serialNumber) errors.push('serial number is required for ZKTeco');
    }

    if (vendor === VendorTypes.SUPREMA) {
        if (!vendorConfigId && !vendorConfigNested) {
            errors.push('Suprema requires either vendorConfigId (existing config) or vendorConfig (apiUrl, apiKey)');
        }
        if (vendorConfigNested) {
            const url = vendorConfigNested.apiUrl != null ? String(vendorConfigNested.apiUrl).trim() : '';
            const key = vendorConfigNested.apiKey != null ? String(vendorConfigNested.apiKey) : '';
            if (!url) errors.push('vendorConfig.apiUrl is required when creating config inline');
            if (!key) errors.push('vendorConfig.apiKey is required when creating config inline');
        }
        if (!cloudDeviceId) errors.push('cloud device id is required for Suprema');
    }

    if (vendorConfigId && vendorConfigNested) {
        errors.push('send either vendorConfigId or vendorConfig, not both');
    }

    if (errors.length) {
        return res.status(400).json({ success: false, message: errors.join('; '), errors });
    }

    try {
        if (vendorConfigNested && (vendor === VendorTypes.SUPREMA || vendor === VendorTypes.ZKTECO)) {
            const existing = await prisma.vendorConfig.findUnique({
                where: { companyId_vendor: { companyId, vendor } }
            });
            if (existing) {
                vendorConfigId = existing.id;
            } else {
                const apiUrl = String(vendorConfigNested.apiUrl ?? '').trim();
                const apiKey = vendorConfigNested.apiKey != null ? encrypt(String(vendorConfigNested.apiKey)) : undefined;
                const apiSecret = vendorConfigNested.apiSecret != null ? encrypt(String(vendorConfigNested.apiSecret)) : undefined;
                const created = await prisma.vendorConfig.create({
                    data: { companyId, vendor, apiUrl, apiKey, apiSecret }
                });
                vendorConfigId = created.id;
            }
        }

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
        const withConfig = await prisma.biometricDevice.findUnique({
            where: { id: device.id },
            include: { vendorConfig: true }
        });
        res.status(201).json({ success: true, message: 'Device created successfully', data: redactDevice(withConfig) });
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

        res.json({ success: true, message: 'Device connection tested successfully', data: { connected } });
    } catch (error) {
        const detail = {
            message: error.message,
            code: error.code,
            httpStatus: error.response?.status,
            responseData: error.response?.data,
        };
        console.warn("Error testing device connection:", detail);
        return res.status(500).json({
            success: false,
            message: error.message,
            ...(process.env.NODE_ENV !== "production" && { debug: detail }),
        });
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

        const withConfig = await prisma.biometricDevice.findUnique({
            where: { id: device.id },
            include: { vendorConfig: true }
        });
        res.json({ success: true, data: redactDevice(withConfig) });
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

        const withConfig = await prisma.biometricDevice.findUnique({
            where: { id: device.id },
            include: { vendorConfig: true }
        });
        res.json({ success: true, data: redactDevice(withConfig) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getDevicesByCompany = async (req, res) => {
    const companyId = req.user.companyId;
    if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company id is required' });
    }
    try {
        const devices = await prisma.biometricDevice.findMany({
            where: { companyId: companyId },
            include: { vendorConfig: true }
        });

        res.json({ success: true, data: devices.map(redactDevice) });
    } catch (error) {
        console.log("Error getting devices by company: ", error);
        res.status(500).json({ success: false, message: error.message });
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

        const withConfig = await prisma.biometricDevice.findUnique({
            where: { id: device.id },
            include: { vendorConfig: true }
        });
        res.json({ success: true, data: redactDevice(withConfig) });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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