/**
 * Dahua biometric adapter: Digest auth, test, event stream (eventManager.cgi).
 * Subscribes with codes=[AccessControl]; parses multipart/x-mixed-replace stream.
 */
import axios from "axios";
import crypto from "crypto";

const activeStreams = new Map();
export const isStreaming = true;

/** Build HTTP Digest Authorization header (many Dahua devices require Digest, not Basic). */
function buildDigestAuth(method, url, username, password, challenge) {
    const realm = challenge.realm || "";
    const nonce = challenge.nonce || "";
    const qop = challenge.qop || "";
    const opaque = challenge.opaque || "";
    const uri = url.replace(/^https?:\/\/[^/]+/, "") || "/"; // path + query
    const cnonce = crypto.randomBytes(8).toString("hex");
    const nc = "00000001";

    const md5 = (s) => crypto.createHash("md5").update(s, "utf8").digest("hex");
    const HA1 = md5(`${username}:${realm}:${password}`);
    const HA2 = md5(`${method}:${uri}`);
    const response = qop.toLowerCase().includes("auth")
        ? md5(`${HA1}:${nonce}:${nc}:${cnonce}:auth:${HA2}`)
        : md5(`${HA1}:${nonce}:${HA2}`);

    let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
    if (qop) header += `, qop="auth", nc=${nc}, cnonce="${cnonce}"`;
    if (opaque) header += `, opaque="${opaque}"`;
    return header;
}

/** Parse WWW-Authenticate: Digest ... header into { realm, nonce, qop, opaque }. */
function parseDigestChallenge(header) {
    if (!header || !header.toLowerCase().startsWith("digest ")) return null;
    const params = {};
    const parts = header.slice(7).split(",");
    for (const p of parts) {
        const m = p.trim().match(/^(\w+)=(.+)$/);
        if (m) params[m[1].toLowerCase()] = m[2].replace(/^"?|"?$/g, "").trim();
    }
    return params;
}

/** GET with Basic auth; on 401, retry with Digest if server sends Digest challenge. */
async function dahuaGet(url, device, options = {}) {
    const { timeout = 5000, responseType = "json" } = options;
    const auth = { username: device.username, password: device.password };

    let res = await axios.get(url, { auth, timeout, responseType, validateStatus: () => true });
    if (res.status === 200) return res;
    if (res.status !== 401) return res;

    let wwwAuth = res.headers["www-authenticate"];
    if (Array.isArray(wwwAuth)) wwwAuth = wwwAuth.find((h) => h && h.toLowerCase().startsWith("digest ")) || wwwAuth[0];
    const challenge = parseDigestChallenge(wwwAuth);
    if (!challenge) return res;

    const digestHeader = buildDigestAuth("GET", url, device.username, device.password, challenge);
    res = await axios.get(url, {
        headers: { Authorization: digestHeader },
        timeout,
        responseType,
        validateStatus: () => true,
    });
    return res;
}

/** Extract boundary from Content-Type (e.g. "multipart/x-mixed-replace; boundary=myboundary"). */
function getBoundary(contentType) {
    if (!contentType) return null;
    const m = contentType.match(/boundary\s*=\s*["']?([^"'\s;]+)["']?/i);
    return m ? m[1].trim() : null;
}

/** Parse one multipart part: find JSON and extract AccessControl event (UserID + timestamp). */
function parseMultipartPart(part) {
    const body = part.includes("\r\n\r\n") ? part.split("\r\n\r\n").slice(1).join("\r\n\r\n") : part;
    const jsonStart = body.indexOf("{");
    if (jsonStart === -1) return null;
    const jsonEnd = body.lastIndexOf("}");
    if (jsonEnd < jsonStart) return null;
    try {
        const obj = JSON.parse(body.substring(jsonStart, jsonEnd + 1));
        const isAccessControl =
            obj.Method === "client.index.accessControl" ||
            (Array.isArray(obj.Events) && obj.Events.some((e) => e.Code === "AccessControl"));
        if (!isAccessControl) return null;
        const data = obj.params?.data ?? obj.Events?.[0]?.Data ?? obj;
        const userId = data.UserID ?? data.userId;
        if (userId == null) return null;
        let timestamp = new Date();
        if (data.UTC != null) timestamp = new Date(Number(data.UTC) * 1000);
        else if (data.Time != null) timestamp = new Date(Number(data.Time) * 1000);
        else if (data.timestamp != null) timestamp = new Date(data.timestamp);
        return { UserID: String(userId), timestamp };
    } catch (_) {
        return null;
    }
}

