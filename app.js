import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.js";
import invitationRoutes from "./routes/invitation.route.js";
import departmentRoutes from "./routes/department.route.js";
import attendanceRoutes from "./routes/attendance.route.js";
import employeeRoutes from "./routes/employee.route.js";
import userRoutes from "./routes/user.route.js";
import companyRoutes from "./routes/company.route.js";
import leaveRoutes from "./routes/leave.route.js";
// Load environment variables first
dotenv.config();

// Initialize automation with proper error handling
let absentAutomationJob = null;
try {
  const { job } = await import("./automations/absentAutomation.js");
  absentAutomationJob = job;
  console.log(
    "🚀 Absent automation cron job initialized - will run every minute (for testing)"
  );
} catch (error) {
  console.error("❌ Failed to initialize absent automation:", error);
  // Don't exit the process, just log the error
}

// Initialize leave reminder cron job
let leaveReminderCron = null;
try {
  const startLeaveReminderCron = await import(
    "./automations/leaveReminderCron.js"
  );
  startLeaveReminderCron.default();
  leaveReminderCron = startLeaveReminderCron;
  console.log(
    "📧 Leave reminder cron job initialized - will run daily at 9:00 AM"
  );
} catch (error) {
  console.error("❌ Failed to initialize leave reminder cron:", error);
  // Don't exit the process, just log the error
}

const app = express();

// middleware
app.use(express.json());

// CORS configuration
const allowedOrigins = [
  "http://localhost:8080",
  "http://172.20.10.2:8080",
  "https://subtle-strudel-6843d3.netlify.app",
];

// Add CLIENT_URL if it exists
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
  console.log("✅ CORS: Added CLIENT_URL:", process.env.CLIENT_URL);
}

console.log("🌐 CORS allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("❌ CORS blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

app.use(cookieParser());

// ROUTES

app.use("/api/auth", authRoutes);
app.use("/api/invitation", invitationRoutes);
app.use("/api/department", departmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/user", userRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/leave", leaveRoutes);

// Manual trigger endpoint for testing absent automation
app.post("/api/admin/trigger-absent-automation", async (req, res) => {
  try {
    if (!absentAutomationJob) {
      return res.status(500).json({
        error: "Absent automation not initialized",
      });
    }

    // Import and run the automation manually with force run
    const { runAbsentAutomationForAllCompanies } = await import(
      "./automations/absentAutomation.js"
    );
    await runAbsentAutomationForAllCompanies(true); // Force run regardless of time

    res.json({
      message:
        "Multi-timezone absent automation triggered successfully (forced)",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error triggering absent automation:", error);
    res.status(500).json({
      error: "Failed to trigger absent automation",
      details: error.message,
    });
  }
});

// Test endpoint to run absent automation for a specific company
app.post("/api/admin/test-company-absent-automation", async (req, res) => {
  try {
    const { companyId, timezone } = req.body;

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    // Import the test function
    const { runAbsentAutomationForCompany } = await import(
      "./automations/absentAutomation.js"
    );

    await runAbsentAutomationForCompany(companyId, timezone || "UTC", true); // Force run

    res.json({
      message: "Company absent automation test completed (forced)",
      companyId,
      timezone: timezone || "UTC",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in test company absent automation:", error);
    res.status(500).json({
      error: "Failed to test company absent automation",
      details: error.message,
    });
  }
});

// Health check endpoint to verify automation status
app.get("/api/admin/automation-status", (req, res) => {
  res.json({
    absentAutomation: {
      initialized: !!absentAutomationJob,
      status: absentAutomationJob ? "running" : "not initialized",
      nextRun: absentAutomationJob
        ? "Every hour, checks for 6:00 PM local time"
        : "N/A",
    },
    leaveReminderCron: {
      initialized: !!leaveReminderCron,
      status: leaveReminderCron ? "running" : "not initialized",
      nextRun: leaveReminderCron
        ? "Daily at 9:00 AM UTC, sends reminders 3 and 1 days before leave ends"
        : "N/A",
    },
  });
});

// Manual trigger endpoint for leave reminder cron job
app.post("/api/admin/trigger-leave-reminder", async (req, res) => {
  try {
    if (!leaveReminderCron) {
      return res.status(500).json({
        error: "Leave reminder cron not initialized",
      });
    }

    // Import and run the reminder check manually
    const { checkAndSendReminders } = await import(
      "./automations/leaveReminderCron.js"
    );
    await checkAndSendReminders();

    res.json({
      message: "Leave reminder check triggered successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error triggering leave reminder:", error);
    res.status(500).json({
      error: "Failed to trigger leave reminder",
      details: error.message,
    });
  }
});

// Manual trigger endpoint using the dedicated function
app.post("/api/admin/trigger-absent-automation-manual", async (req, res) => {
  try {
    if (!absentAutomationJob) {
      return res.status(500).json({
        error: "Absent automation not initialized",
      });
    }

    // Import and run the manual trigger function
    const { triggerAbsentAutomationManually } = await import(
      "./automations/absentAutomation.js"
    );
    await triggerAbsentAutomationManually();

    res.json({
      message: "Absent automation manually triggered successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in manual absent automation trigger:", error);
    res.status(500).json({
      error: "Failed to manually trigger absent automation",
      details: error.message,
    });
  }
});

export default app;
