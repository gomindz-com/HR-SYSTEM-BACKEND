import bcrypt from "bcryptjs";
import prisma from "../config/prisma.config.js";

export const createVendorConfig = async (req, res) => {

    const companyId = req.user.companyId;
    const { vendor, apiUrl, apiKey, apiSecret } = req.body;


    if (!vendor) {
        return res.status(400).json({ success: false, message: 'Vendor is required' });
    }


    try {

        if (!companyId) {
            return res.status(401).json({ success: false, message: 'Company ID is required' });
        }


        const salt = await bcrypt.genSalt(10);
        const hashedApiKey = apiKey != null ? await bcrypt.hash(String(apiKey), salt) : undefined;
        const hashedApiSecret = apiSecret != null ? await bcrypt.hash(String(apiSecret), salt) : undefined;
        const vendorConfig = await prisma.vendorConfig.create({
            data: {
                companyId,
                vendor,
                apiUrl,
                apiKey: hashedApiKey,
                apiSecret: hashedApiSecret
            }
        });
        return res.status(201).json({
            success: true,
            message: 'Vendor config created successfully',
            data: vendorConfig
        });
    } catch (error) {
        console.log("Error creating vendor config: ", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getVendorConfigsByCompany = async (req, res) => {

    const { companyId } = req.user;
    try {
        const configs = await prisma.vendorConfig.findMany({
            where: { companyId },
            include: {
                devices: true
            }
        });
        return res.status(200).json({ success: true, message: 'Vendor configs fetched successfully', data: configs });
    } catch (error) {
        console.log("Error getting vendor configs: ", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateVendorConfig = async (req, res) => {

    const { id } = req.params;
    const { companyId } = req.user;


    if (!id || !companyId) {
        return res.status(400).json({ success: false, message: 'Vendor config ID and Company ID are required' });
    }

    const allowedUpdates = ["vendor", "apiUrl", "apiKey", "apiSecret"];
    const updateData = {};

    for (const field of allowedUpdates) {
        const value = req.body[field];
        if (value === undefined) continue;
        if (field === "apiKey" || field === "apiSecret") {
            const salt = await bcrypt.genSalt(10);
            updateData[field] = await bcrypt.hash(String(value), salt);
        } else {
            updateData[field] = value;
        }
    }

    try {
        const vendorConfig = await prisma.vendorConfig.update({
            where: { companyId, id },
            data: updateData
        });
        res.status(200).json({ success: true, message: 'Vendor config updated successfully', data: vendorConfig });
    } catch (error) {
        console.log("Error updating vendor config: ", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteVendorConfig = async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.user;
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
