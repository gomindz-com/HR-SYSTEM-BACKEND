import prisma from "../config/prisma.config.js";
import { getAdapter, isStreamingDevice } from "../adapters/registry.js";
import { startDevice, stopDevice } from "../services/deviceManager.js";
import bcrypt from "bcryptjs";


const VendorTypes = {
    DAHUA: 'DAHUA',
    ZKTECO: 'ZKTECO',
    SUPREMA: 'SUPREMA',
}
const createDevice = async (req, res) => {

    const companyId = req.user.companyId;
    if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company id is required' });
    }

    const { name, vendor, serialNumber, host, port, username, password, vendorConfigId, cloudDeviceId } = req.body;






    try {
        if (!name || !vendor) {
            return res.status(400).json({ success: false, message: 'Name and vendor are required' });
        }


        if (!VendorTypes[vendor]) {
            return res.status(400).json({ success: false, message: 'Invalid vendor type' });
        }


        if (vendor === VendorTypes.DAHUA) {
            if (!host || !port || !username || !password) {
                return res.status(400).json({ success: false, message: 'Host, port, username and password are required for Dahua' });
            }
        }


        if (vendor === VendorTypes.ZKTECO) {
            if (!serialNumber || !vendorConfigId) {
                return res.status(400).json({ success: false, message: 'Serial number and vendor config id are required for ZKTeco' });
            }
        }


        if (vendor === VendorTypes.SUPREMA) {
            if (!vendorConfigId || !cloudDeviceId) {
                return res.status(400).json({ success: false, message: 'Vendor config id and cloud device id are required for Suprema' });
            }
        }





        const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

        const device = await prisma.biometricDevice.create({
            data: {
                name,
                vendor,
                serialNumber,
                host,
                port,
                username,
                password: hashedPassword,
                vendorConfigId,
                cloudDeviceId,
                isActive: false,
                companyId
            }
        });
        res.status(201).json({ success: true, message: 'Device created successfully', data: device });
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

        const adapter = await getAdapter(device.vendor);
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

        if (isStreamingDevice(device.vendor)) {
            const deviceWithConfig = await prisma.biometricDevice.findUnique({
                where: { id: device.id },
                include: { vendorConfig: true }
            });
            await startDevice(deviceWithConfig);
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