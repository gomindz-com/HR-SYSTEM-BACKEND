import cron from "node-cron";
import prisma from "../config/prisma.config.js";

// Store the cron job reference for graceful shutdown
let absentAutomationJob = null;

// Function to run the absent automation
async function runAbsentAutomation() {
  console.log("Running absent automation at 7:00 PM");

  try {
    // Validate database connection
    await prisma.$connect();

    // Get today's date at midnight for consistent comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate the date is reasonable (not in the future)
    const now = new Date();
    if (today > now) {
      console.error("Error: Attempting to process future date");
      return;
    }

    console.log(
      `Processing attendance for date: ${today.toISOString().split("T")[0]}`
    );

    // Find all active employees who haven't checked in today
    const employeesWithoutAttendance = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        // Exclude employees who already have attendance records for today
        attendance: {
          none: {
            date: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Next day
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
      `Found ${employeesWithoutAttendance.length} employees without attendance records`
    );

    if (employeesWithoutAttendance.length === 0) {
      console.log("No employees to mark as absent");
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
          attendance: {
            none: {
              date: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
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
          date: today,
          status: "ABSENT",
        })),
        skipDuplicates: true, // Prevent duplicate records if automation runs multiple times
      });

      return absentRecords;
    });

    console.log(`Successfully marked ${result.count} employees as absent`);

    // Log details for debugging
    employeesWithoutAttendance.forEach((employee) => {
      console.log(`Marked ${employee.name} (ID: ${employee.id}) as absent`);
    });
  } catch (error) {
    console.error("Error in absent automation:", error);

    // Log specific error details for debugging
    if (error.code) {
      console.error(`Database error code: ${error.code}`);
    }
    if (error.meta) {
      console.error(`Error metadata:`, error.meta);
    }

    // Don't throw the error to prevent the cron job from stopping
  } finally {
    // Ensure database connection is properly closed
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting from database:", disconnectError);
    }
  }
}

// Initialize the cron job
function initializeAbsentAutomation() {
  try {
    // Schedule the job to run at 7:00 PM daily
    absentAutomationJob = cron.schedule("0 19 * * *", runAbsentAutomation, {
      scheduled: true,
      timezone: "UTC", // Use UTC to avoid timezone issues
    });

    console.log("✅ Absent automation cron job initialized successfully");
    console.log("📅 Schedule: Daily at 7:00 PM UTC");

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
export { job, stopAbsentAutomation, runAbsentAutomation };
