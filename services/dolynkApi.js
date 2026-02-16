/**
 * DoLynk Open API client for Dahua device binding.
 * Uses simplified signature mode: HMAC-SHA512(ak + timestamp + Nonce [+ appAccessToken for business], sk), hex uppercase.
 */

import crypto from "crypto";

const BASE_URL = process.env.DOLYNK_API_BASE_URL || "https://open.dolynkcloud.com";
const CATEGORY_ASI = "ASI";

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

/**
 * Build request headers.
 * Simplified (no bodyStr): Sign = HMAC-SHA512(ak + ts + Nonce [, + appAccessToken], sk).
 * Standard (bodyStr): stringToSign = 'POST' + '\n' + SHA512(bodyNoSpaces); str = ak + appAccessToken + ts + Nonce + stringToSign; Sign = HMAC-SHA512(str, sk).
 */
function createApiHeader(ak, sk, productId, appAccessToken, auth, bodyStr) {
    const ts = Date.now();
    const Nonce = `web-${guidLike()}-${ts}`;

    let stringToSign;
    if (bodyStr) {
        const bodyNoSpaces = bodyStr.replace(/\s/g, "");
        stringToSign = "POST\n" + crypto.createHash("sha512").update(bodyNoSpaces, "utf8").digest("hex");
    } else {
        stringToSign = "POST";
    }
    const str = auth
        ? ak + ts + Nonce + stringToSign
        : ak + (appAccessToken || "") + ts + Nonce + stringToSign;

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
    const headers = createApiHeader(ak, sk, productId, appAccessToken, auth, bodyStr);
    const fetchOptions = {
        method: "POST",
        headers,
    };
    if (bodyStr) {
        fetchOptions.body = bodyStr;
    }

    const res = await fetch(`${BASE_URL}${path}`, fetchOptions);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.message || data?.msg || `DoLynk API error: ${res.status}`);
    }
    const isError = data.success === false || (data.code !== undefined && data.code !== 0 && data.code !== 200);
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
 * @param {string} accessToken - From getDolynkAppAccessToken()
 * @param {string} deviceId - Device serial number
 * @param {string} devicePassword - Device admin password
 */
export async function dolynkAddDevice(accessToken, deviceId, devicePassword) {
    const body = {
        deviceId,
        categoryCode: CATEGORY_ASI,
        devicePassword,
        appAccessToken: accessToken,
    };
    return openApiFetch("/open-api/api-iot/device/addDevice", {
        auth: false,
        appAccessToken: accessToken,
        body,
    });
}
