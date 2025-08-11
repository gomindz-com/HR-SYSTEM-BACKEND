import cron from "node-cron";
import prisma from "../config/prisma.config.js";

// Store all cron jobs for different companies
const cronJobs = new Map();

/**
 * Convert timezone to cron schedule for 7 PM (19:00)
 * This function calculates what UTC time corresponds to 7 PM in the company's timezone
 */
function getCronScheduleFor7PM(timezone) {
  try {
    // Create a date for today at 7 PM in the company's timezone
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Create 7 PM in company timezone
    const sevenPM = new Date(today.toLocaleString('en-CA', { timeZone: timezone }));
    sevenPM.setHours(19, 0, 0, 0); // Set to 7 PM
    
    // Convert back to get what this time is in UTC
    const utcTime = new Date(sevenPM.toLocaleString('en-CA', { timeZone: 'UTC' }));
    const utcHour = utcTime.getHours();
    const utcMinute = utcTime.getMinutes();
    
    // Return cron pattern: "minute hour * * 1-5" (Monday to Friday)
    return `${utcMinute} ${utcHour} * * 1-5`;
  } catch (error) {
    console.error(`Error calculating cron schedule for timezone ${timezone}:`, error);
    // Fallback to 7 PM UTC if timezone calculation fails
    return "0 19 * * 1-5";
  }
}

/**
 * Mark employees as absent for a specific company
 */
async function markEmployeesAbsent(companyId, companyTimezone) {
  console.log(`🏢 Running absent automation for company ${companyId} (${companyTimezone})`);
  
  try {
    await prisma.$connect();

    // Get company's local date at midnight for consistent comparison
    const now = new Date();
    const companyLocalDateString = now.toLocaleDateString('en-CA', { 
      timeZone: companyTimezone 
    }); // Returns YYYY-MM-DD format
    
    // Create date object for company's today at midnight
    const companyDateMidnight = new Date(`${companyLocalDateString}T00:00:00.000Z`);
    
    console.log(`📅 Processing attendance for company ${companyId} on date: ${companyLocalDateString} (${companyTimezone})`);

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
      console.log(`⚠️  Found ${existingAbsentRecords} existing absent records for today in company ${companyId}. Skipping to avoid duplicates.`);
      return { success: true, message: "Already processed", count: 0 };
    }

    // Get active employees for this company
    const totalActiveEmployees = await prisma.employee.count({
      where: {
        status: "ACTIVE",
        companyId: companyId,
      },
    });
    
    console.log(`📊 Total active employees in company ${companyId}: ${totalActiveEmployees}`);

    // Find active employees who haven't checked in today
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

    console.log(`👥 Found ${employeesWithoutAttendance.length} employees without attendance records in company ${companyId}`);

    if (employeesWithoutAttendance.length === 0) {
      console.log(`✅ No employees to mark as absent in company ${companyId}`);
      return { success: true, message: "No employees to mark absent", count: 0 };
    }

    // Create absent attendance records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Double-check within transaction to prevent race conditions
      const employeesToMarkAbsent = await tx.employee.findMany({
        where: {
          id: { in: employeesWithoutAttendance.map(emp => emp.id) },
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
      date: companyLocalDateString
    };

  } catch (error) {
    const errorMessage = `❌ Error in absent automation for company ${companyId}: ${error.message}`;
    console.error(errorMessage);
    
    return { 
      success: false, 
      message: errorMessage, 
      error: error.message 
    };
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting from database:", disconnectError);
    }
  }
}

/**
 * Initialize automation for a single company
 */
async function initializeCompanyAutomation(company) {
  try {
    const cronPattern = getCronScheduleFor7PM(company.timezone);
    
    // Stop existing job if it exists
    if (cronJobs.has(company.id)) {
      cronJobs.get(company.id).stop();
      console.log(`🛑 Stopped existing cron job for company ${company.id}`);
    }

    // Create new cron job for this company
    const job = cron.schedule(
      cronPattern,
      async () => {
        console.log(`⏰ [${new Date().toISOString()}] Triggering absent automation for company ${company.id} (${company.companyName})`);
        await markEmployeesAbsent(company.id, company.timezone);
      },
      {
        scheduled: true,
        timezone: "UTC", // Always use UTC for cron scheduling since we calculated UTC times
      }
    );

    cronJobs.set(company.id, job);
    
    console.log(`✅ Initialized absent automation for company ${company.id} (${company.companyName})`);
    console.log(`   📍 Timezone: ${company.timezone}`);
    console.log(`   ⏰ Cron pattern: ${cronPattern} (runs at 7 PM ${company.timezone})`);
    
    return { success: true, company: company.id, cronPattern };
  } catch (error) {
    console.error(`❌ Failed to initialize automation for company ${company.id}:`, error);
    return { success: false, company: company.id, error: error.message };
  }
}

/**
 * Initialize automation for all companies
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

    console.log(`📊 Found ${companies.length} companies to set up automation for`);

    const results = [];
    for (const company of companies) {
      const result = await initializeCompanyAutomation(company);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`✅ Successfully initialized automation for ${successCount} companies`);
    if (failCount > 0) {
      console.log(`❌ Failed to initialize automation for ${failCount} companies`);
    }

    return { success: true, total: companies.length, successful: successCount, failed: failCount };
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
    return { success: true, message: `Stopped automation for company ${companyId}` };
  } else {
    console.log(`⚠️  No active automation found for company ${companyId}`);
    return { success: false, message: `No active automation for company ${companyId}` };
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
      status: 'active',
      nextRun: 'Daily at 7 PM company local time, Monday-Friday'
    });
  }

  return {
    totalJobs: activeJobs.length,
    activeJobs,
    description: "Each company has its own cron job scheduled for 7 PM in their local timezone"
  };
}

/**
 * Manually trigger automation for a specific company (for testing)
 */
async function manuallyTriggerForCompany(companyId, companyTimezone = "UTC") {
  console.log(`🚀 Manually triggering absent automation for company ${companyId}...`);
  return await markEmployeesAbsent(companyId, companyTimezone);
}

/**
 * Manually trigger automation for all companies (for testing)
 */
async function manuallyTriggerForAllCompanies() {
  console.log("🚀 Manually triggering absent automation for all companies...");
  
  try {
    const companies = await prisma.company.findMany({
      select: { id: true, companyName: true, timezone: true },
    });

    console.log(`📊 Processing ${companies.length} companies...`);

    const results = [];
    for (const company of companies) {
      const result = await markEmployeesAbsent(company.id, company.timezone);
      results.push({ companyId: company.id, companyName: company.companyName, ...result });
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
    console.log(`${signal} received, shutting down absent automation system...`);
    stopAllAutomations();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
  process.on("SIGINT", () => shutdownHandler("SIGINT"));
}

// Initialize the automation system
async function initialize() {
  console.log("🚀 Starting Absent Automation System...");
  console.log("⏰ Target time: 7:00 PM in each company's local timezone");
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
  getCronScheduleFor7PM,
};