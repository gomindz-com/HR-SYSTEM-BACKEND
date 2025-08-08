import { triggerAbsentAutomationManually } from "./automations/absentAutomation.js";

console.log("🧪 Testing absent automation...");
console.log("⏰ Current time:", new Date().toISOString());

try {
  await triggerAbsentAutomationManually();
  console.log("✅ Test completed successfully");
} catch (error) {
  console.error("❌ Test failed:", error);
}
