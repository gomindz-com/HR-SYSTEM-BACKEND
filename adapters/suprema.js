// suprema.js
import axios from 'axios';

/**
 * Parse Suprema webhook payload
 * This is called by your webhook endpoint when Suprema sends data
 */
const parseWebhookPayload = (payload, device, vendorConfig) => ({
    companyId: device.companyId,
    deviceId: device.id,
    biometricUserId: payload.user_id?.toString(),
    timestamp: new Date(payload.datetime), // Note: should be 'datetime' not 'timestamp'
    eventType: payload.event_type_code === 4096 ? 'CHECK_IN' : 'CHECK_OUT'
});

/**
 * Test connection to Suprema API
 */
const testConnection = async (device, vendorConfig) => {
    try {
        const response = await axios({ // Fixed typo: was 'responst'
            method: 'get',
            url: `${vendorConfig.apiUrl}/devices/${device.cloudDeviceId}`,
            headers: {
                'Authorization': `Bearer ${vendorConfig.apiKey}`
            },
            timeout: 5000
        });

        return response.status === 200;
    } catch (error) {
        console.error(`[Suprema] Failed to test connection: ${error.message}`);
        return false;
    }
};

export { parseWebhookPayload, testConnection };