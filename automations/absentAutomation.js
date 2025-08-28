import cron from "node-cron";
import prisma from "../config/prisma.config.js";

// Store all cron jobs for different companies
const cronJobs = new Map();

/**
 * Convert timezone to cron schedule for 11:50 PM (23:50)
 * Simplified version with better error handling
 */

function getCronScheduleFor11_50PM(timezone) {
  // Handle common timezone cases with a simple mapping
  const timezoneMap = {
    UTC: 23,
    "America/New_York": 4, // UTC+4 (11:50 PM EST = 4:50 AM UTC next day)
    "America/Chicago": 5, // UTC+5 (11:50 PM CST = 5:50 AM UTC next day)
    "America/Denver": 6, // UTC+6 (11:50 PM MST = 6:50 AM UTC next day)
    "America/Los_Angeles": 7, // UTC+7 (11:50 PM PST = 7:50 AM UTC next day)
    "Europe/London": 23, // UTC+23 (11:50 PM GMT = 11:50 PM UTC)
    "Europe/Paris": 22, // UTC+22 (11:50 PM CET = 10:50 PM UTC)
    "Asia/Tokyo": 14, // UTC+14 (11:50 PM JST = 2:50 PM UTC)
    "Africa/Abidjan": 23, // GMT (same as UTC)
    "Africa/Banjul": 23, // GMT (same as UTC)
  };

  try {
    // First validate the timezone
    if (!timezone || typeof timezone !== "string") {
      console.log(`Invalid timezone format: ${timezone}, using UTC fallback`);
      return "0 19 * * 1-5";
    }

    // Check if we have a direct mapping
    if (timezoneMap[timezone]) {
      const hour = timezoneMap[timezone];
      console.log(`🕐 Timezone ${timezone}: 11:50 PM local = ${hour}:50 UTC`);
      return `50 ${hour} * * 1-5`;
    }

    // For other timezones, try dynamic calculation
    try {
      const testDate = new Date("2025-08-11T12:00:00Z"); // Noon UTC
      const localTime = testDate.toLocaleString("en-US", {
        timeZone: timezone,
        hour12: false,
        hour: "numeric",
      });

      const localHour = parseInt(localTime);
      const offsetHours = localHour - 12; // Difference from UTC noon
      let targetUTCHour = 23 - offsetHours; // Adjust 11:50 PM by offset

      // Handle day boundary crossings
      if (targetUTCHour < 0) targetUTCHour += 24;
      if (targetUTCHour >= 24) targetUTCHour -= 24;

      console.log(
        `🕐 Timezone ${timezone}: 11:50 PM local = ${targetUTCHour}:50 UTC (calculated)`
      );
      return `50 ${targetUTCHour} * * 1-5`;
    } catch (calcError) {
      console.error(
        `Timezone calculation failed for ${timezone}:`,
        calcError.message
      );
      console.log(`Using UTC fallback for ${timezone}`);
      return "50 23 * * 1-5";
    }
  } catch (error) {
    console.error(`Error processing timezone ${timezone}:`, error.message);
    console.log(`Using UTC fallback for ${timezone}`);
    return "50 23 * * 1-5";
  }
}

/**
 * Mark employees as absent for a specific company
 */
