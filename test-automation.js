import dotenv from "dotenv";
import { runAbsentAutomation } from "./automations/absentAutomation.js";

// Load environment variables
dotenv.config();

console.log("🧪 Testing absent automation...");

// Test the automation function
try {
  await runAbsentAutomation();
  console.log("✅ Automation test completed successfully");
} catch (error) {
  console.error("❌ Automation test failed:", error);
  process.exit(1);
}
