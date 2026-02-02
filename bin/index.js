import dotenv from "dotenv";
import http from "http";
import os from "os";
import app from "../app.js";
import { startAllDevices } from "../services/deviceManager.js";
dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", async () => {
  // Find your local network IP address
  const interfaces = os.networkInterfaces();
  let localIp = "localhost";
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIp = iface.address;
      }
    }
  }


  await startAllDevices()
  console.log(`💪💪Server is running on:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIp}:${PORT}`);
});
