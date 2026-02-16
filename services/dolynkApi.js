// DoLynk Open API: token and add device. Used when creating a Dahua device in the HR app.

const DOLYNK_BASE = process.env.DOLYNK_API_BASE_URL || "https://open.dolynkcloud.com";
const CATEGORY_ASI = "ASI";

// Get app access token (AppKey + AppSecret). Required before addDevice.
export async function getDolynkAppAccessToken() {
    const appKey = process.env.DAHUA_APP_KEY;
    const appSecret = process.env.DAHUA_APP_SECRET;
    if (!appKey || !appSecret) {
        throw new Error("DAHUA_APP_KEY and DAHUA_APP_SECRET are required for DoLynk API");
    }

    const res = await fetch(`${DOLYNK_BASE}/open-api/api-base/auth/getAppAccessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appKey, appSecret }),
    });

    const data = await res.json();
    if (!res.ok || (data.code !== 0 && data.code !== undefined)) {
        throw new Error(data?.message || data?.msg || "Failed to get DoLynk app access token");
    }
    return data.data?.accessToken ?? data.accessToken;
}

// Bind device to your DoLynk project. deviceId = serial number, devicePassword = device admin password.
export async function dolynkAddDevice(accessToken, deviceId, devicePassword) {
    const res = await fetch(`${DOLYNK_BASE}/open-api/api-iot/device/addDevice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            deviceId,
            categoryCode: CATEGORY_ASI,
            devicePassword,
            appAccessToken: accessToken,
        }),
    });

    const data = await res.json();
    if (!res.ok || (data.code !== 0 && data.code !== undefined)) {
        throw new Error(data?.message || data?.msg || "DoLynk addDevice failed");
    }
    return data;
}



