#!/usr/bin/env node
/**
 * Test script to verify the absent automation fix
 * This simulates the concurrent execution issue and tests the solution
 */

import { manuallyTriggerForAllCompanies } from "./automations/absentAutomation.js";

console.log("🧪 Testing absent automation fix...");
console.log("📋 This will run a DRY RUN to test the connection handling");
console.log("=".repeat(60));

try {
  const result = await manuallyTriggerForAllCompanies(true); // DRY RUN

  if (result.success) {
    console.log("✅ TEST PASSED: Automation completed successfully");
    console.log(`📊 Processed ${result.results.length} companies`);

    result.results.forEach((company) => {
      if (company.success) {
        console.log(
          `   ✅ Company ${company.companyId} (${company.companyName}): ${company.count} employees would be marked absent`
        );
      } else {
        console.log(
          `   ❌ Company ${company.companyId} (${company.companyName}): ${company.message}`
        );
      }
    });
  } else {
    console.log("❌ TEST FAILED:", result.error);
  }
} catch (error) {
  console.error("💥 TEST CRASHED:", error.message);
  console.error("Stack:", error.stack);
}

console.log("=".repeat(60));
console.log("🏁 Test completed");