/** Fallback: legacy data=({...}) with UserID/UTC. */
function parseLegacyChunk(raw) {
    const match = raw.match(/data\s*=\s*(\{[\s\S]*?\})\s*[\r\n]?/);
    if (!match) return null;
    try {
        const obj = JSON.parse(match[1]);
        const userId = obj.UserID ?? obj.CardNo;
        const utc = obj.UTC ?? obj.Time;
        if (userId == null || utc == null) return null;
        return { UserID: String(userId), timestamp: new Date(Number(utc) * 1000) };
    } catch (_) {
        return null;
    }
}

const normalizeEvent = (device, payload) => ({
    companyId: device.companyId,
    deviceId: device.id,
    biometricUserId: payload.UserID,
    timestamp: payload.timestamp instanceof Date ? payload.timestamp : new Date(payload.timestamp),
    eventType: "CHECK_IN",
});

export const startListening = async (device, onEvent) => {
    const url = `http://${device.host}:${device.port || 80}/cgi-bin/eventManager.cgi?action=attach&codes=[AccessControl]`;
    let lastEventTime = Date.now();
    let buffer = "";
    let boundary = null;

    const processPart = (part) => {
        const payload = parseMultipartPart(part);
        if (payload) {
            const normalized = normalizeEvent(device, payload);
            console.log(`[Dahua] Event: BioID=${normalized.biometricUserId}, time=${normalized.timestamp.toISOString()}`);
            onEvent(normalized);
            return;
        }
        const legacy = parseLegacyChunk(part);
        if (legacy) {
            const normalized = normalizeEvent(device, legacy);
            console.log(`[Dahua] Event: BioID=${normalized.biometricUserId}, time=${normalized.timestamp.toISOString()}`);
            onEvent(normalized);
        }
    };

    const connectToDevice = async () => {
        try {
            const response = await dahuaGet(url, device, { timeout: 10000, responseType: "stream" });
            if (response.status !== 200) {
                console.warn(`[Dahua] Stream got ${response.status} for ${device.name}, retry in 10s`);
                setTimeout(connectToDevice, 10000);
                return;
            }
            const contentType = response.headers["content-type"] || "";
            boundary = getBoundary(contentType);
            if (!boundary) boundary = "myboundary";
            buffer = "";
            console.log(`[Dahua] Connected to ${device.name} (multipart boundary=${boundary})`);

            const verbose = !!process.env.DAHUA_VERBOSE;

            const monitor = setInterval(() => {
                if (Date.now() - lastEventTime > 60000) {
                    console.warn(`[Dahua] Stream timeout for ${device.name}. Restarting...`);
                    stopListening(device.id);
                    connectToDevice();
                }
            }, 30000);

            response.data.on("data", (chunk) => {
                lastEventTime = Date.now();
                const raw = chunk.toString();
                if (verbose && raw.length > 0) {
                    const preview = raw.length > 280 ? raw.slice(0, 280) + "..." : raw;
                    console.log(`[Dahua] Chunk:`, preview.replace(/\n/g, " "));
                }
                buffer += raw.replace(/\r\n/g, "\n");
                const delimiter = "\n--" + boundary;
                const parts = buffer.split(delimiter);
                buffer = parts.pop() || "";
                for (let i = 0; i < parts.length; i++) {
                    if (i === 0 && parts[i].trim().indexOf("{") < 0) continue;
                    processPart(parts[i]);
                }
            });
            response.data.on("error", () => {
                stopListening(device.id);
                setTimeout(connectToDevice, 10000);
            });

            activeStreams.set(device.id, { stream: response.data, monitor });
        } catch (err) {
            console.warn(`[Dahua] Stream error for ${device.name}:`, err.message);
            setTimeout(connectToDevice, 10000);
        }
    };

    connectToDevice();
    return () => stopListening(device.id);
};

