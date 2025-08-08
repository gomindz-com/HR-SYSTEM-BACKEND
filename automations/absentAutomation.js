import cron from "node-cron";
import prisma from "../config/prisma.config.js";

// Store the cron job reference for graceful shutdown
let absentAutomationJob = null;

// Function to run absent automation for a specific company
async function runAbsentAutomationForCompany(
  companyId,
  companyTimezone = "UTC",
  forceRun = false
) {
  console.log(
    `🏢 Running absent automation for company ${companyId} (${companyTimezone})`
  );

  try {
    // Get company's local time
    const companyLocalTime = new Date().toLocaleString("en-US", {
      timeZone: companyTimezone,
    });
    const companyDate = new Date(companyLocalTime);
    const companyHour = companyDate.getHours();

    console.log(
      `⏰ Company local time: ${companyLocalTime} (Hour: ${companyHour})`
    );

    // Check if we're in production or development to determine target time
    const isProduction = process.env.NODE_ENV === "production";
    const targetHour = isProduction ? 18 : 17; // 6:00 PM for production, 5:00 PM for development
    const targetTime = isProduction ? "6:00 PM" : "5:00 PM";

    // Only run if it's the target time in the company's timezone (unless forced)
    if (!forceRun && companyHour !== targetHour) {
      console.log(
        `⏭️  Skipping - it's not ${targetTime} in ${companyTimezone}`
      );
      return;
    }

    // Check if it's weekend in the company's timezone
    const dayOfWeek = companyDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(
        `📅 Weekend detected in ${companyTimezone} (${dayOfWeek === 0 ? "Sunday" : "Saturday"}), skipping absent automation`
      );
      return;
    }

    // Validate database connection
    await prisma.$connect();

    // Get the company's local date at midnight for consistent comparison
    // Create a new date object in the company's timezone for today
    const now = new Date();
    const companyLocalDate = new Date(
      now.toLocaleString("en-US", {
        timeZone: companyTimezone,
      })
    );

    // Set to midnight in the company's timezone
    const companyDateMidnight = new Date(companyLocalDate);
    companyDateMidnight.setHours(0, 0, 0, 0);

    console.log(
      `Processing attendance for company ${companyId} on date: ${companyDateMidnight.toISOString().split("T")[0]} (${companyTimezone})`
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
      return;
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

    // Find active employees in this company who haven't checked in today
    const employeesWithoutAttendance = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        companyId: companyId,
        // Exclude employees who already have attendance records for today
        attendances: {
          none: {
            date: {
              gte: companyDateMidnight,
              lt: new Date(companyDateMidnight.getTime() + 24 * 60 * 60 * 1000), // Next day
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
      `Found ${employeesWithoutAttendance.length} employees without attendance records in company ${companyId}`
    );

    if (employeesWithoutAttendance.length === 0) {
      console.log(`No employees to mark as absent in company ${companyId}`);
      return;
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Double-check for existing records within transaction
      const employeesToMarkAbsent = await tx.employee.findMany({
        where: {
          id: {
            in: employeesWithoutAttendance.map((emp) => emp.id),
          },
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
        select: {
          id: true,
          name: true,
          companyId: true,
        },
      });

      if (employeesToMarkAbsent.length === 0) {
        return { count: 0 };
      }

      // Create absent attendance records for all employees who haven't checked in
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

    console.log(
      `✅ Marked ${result.count} employees as absent in company ${companyId}`
    );
  } catch (error) {
    console.error(
      `Error in absent automation for company ${companyId}:`,
      error
    );

    // Log specific error details for debugging
    if (error.code) {
      console.error(`Database error code: ${error.code}`);
    }
    if (error.meta) {
      console.error(`Error metadata:`, error.meta);
    }
  } finally {
    // Ensure database connection is properly closed
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting from database:", disconnectError);
    }
  }
}

// Function to run absent automation for all companies
async function runAbsentAutomationForAllCompanies(forceRun = false) {
  console.log("🔄 Running absent automation for all companies...");
  console.log(`⏰ Server time: ${new Date().toISOString()}`);

  try {
    // Get all companies with their timezones
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        companyName: true,
        timezone: true,
      },
    });

    console.log(`Found ${companies.length} companies to process`);

    // In development mode, always force run for testing
    const isProduction = process.env.NODE_ENV === "production";
    const shouldForceRun = forceRun || !isProduction;

    for (const company of companies) {
      await runAbsentAutomationForCompany(
        company.id,
        company.timezone,
        shouldForceRun
      );
    }

    console.log("✅ Completed absent automation for all companies");
  } catch (error) {
    console.error("Error in absent automation for all companies:", error);
  }
}

// Function to manually trigger absent automation (for testing)
async function triggerAbsentAutomationManually() {
  console.log("🚀 Manually triggering absent automation...");
  await runAbsentAutomationForAllCompanies(true);
}

// Legacy function for backward compatibility
async function runAbsentAutomation() {
  console.log("🔄 Running legacy absent automation (single timezone)...");
  await runAbsentAutomationForAllCompanies();
}

// Initialize the cron job
function initializeAbsentAutomation() {
  try {
    // Check if we're in production or development
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      // Production: Run every hour, Monday-Friday to check all companies
      absentAutomationJob = cron.schedule(
        "0 * * * 1-5",
        runAbsentAutomationForAllCompanies,
        {
          scheduled: true,
          timezone: "UTC", // Server timezone doesn't matter now
        }
      );

      console.log(
        "✅ Absent automation initialized - runs hourly, checks for 6:00 PM local time"
      );
    } else {
      // Development: Run every hour, Monday-Friday to check all companies
      absentAutomationJob = cron.schedule(
        "0 * * * 1-5",
        runAbsentAutomationForAllCompanies,
        {
          scheduled: true,
          timezone: "UTC", // Server timezone doesn't matter now
        }
      );

      console.log(
        "✅ Absent automation initialized - development mode (runs hourly, checks for 5:00 PM local time)"
      );
    }

    return absentAutomationJob;
  } catch (error) {
    console.error("❌ Failed to initialize absent automation:", error);
    throw error;
  }
}

// Function to stop the automation gracefully
function stopAbsentAutomation() {
  if (absentAutomationJob) {
    absentAutomationJob.stop();
    console.log("🛑 Absent automation stopped gracefully");
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down absent automation...");
  stopAbsentAutomation();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down absent automation...");
  stopAbsentAutomation();
  process.exit(0);
});

// Initialize the automation
const job = initializeAbsentAutomation();

// Export for potential external control
export {
  job,
  stopAbsentAutomation,
  runAbsentAutomation,
  runAbsentAutomationForCompany,
  runAbsentAutomationForAllCompanies,
  triggerAbsentAutomationManually,
};
