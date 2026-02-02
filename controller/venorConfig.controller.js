import prisma from "../config/prisma.config.js";

export const createVendorConfig = async (req, res) => {
    try {
        const vendorConfig = await prisma.vendorConfig.create({
            data: req.body
        });
        res.json(vendorConfig);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getVendorConfigsByCompany = async (req, res) => {
    try {
        const configs = await prisma.vendorConfig.findMany({
            where: { companyId: parseInt(req.params.companyId) },
            include: {
                devices: true
            }
        });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateVendorConfig = async (req, res) => {
    try {
        const vendorConfig = await prisma.vendorConfig.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(vendorConfig);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteVendorConfig = async (req, res) => {
    try {
        await prisma.vendorConfig.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
