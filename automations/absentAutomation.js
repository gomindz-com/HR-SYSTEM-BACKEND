import cron from "node-cron";
import prisma from "../config/prisma.config.js";
import { isWorkday } from "../utils/automation.utils.js";
import { hasShiftDeadlinePassed } from "../lib/attendance-utils.js";

const cronJobs = new Map();

/**
 * Calculate cron schedule for 00:15 local time in company timezone
 * Runs daily to check yesterday's attendance and mark absent employees
 * @param {string} timezone - Company timezone
 * @returns {string} Cron pattern (minute hour * * *)
 */
function getCronScheduleForDaily(timezone) {
  const timezoneMap = {
    UTC: 0,
    "America/New_York": 5, // 00:15 EST = 05:15 UTC
    "America/Chicago": 6, // 00:15 CST = 06:15 UTC
    "America/Denver": 7, // 00:15 MST = 07:15 UTC
    "America/Los_Angeles": 8, // 00:15 PST = 08:15 UTC
    "Europe/London": 0, // 00:15 GMT = 00:15 UTC
    "Europe/Paris": 23, // 00:15 CET = 23:15 UTC (previous day)
    "Asia/Tokyo": 15, // 00:15 JST = 15:15 UTC (previous day)
    "Africa/Abidjan": 0,
    "Africa/Banjul": 0,
  };

  if (!timezone || typeof timezone !== "string") {
    return "15 0 * * *"; // Default: 00:15 UTC daily
  }

  if (timezoneMap[timezone]) {
    return `15 ${timezoneMap[timezone]} * * *`;
  }

  try {
    const testDate = new Date("2025-08-11T12:00:00Z");
    const localTime = testDate.toLocaleString("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "numeric",
    });

    const localHour = parseInt(localTime);
    const offsetHours = localHour - 12;
    let targetUTCHour = 0 - offsetHours; // Changed from 19 to 0

    if (targetUTCHour < 0) targetUTCHour += 24;
    if (targetUTCHour >= 24) targetUTCHour -= 24;

    return `15 ${targetUTCHour} * * *`; // Changed: minute 15, every day
  } catch (error) {
    return "15 0 * * *"; // Changed: minute 15, hour 0, every day
  }
}

async function markEmployeesAbsent(companyId, companyTimezone, dryRun = false) {
  try {
    const now = new Date();

    // Get TODAY's date in company timezone
    const todayLocalDateString = now.toLocaleDateString("en-CA", {
      timeZone: companyTimezone,
    });

    // Subtract 1 day to get YESTERDAY (since we run at 00:15, we check yesterday's records)
    const todayLocalDate = new Date(`${todayLocalDateString}T00:00:00`);
    const yesterdayLocalDate = new Date(todayLocalDate);
    yesterdayLocalDate.setDate(yesterdayLocalDate.getDate() - 1);

    // Get yesterday's date string
    const companyLocalDateString = yesterdayLocalDate.toLocaleDateString(
      "en-CA",
      {
        timeZone: companyTimezone,
      }
    );

    const companyDateMidnight = new Date(
      `${companyLocalDateString}T00:00:00.000Z`
    );

    const companySettings = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        workStartTime: true,
        workEndTime: true,
        workStartTime2: true,
        workEndTime2: true,
        checkInDeadline: true,
        checkInDeadline2: true,
      },
    });

    if (!companySettings) {
      return {
        success: false,
        message: "Company settings not found",
        count: 0,
      };
    }

    // Check workday configuration
    let workdayConfig = await prisma.workdayDaysConfig.findFirst({
      where: { companyId },
    });

    if (!workdayConfig) {
      workdayConfig = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      };
    }

    // Check if yesterday was a workday (using the date we're checking)
    const companyLocalDate = new Date(companyLocalDateString + "T00:00:00");
    if (!isWorkday(companyLocalDate, workdayConfig)) {
      return {
        success: true,
        message: "Yesterday was not a workday",
        count: 0,
      };
    }

    // Check for existing absent records
    const existingAbsentRecords = await prisma.attendance.count({
      where: {
        companyId,
        date: {
          gte: companyDateMidnight,
          lt: new Date(companyDateMidnight.getTime() + 24 * 60 * 60 * 1000),
        },
        status: "ABSENT",
      },
    });

    if (existingAbsentRecords > 0) {
      return { success: true, message: "Already processed", count: 0 };
    }

    // Find employees without attendance
    const employeesWithoutAttendance = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        companyId,
        emailVerified: true,
        deleted: false,
        attendances: {
          none: {
            date: {
              gte: companyDateMidnight,
              lt: new Date(companyDateMidnight.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        },
      },
      select: { id: true, name: true, companyId: true, shiftType: true },
    });

    if (employeesWithoutAttendance.length === 0) {
      return {
        success: true,
        message: "No employees to mark absent",
        count: 0,
      };
    }

    // Filter employees by shift deadline - only mark absent if their deadline has passed
    const employeesToMarkAbsent = employeesWithoutAttendance.filter(
      (employee) => {
        const shiftType = employee.shiftType || "MORNING_SHIFT";
        return hasShiftDeadlinePassed(companySettings, shiftType, now);
      }
    );

    if (employeesToMarkAbsent.length === 0) {
      return {
        success: true,
        message: "No employees with passed deadlines to mark absent",
        count: 0,
      };
    }

    // Create absent records
    let result;
    if (dryRun) {
      // Dry run - just return the count without creating records
      result = { count: employeesToMarkAbsent.length };
    } else {
      result = await prisma.$transaction(async (tx) => {
        const employeesToMarkAbsentInTx = await tx.employee.findMany({
          where: {
            id: { in: employeesToMarkAbsent.map((emp) => emp.id) },
            companyId,
            deleted: false,
            emailVerified: true,
            status: "ACTIVE",
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
          select: { id: true, name: true, companyId: true, shiftType: true },
        });

        // Filter again in transaction to ensure deadlines still passed
        const finalEmployeesToMarkAbsent = employeesToMarkAbsentInTx.filter(
          (employee) => {
            const shiftType = employee.shiftType || "MORNING_SHIFT";
            return hasShiftDeadlinePassed(companySettings, shiftType, now);
          }
        );

        if (finalEmployeesToMarkAbsent.length === 0) {
          return { count: 0 };
        }

        return await tx.attendance.createMany({
          data: finalEmployeesToMarkAbsent.map((employee) => ({
            employeeId: employee.id,
            companyId: employee.companyId,
            date: companyDateMidnight,
            status: "ABSENT",
            timeIn: null,
            timeOut: null,
          })),
        });
      });
    }

    return {
      success: true,
      message: "Successfully processed",
      count: result.count,
      date: companyLocalDateString,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      error: error.message,
    };
  }
}

