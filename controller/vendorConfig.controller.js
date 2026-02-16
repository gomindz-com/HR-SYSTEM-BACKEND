import prisma from "../config/prisma.config.js";
import { encrypt } from "../lib/encryption.js";

function redactVendorConfig(config) {
    if (!config) return config;
    const { apiKey, apiSecret, ...rest } = config;
    return { ...rest, apiKey: apiKey ? '[REDACTED]' : null, apiSecret: apiSecret ? '[REDACTED]' : null };
}


export const getVendorConfigsByCompany = async (req, res) => {

    const companyId = req.user.companyId;
    if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company ID is required' });
    }
    try {
        const configs = await prisma.vendorConfig.findMany({
            where: { companyId },
            include: {
                devices: true
            }
        });
        const safe = configs.map(redactVendorConfig);
        return res.status(200).json({ success: true, message: 'Vendor configs fetched successfully', data: safe });
    } catch (error) {
        console.log("Error getting vendor configs: ", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateVendorConfig = async (req, res) => {

    const { id } = req.params;
    const companyId = req.user.companyId;


    if (!id || !companyId) {
        return res.status(400).json({ success: false, message: 'Vendor config ID and Company ID are required' });
    }

    const allowedUpdates = ["vendor", "apiUrl", "apiKey", "apiSecret"];
    const updateData = {};

    for (const field of allowedUpdates) {
        const value = req.body[field];
        if (value === undefined) continue;
        if (field === "apiKey" || field === "apiSecret") {
            updateData[field] = encrypt(String(value));
        } else {
            updateData[field] = value;
        }
    }

    try {
        const vendorConfig = await prisma.vendorConfig.update({
            where: { companyId, id },
            data: updateData
        });
        res.status(200).json({ success: true, message: 'Vendor config updated successfully', data: redactVendorConfig(vendorConfig) });
    } catch (error) {
        console.log("Error updating vendor config: ", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteVendorConfig = async (req, res) => {
    const { id } = req.params;
    const companyId = req.user.companyId;
    if (!companyId) {
        return res.status(400).json({ success: false, message: 'Company ID is required' });
    }
    try {
        await prisma.vendorConfig.delete({
            where: { companyId, id }
        });
        return res.status(200).json({ success: true, message: 'Vendor config deleted successfully', data: { id } });
    } catch (error) {
        console.log("Error deleting vendor config: ", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
