/**
 * DoLynk Open API client for Dahua device binding.
 * Uses simplified signature mode: HMAC-SHA512(ak + timestamp + Nonce [+ appAccessToken for business], sk), hex uppercase.
 */

import crypto from "crypto";

const BASE_URL = process.env.DOLYNK_API_BASE_URL || "https://open.dolynkcloud.com";
// ASI = access control / biometric; set DOLYNK_DEVICE_CATEGORY in .env to override (e.g. IPC for cameras)
const CATEGORY_DEFAULT = process.env.DOLYNK_DEVICE_CATEGORY || "ASI";

function getConfig() {
    const ak = process.env.DAHUA_APP_KEY;
    const sk = process.env.DAHUA_APP_SECRET;
    const productId = process.env.DOLYNK_PRODUCT_ID;
    if (!ak || !sk || !productId) {
        throw new Error("DAHUA_APP_KEY, DAHUA_APP_SECRET and DOLYNK_PRODUCT_ID are required for DoLynk API");
    }
    return { ak, sk, productId };
}

function guidLike() {
    return crypto.randomBytes(8).toString("hex") + "-" + crypto.randomBytes(4).toString("hex");
}

/** DoLynk Method 1: devCode = "Dolynk_" + Base64(password). Required for addDevice. */
function encryptDevCode(password) {
    const base64Pass = Buffer.from(String(password || ""), "utf8").toString("base64");
    return `Dolynk_${base64Pass}`;
}

/**
 * Build request headers. Uses simplified signature (Sign-Type: simple): no body in sign.
 * Auth API: str = ak + ts + Nonce. Business API: str = ak + appAccessToken + ts + Nonce.
 */
function createApiHeader(ak, sk, productId, appAccessToken, auth) {
    const ts = Date.now();
    const Nonce = `web-${guidLike()}-${ts}`;

    const str = auth
        ? ak + ts + Nonce
        : ak + (appAccessToken || "") + ts + Nonce;

    const sign = crypto
        .createHmac("sha512", sk)
        .update(str, "utf8")
        .digest("hex")
        .toUpperCase();

    const headers = {
        "Content-Type": "application/json",
        "Accept-Language": process.env.DOLYNK_ACCEPT_LANGUAGE || "en-US",
        AccessKey: ak,
        Timestamp: String(ts),
        Nonce,
        Sign: sign,
        ProductId: productId,
        "X-TraceId-Header": `tid-${ts}`,
        Version: "V1",
        "Sign-Type": "simple",
    };
    if (appAccessToken) {
        headers.AppAccessToken = appAccessToken;
    }
    return headers;
}

/**
 * DoLynk Open API POST request.
 * @param {string} path - Path (e.g. /open-api/api-base/auth/getAppAccessToken)
 * @param {object} options - { auth: boolean, appAccessToken?: string, body?: object }
 */
async function openApiFetch(path, options = {}) {
    const { auth = false, appAccessToken = "", body } = options;
    const { ak, sk, productId } = getConfig();

    const bodyStr = body ? JSON.stringify(body) : "";
    const headers = createApiHeader(ak, sk, productId, appAccessToken, auth);
    const fetchOptions = {
        method: "POST",
        headers,
    };
    if (bodyStr) {
        fetchOptions.body = bodyStr;
    }

    const fullUrl = `${BASE_URL}${path}`;
    const res = await fetch(fullUrl, fetchOptions);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.message || data?.msg || `DoLynk API error: ${res.status}`);
    }
    const code = data.code;
    const successCode = code === 0 || code === 200 || code === "0" || code === "200";
    const isError = data.success === false || (code !== undefined && !successCode);
    if (isError) {
        throw new Error(data?.message || data?.msg || "DoLynk API request failed");
    }
    return data;
}

/**
 * Get app access token. Call this before business API calls (e.g. addDevice).
 * Reference: auth API is called with no body; server identifies app by AccessKey and validates Sign.
 */
export async function getDolynkAppAccessToken() {
    const data = await openApiFetch("/open-api/api-base/auth/getAppAccessToken", {
        auth: true,
    });
    return data?.data?.appAccessToken ?? data?.appAccessToken ?? data?.data?.accessToken;
}

/**
 * Bind a device to your DoLynk project (add device).
 * Request body: { deviceId, categoryCode, devCode, devAccount? }. devCode = Dolynk_ + Base64(password).
 */
export async function dolynkAddDevice(accessToken, deviceId, devicePassword) {
    const deviceIdStr = String(deviceId || "").trim();
    const body = {
        deviceId: deviceIdStr,
        categoryCode: CATEGORY_DEFAULT,
        devCode: encryptDevCode(devicePassword),
        devAccount: "admin",
    };
    return openApiFetch("/open-api/api-iot/device/addDevice", {
        auth: false,
        appAccessToken: accessToken,
        body,
    });
}

/**
 * Remove a device from your DoLynk project.
 * Request body: { deviceId } (device serial number). Success: { code: "200", success: true, msg: "Operation is successful." }
 */
export async function dolynkDeleteDevice(accessToken, deviceId) {
    const deviceIdStr = String(deviceId || "").trim();
    return openApiFetch("/open-api/api-iot/device/deleteDevice", {
        auth: false,
        appAccessToken: accessToken,
        body: { deviceId: deviceIdStr },
    });
}