async function initializeCompanyAutomation(company) {
  try {
    const cronPattern = getCronScheduleForDaily(company.timezone);

    if (cronJobs.has(company.id)) {
      cronJobs.get(company.id).stop();
    }

    const job = cron.schedule(
      cronPattern,
      async () => {
        console.log(
          `🔥 CRON FIRED at ${new Date().toISOString()} for company ${company.id}`
        );
        const result = await markEmployeesAbsent(company.id, company.timezone);
        console.log(`✅ Result for company ${company.id}:`, result);
      },
      { scheduled: true, timezone: "UTC" }
    );

    console.log(
      `✅ Cron job created for company ${company.id} with pattern: ${cronPattern}`
    );

    cronJobs.set(company.id, job);
    return { success: true, company: company.id };
  } catch (error) {
    return { success: false, company: company.id, error: error.message };
  }
}

async function initializeAllCompanyAutomations() {
  try {
    const companies = await prisma.company.findMany({
      select: { id: true, companyName: true, timezone: true },
    });

    const results = [];
    for (const company of companies) {
      const result = await initializeCompanyAutomation(company);
      results.push(result);
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function stopCompanyAutomation(companyId) {
  if (cronJobs.has(companyId)) {
    cronJobs.get(companyId).stop();
    cronJobs.delete(companyId);
    return {
      success: true,
      message: `Stopped automation for company ${companyId}`,
    };
  }
  return {
    success: false,
    message: `No active automation for company ${companyId}`,
  };
}

function stopAllAutomations() {
  for (const [companyId, job] of cronJobs) {
    job.stop();
  }
  cronJobs.clear();
  return { success: true };
}

function getAutomationStatus() {
  const activeJobs = [];
  for (const [companyId] of cronJobs) {
    activeJobs.push({ companyId, status: "active" });
  }
  return { totalJobs: activeJobs.length, activeJobs };
}

async function manuallyTriggerForCompany(companyId, companyTimezone = "UTC") {
  return await markEmployeesAbsent(companyId, companyTimezone);
}

async function manuallyTriggerForAllCompanies(dryRun = false) {
  try {
    const companies = await prisma.company.findMany({
      select: { id: true, companyName: true, timezone: true },
    });

    const results = [];
    for (const company of companies) {
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
    return { success: false, error: error.message };
  }
}

async function initialize() {
  try {
    const result = await initializeAllCompanyAutomations();
    const successful = result.results.filter((r) => r.success).length;
    const failed = result.results.filter((r) => !r.success).length;

    return {
      success: result.success,
      total: result.results.length,
      successful,
      failed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      total: 0,
      successful: 0,
      failed: 0,
    };
  }
}

export {
  initialize,
  initializeCompanyAutomation,
  stopCompanyAutomation,
  stopAllAutomations,
  getAutomationStatus,
  manuallyTriggerForCompany,
  manuallyTriggerForAllCompanies,
  markEmployeesAbsent,
  getCronScheduleForDaily,
};