async function markEmployeesAbsent(companyId, companyTimezone, dryRun = false) {
  console.log(
    `🏢 Running absent automation for company ${companyId} (${companyTimezone}) ${dryRun ? "[DRY RUN]" : ""}`
  );

  try {
    // Get company's local date at midnight for consistent comparison
    const now = new Date();
    const companyLocalDateString = now.toLocaleDateString("en-CA", {
      timeZone: companyTimezone,
    }); // Returns YYYY-MM-DD format

    // Create date object for company's today at midnight
    const companyDateMidnight = new Date(
      `${companyLocalDateString}T00:00:00.000Z`
    );

    console.log(
      `📅 Processing attendance for company ${companyId} on date: ${companyLocalDateString} (${companyTimezone})`
    );

    // Check if absent records already exist for today to prevent duplicates
    const existingAbsentRecords = await prisma.attendance.count({
      where: {
        companyId: companyId,
        date: {
          gte: companyDateMidnight,
          lt: new Date(companyDateMidnight.getTime() + 24 * 60 * 60 * 1000),
        },
        status: "ABSENT",
      },
    });

    if (existingAbsentRecords > 0) {
      console.log(
        `⚠️  Found ${existingAbsentRecords} existing absent records for today in company ${companyId}. Skipping to avoid duplicates.`
      );
      return { success: true, message: "Already processed", count: 0 };
    }

    // Get active employees for this company
    const totalActiveEmployees = await prisma.employee.count({
      where: {
        status: "ACTIVE",
        companyId: companyId,
      },
    });

    console.log(
      `📊 Total active employees in company ${companyId}: ${totalActiveEmployees}`
    );

    // This will NOT affect employees who are currently checked in (have timeIn but no timeOut)
    const employeesWithoutAttendance = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        companyId: companyId,
        attendances: {
          none: {
            date: {
              gte: companyDateMidnight,
              lt: new Date(companyDateMidnight.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        companyId: true,
      },
    });

    console.log(
      `👥 Found ${employeesWithoutAttendance.length} employees without attendance records in company ${companyId}`
    );

    if (employeesWithoutAttendance.length === 0) {
      console.log(`✅ No employees to mark as absent in company ${companyId}`);
      return {
        success: true,
        message: "No employees to mark absent",
        count: 0,
      };
    }

    // Log which employees would be marked absent (for transparency)
    console.log(
      `📋 Employees to be marked absent in company ${companyId}:`,
      employeesWithoutAttendance
        .map((emp) => `${emp.name} (ID: ${emp.id})`)
        .join(", ")
    );

    if (dryRun) {
      console.log(
        `🧪 DRY RUN: Would mark ${employeesWithoutAttendance.length} employees as absent`
      );
      return {
        success: true,
        message: "Dry run completed",
        count: employeesWithoutAttendance.length,
        dryRun: true,
        employees: employeesWithoutAttendance.map((emp) => ({
          id: emp.id,
          name: emp.name,
        })),
      };
    }

    // Create absent attendance records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Double-check within transaction to prevent race conditions
      const employeesToMarkAbsent = await tx.employee.findMany({
        where: {
          id: { in: employeesWithoutAttendance.map((emp) => emp.id) },
          status: "ACTIVE",
          companyId: companyId,
          attendances: {
            none: {
              date: {
                gte: companyDateMidnight,
                lt: new Date(
                  companyDateMidnight.getTime() + 24 * 60 * 60 * 1000
                ),
              },
            },
          },
        },
        select: { id: true, name: true, companyId: true },
      });

      if (employeesToMarkAbsent.length === 0) {
        return { count: 0 };
      }

      // Create absent records
      const absentRecords = await tx.attendance.createMany({
        data: employeesToMarkAbsent.map((employee) => ({
          employeeId: employee.id,
          companyId: employee.companyId,
          date: companyDateMidnight,
          status: "ABSENT",
          timeIn: null,
          timeOut: null,
        })),
      });

      return absentRecords;
    });

    const message = `✅ Marked ${result.count} employees as absent in company ${companyId}`;
    console.log(message);

    return {
      success: true,
      message: "Successfully processed",
      count: result.count,
      date: companyLocalDateString,
    };
  } catch (error) {
    const errorMessage = `❌ Error in absent automation for company ${companyId}: ${error.message}`;
    console.error(errorMessage);

    return {
      success: false,
      message: errorMessage,
      error: error.message,
    };
  } finally {
    // DON'T disconnect - keep singleton connection alive
    // await prisma.$disconnect(); // REMOVED - breaks shared connection
    // Database connection is managed by the singleton pattern in prisma.config.js
  }
}

/**
 * Initialize automation for a single company with delay
 */
