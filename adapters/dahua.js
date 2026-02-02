import axios from "axios";

const activeStreams = new Map();





// Parse Dahua's multipart stream format
const parseDahuaChunk = (chunk) => {
    const match = chunk.match(/data=({.*?}))/);

    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (error) {
        return null;
    }
}



//  Normalize Dahua's event to standard format

const normalizeEvent = (device, rawEvent) => ({
    companyId: device.companyId,
    deviceId: device.id,
    biometricUserId: rawEvent.UserID?.toString() || rawEvent.CardNo?.toString(),
    timestamp: new Date(rawEvent.UTC * 1000),
    eventType: 'CHECK_IN'
});


// Start listening to Dahua device stream



const startListening = async (device, onEvent) => {
    const url = `http://${device.host}:${device.port || 80}/cgi-bin/snapManager.cgi?action=attachFileProc&Flags[0]=Event&Events=[AccessControl]&heartbeat=5`;

    const connectToDevice = () => {
        axios({
            method: 'get',
            url,
            auth: { username: device.username, password: device.password },
            responseType: 'stream',
            timeout: 0
        })
            .then(response => {
                console.log(`[Dahua] Connected to deviced ${device.name}`)


                response.data.on('data', chunk => {
                    try {
                        const rawEvent = parseDahuaChunk(chunk);
                        if (rawEvent) {
                            const normalizedEvent = normalizeEvent(device, rawEvent)
                            onEvent(normalizedEvent)
                        }
                    } catch (error) {
                        console.error(`[Dahua] Error parsing chunk: ${error.message}`)
                    }
                })

                response.data.on('error', err => {
                    console.error(`[Dahua] Error reading stream: ${err.message}`)
                    stopListening(device)
                    setTimeout(() => connectToDevice(), 5000)
                })

                activeStreams.set(device.id, response.data)
            })

            .catch(err => {
                console.error(`[Dahua] Failed to connect to device ${device.name}: ${err.message}`)
                setTimeout(() => connectToDevice(), 10000
                )
            })
    }


    connectToDevice();
    return () => stopListening(device.id)
}


// Stop listening to Dahua device stream
const stopListening = (deviceId) => {
    const stream = activeStreams.get(deviceId)

    if (stream) {
        stream.destroy();
        activeStreams.delete(deviceId)
        console.log(`[Dahua] Stopped listening to device ${deviceId}`)
    }
}



// Test connection to Dahua device

const testConnection = async (device) => {
    const url = `http://${device.host}:${device.port || 80}/cgi-bin/snapManager.cgi?action=attachFileProc&Flags[0]=Event&Events=[AccessControl]&heartbeat=5`;

    try {
        const response = await axios({
            method: 'get',
            url,
            auth: { username: device.username, password: device.password },
            responseType: 'stream',
            timeout: 0
        })

        return response.status === 200;
    } catch (error) {
        console.error(`[Dahua] Failed to connect to device ${device.name}: ${error.message}`)
        return false;
    }
}


export { startListening, stopListening, testConnection }