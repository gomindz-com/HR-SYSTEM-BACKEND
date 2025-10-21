import cron from "node-cron";
import prisma from "../config/prisma.config.js";
import { isWorkday } from "../utils/automation.utils.js";

const cronJobs = new Map();

function getCronScheduleFor7PM(timezone) {
  const timezoneMap = {
    UTC: 19,
    "America/New_York": 0,
    "America/Chicago": 1,
    "America/Denver": 2,
    "America/Los_Angeles": 3,
    "Europe/London": 19,
    "Europe/Paris": 18,
    "Asia/Tokyo": 10,
    "Africa/Abidjan": 19,
    "Africa/Banjul": 19,
  };

  if (!timezone || typeof timezone !== "string") {
    return "0 19 * * 1-5";
  }

  if (timezoneMap[timezone]) {
    return `0 ${timezoneMap[timezone]} * * 1-5`;
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
    let targetUTCHour = 19 - offsetHours;

    if (targetUTCHour < 0) targetUTCHour += 24;
    if (targetUTCHour >= 24) targetUTCHour -= 24;

    return `0 ${targetUTCHour} * * 1-5`;
  } catch (error) {
    return "0 19 * * 1-5";
  }
}

async function markEmployeesAbsent(companyId, companyTimezone) {
  try {
    const now = new Date();
    const companyLocalDateString = now.toLocaleDateString("en-CA", {
      timeZone: companyTimezone,
    });
    const companyDateMidnight = new Date(`${companyLocalDateString}T00:00:00.000Z`);

    // Check workday configuration
    const workdayConfig = await prisma.workdayDaysConfig.findFirst({
      where: { companyId },
    });

    if (!workdayConfig) {
      return { success: true, message: "No workday configuration", count: 0 };
    }

    if (!isWorkday(now, workdayConfig)) {
      return { success: true, message: "Not a workday", count: 0 };
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

    if (employeesWithoutAttendance.length === 0) {
      return { success: true, message: "No employees to mark absent", count: 0 };
    }

    // Create absent records
    const result = await prisma.$transaction(async (tx) => {
      const employeesToMarkAbsent = await tx.employee.findMany({
        where: {
          id: { in: employeesWithoutAttendance.map((emp) => emp.id) },
          status: "ACTIVE",
          companyId,
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

      return await tx.attendance.createMany({
        data: employeesToMarkAbsent.map((employee) => ({
          employeeId: employee.id,
          companyId: employee.companyId,
          date: companyDateMidnight,
          status: "ABSENT",
          timeIn: null,
          timeOut: null,
        })),
      });
    });

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
    const cronPattern = getCronScheduleFor7PM(company.timezone);

    if (cronJobs.has(company.id)) {
      cronJobs.get(company.id).stop();
    }

    const job = cron.schedule(
      cronPattern,
      async () => {
        await markEmployeesAbsent(company.id, company.timezone);
      },
      { scheduled: true, timezone: "UTC" }
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
    return { success: true, message: `Stopped automation for company ${companyId}` };
  }
  return { success: false, message: `No active automation for company ${companyId}` };
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

export {
  initializeCompanyAutomation,
  stopCompanyAutomation,
  stopAllAutomations,
  getAutomationStatus,
  manuallyTriggerForCompany,
  markEmployeesAbsent,
};