async function initializeCompanyAutomationWithDelay(company, delaySeconds = 0) {
  try {
    const cronPattern = getCronScheduleFor11_50PM(company.timezone);

    // Stop existing job if it exists
    if (cronJobs.has(company.id)) {
      cronJobs.get(company.id).stop();
      console.log(`🛑 Stopped existing cron job for company ${company.id}`);
    }

    // Create new cron job for this company with staggered execution
    const job = cron.schedule(
      cronPattern,
      async () => {
        // Add delay to stagger execution between companies
        if (delaySeconds > 0) {
          console.log(
            `⏳ [${new Date().toISOString()}] Waiting ${delaySeconds} seconds before processing company ${company.id}`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delaySeconds * 1000)
          );
        }

        console.log(
          `⏰ [${new Date().toISOString()}] Triggering absent automation for company ${company.id} (${company.companyName})`
        );
        try {
          const result = await markEmployeesAbsent(
            company.id,
            company.timezone
          );
          console.log(
            `✅ Automation completed for company ${company.id}:`,
            result
          );
        } catch (error) {
          console.error(
            `❌ Automation failed for company ${company.id}:`,
            error.message
          );

          // Check if it's a database connection issue
          if (
            error.message.includes("Engine is not yet connected") ||
            error.message.includes("Connection") ||
            error.code === "P1001" ||
            error.code === "P1002"
          ) {
            console.log(
              `🔄 Database connection issue detected for company ${company.id}, will retry next scheduled time`
            );
          } else {
            console.error(
              `💥 Unexpected error for company ${company.id}:`,
              error
            );
          }
        }
      },
      {
        scheduled: true,
        timezone: "UTC", // Always use UTC for cron scheduling since we calculated UTC times
      }
    );

    cronJobs.set(company.id, job);

    console.log(
      `✅ Initialized absent automation for company ${company.id} (${company.companyName})`
    );
    console.log(`   📍 Timezone: ${company.timezone}`);
    console.log(
      `   ⏰ Cron pattern: ${cronPattern} (runs at 11:50 PM ${company.timezone})`
    );
    if (delaySeconds > 0) {
      console.log(`   ⏳ Execution delay: ${delaySeconds} seconds`);
    }

    return { success: true, company: company.id, cronPattern, delaySeconds };
  } catch (error) {
    console.error(
      `❌ Failed to initialize automation for company ${company.id}:`,
      error
    );
    return { success: false, company: company.id, error: error.message };
  }
}

/**
 * Initialize automation for a single company (backward compatibility)
 */
async function initializeCompanyAutomation(company) {
  return await initializeCompanyAutomationWithDelay(company, 0);
}

/**
 * Initialize automation for all companies with staggered execution
 */
