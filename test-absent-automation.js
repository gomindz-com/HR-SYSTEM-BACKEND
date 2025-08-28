import { manuallyTriggerForAllCompanies } from "./automations/absentAutomation.js";

console.log("🧪 Testing absent automation...");
console.log("⏰ Current time:", new Date().toISOString());

try {
  const result = await manuallyTriggerForAllCompanies(true); // DRY RUN
  console.log("✅ Test completed successfully:", result);
} catch (error) {
  console.error("❌ Test failed:", error);
}
