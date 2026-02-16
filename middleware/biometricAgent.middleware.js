





export const requireBiometricAgent = async (req, res, next) => {

    const { deviceId, companyId } = req.body || {};
    const apiKey = req.headers['x-api-key'] ?? req.headers['authorization'].replace(/^Bearer\s+/i, '').trim();

    if (!deviceId || !apiKey) {
        return res.status(401).json({ error: 'Missing deviceId in body or API key in X-API-Key / Authorization header' });
    }

    const device = await prisma.biometricDevice.findUnique({
        where: { id: deviceId, companyId },
        isActive: true,
    })


    if (!device) {
        return res.status(404).json({ error: 'Device not found or inactive' });
    }

    if (device.agentApiKeyHash !== apiKey) {
        return res.status(401).json({ error: 'Invalid API key' });
    }


    const keyValid = await bcrypt.compare(device.agentApiKeyHash, apiKey)

    if (!keyValid) {
        return res.status(401).json({ error: 'Invalid API key for this device' });
    }

    req.biometricDevice = device;
    next()


}