async function initializeAllCompanyAutomations() {
  console.log("🚀 Initializing absent automation for all companies...");

  try {
    // Get all companies with their timezones
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        companyName: true,
        timezone: true,
      },
    });

    console.log(
      `📊 Found ${companies.length} companies to set up automation for`
    );

    // Group companies by timezone to identify potential conflicts
    const timezoneGroups = {};
    companies.forEach((company) => {
      if (!timezoneGroups[company.timezone]) {
        timezoneGroups[company.timezone] = [];
      }
      timezoneGroups[company.timezone].push(company);
    });

    console.log("🌍 Companies grouped by timezone:");
    Object.entries(timezoneGroups).forEach(([tz, companyList]) => {
      console.log(`   ${tz}: ${companyList.length} companies`);
      if (companyList.length > 1) {
        console.log(
          `   ⚠️  Multiple companies in ${tz} - will stagger execution`
        );
      }
    });

    const results = [];
    let delayOffset = 0;

    for (const company of companies) {
      const result = await initializeCompanyAutomationWithDelay(
        company,
        delayOffset
      );
      results.push(result);

      // Add 30-second delay for each additional company to prevent concurrent execution
      delayOffset += 30;
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(
      `✅ Successfully initialized automation for ${successCount} companies`
    );
    if (failCount > 0) {
      console.log(
        `❌ Failed to initialize automation for ${failCount} companies`
      );
    }

    return {
      success: true,
      total: companies.length,
      successful: successCount,
      failed: failCount,
    };
  } catch (error) {
    console.error("❌ Error initializing company automations:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop automation for a specific company
 */
function stopCompanyAutomation(companyId) {
  if (cronJobs.has(companyId)) {
    cronJobs.get(companyId).stop();
    cronJobs.delete(companyId);
    console.log(`🛑 Stopped absent automation for company ${companyId}`);
    return {
      success: true,
      message: `Stopped automation for company ${companyId}`,
    };
  } else {
    console.log(`⚠️  No active automation found for company ${companyId}`);
    return {
      success: false,
      message: `No active automation for company ${companyId}`,
    };
  }
}

/**
 * Stop all automations
 */
function stopAllAutomations() {
  console.log("🛑 Stopping all absent automations...");

  let stoppedCount = 0;
  for (const [companyId, job] of cronJobs) {
    job.stop();
    stoppedCount++;
  }

  cronJobs.clear();
  console.log(`✅ Stopped ${stoppedCount} automation jobs`);
  return { success: true, count: stoppedCount };
}

/**
 * Get status of all automations
 */
function getAutomationStatus() {
  const activeJobs = [];

  for (const [companyId, job] of cronJobs) {
    activeJobs.push({
      companyId,
      status: "active",
      nextRun: "Daily at 11:50 PM company local time, Monday-Friday",
    });
  }

  return {
    totalJobs: activeJobs.length,
    activeJobs,
    description:
      "Each company has its own cron job scheduled for 11:50 PM in their local timezone",
  };
}

/**
 * Manually trigger automation for a specific company (for testing)
 */
async function manuallyTriggerForCompany(
  companyId,
  companyTimezone = "UTC",
  dryRun = false
) {
  console.log(
    `🚀 Manually triggering absent automation for company ${companyId}... ${dryRun ? "[DRY RUN]" : ""}`
  );
  return await markEmployeesAbsent(companyId, companyTimezone, dryRun);
}

/**
 * Manually trigger automation for all companies (for testing)
 */
async function manuallyTriggerForAllCompanies(dryRun = false) {
  console.log(
    `🚀 Manually triggering absent automation for all companies... ${dryRun ? "[DRY RUN]" : ""}`
  );

  try {
    const companies = await prisma.company.findMany({
      select: { id: true, companyName: true, timezone: true },
    });

    console.log(
      `📊 Processing ${companies.length} companies sequentially to avoid connection issues...`
    );

    const results = [];
    for (const company of companies) {
      console.log(
        `🔄 Processing company ${company.id} (${company.companyName})...`
      );

      // Add small delay between companies to prevent overwhelming database
      if (results.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }

      const result = await markEmployeesAbsent(
        company.id,
        company.timezone,
        dryRun
      );
      results.push({
        companyId: company.id,
        companyName: company.companyName,
        ...result,
      });
    }

    return { success: true, results };
  } catch (error) {
    console.error("❌ Error in manual trigger for all companies:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Reinitialize automation when companies are added/updated
 */
async function reinitializeAutomation() {
  console.log("🔄 Reinitializing automation system...");
  stopAllAutomations();
  return await initializeAllCompanyAutomations();
}

// Handle graceful shutdown
function setupGracefulShutdown() {
  const shutdownHandler = (signal) => {
    console.log(
      `${signal} received, shutting down absent automation system...`
    );
    stopAllAutomations();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
  process.on("SIGINT", () => shutdownHandler("SIGINT"));
}

// Initialize the automation system
async function initialize() {
  console.log("🚀 Starting Absent Automation System...");
  console.log("⏰ Target time: 11:50 PM in each company's local timezone");
  console.log("📅 Schedule: Monday to Friday only");

  setupGracefulShutdown();
  return await initializeAllCompanyAutomations();
}

// Export all functions
export {
  initialize,
  initializeCompanyAutomation,
  stopCompanyAutomation,
  stopAllAutomations,
  getAutomationStatus,
  manuallyTriggerForCompany,
  manuallyTriggerForAllCompanies,
  reinitializeAutomation,
  markEmployeesAbsent,
  getCronScheduleFor11_50PM,
};