export const stopListening = (deviceId) => {
    const entry = activeStreams.get(deviceId);
    if (entry) {
        clearInterval(entry.monitor);
        if (entry.stream && typeof entry.stream.destroy === "function") entry.stream.destroy();
        activeStreams.delete(deviceId);
    }
};

export const testConnection = async (device) => {
    const port = device.port || 80;
    const url = `http://${device.host}:${port}/cgi-bin/configManager.cgi?action=getConfig&name=General`;
    try {
        const res = await dahuaGet(url, device, { timeout: 5000 });
        if (res.status === 200) {
            console.log(`[Dahua] Test OK: ${device.name} (${device.host}:${port})`);
            return true;
        }
        console.warn(`[Dahua] Test unexpected status: ${device.name} -> ${res.status}`);
        return false;
    } catch (err) {
        const status = err.response?.status;
        const code = err.code || err.response?.data?.code;
        const msg = err.message || "";
        console.warn(`[Dahua] Test failed: ${device.name} (${device.host}:${port})`, {
            message: msg,
            code: code || err.code,
            httpStatus: status,
            url,
        });
        return false;
    }
};

/** Format for Dahua recordFinder (YYYY-MM-DD HH:mm:ss). */
function formatDahuaTime(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Parse recordFinder text response into array of { UserID, timestamp }. */
function parseRecordFinderBody(body) {
    const text = typeof body === "string" ? body : String(body ?? "");
    const foundMatch = text.match(/found\s*=\s*(\d+)/);
    const count = foundMatch ? parseInt(foundMatch[1], 10) : 0;
    if (count === 0) return [];
    const records = [];
    for (let i = 0; i < count; i++) {
        const rec = {};
        const re = new RegExp(`records\\[${i}\\]\\.(\\w+)=([^\\r\\n]*)`, "g");
        let m;
        while ((m = re.exec(text)) !== null) rec[m[1]] = m[2].trim();
        const userId = rec.UserID ?? rec.userId;
        if (userId == null) continue;
        let timestamp = new Date();
        if (rec.Time != null && rec.Time !== "") timestamp = new Date(Number(rec.Time) * 1000);
        else if (rec.Timestamp != null && rec.Timestamp !== "") timestamp = new Date(rec.Timestamp);
        else if (rec.UTC != null && rec.UTC !== "") timestamp = new Date(Number(rec.UTC) * 1000);
        records.push({ UserID: String(userId), timestamp });
    }
    return records;
}

/**
 * Fetch attendance records from device for a time range (backup when stream misses data).
 * Returns [{ UserID, timestamp }, ...]. Resolves to [] if API returns non-200 or unsupported format.
 */
export const fetchAttendanceRecords = async (device, startDate, endDate) => {
    const port = device.port || 80;
    const start = formatDahuaTime(startDate);
    const end = formatDahuaTime(endDate);
    const url = `http://${device.host}:${port}/cgi-bin/recordFinder.cgi?action=find&name=Attendance&condition.StartTime=${encodeURIComponent(start)}&condition.EndTime=${encodeURIComponent(end)}`;
    try {
        const res = await dahuaGet(url, device, { timeout: 10000, responseType: "text" });
        if (res.status !== 200) return [];
        const body = typeof res.data === "string" ? res.data : String(res.data ?? "");
        if (/^\s*Error\s/mi.test(body) || /found\s*=\s*0\s*$/m.test(body)) return [];
        return parseRecordFinderBody(body);
    } catch (_) {
        return [];
    }
};