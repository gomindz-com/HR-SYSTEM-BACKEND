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
import reportRoutes from "./routes/report.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import payrollRoutes from "./routes/payroll.route.js";
// Load environment variables first
dotenv.config();

// Initialize the new automation system
let automationInitialized = false;
// COMMENTED OUT: Absent automation disabled temporarily
try {
  const { initialize } = await import("./automations/absentAutomation.js");
  const result = await initialize();
  automationInitialized = result.success;

  if (result.success) {
    console.log(`🎉 Absent automation system initialized successfully!`);
    console.log(`   📊 Total companies: ${result.total}`);
    console.log(`   ✅ Successful setups: ${result.successful}`);
    if (result.failed > 0) {
      console.log(`   ❌ Failed setups: ${result.failed}`);
    }
  } else {
    console.error("❌ Failed to initialize automation system:", result.error);
  }
} catch (error) {
  console.error("❌ Fatal error initializing absent automation:", error);
  automationInitialized = false;
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
const allowedOrigins = ["http://localhost:8080"];

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
app.use("/api/report", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payroll", payrollRoutes);
// ESSENTIAL ADMIN ENDPOINTS

// Get automation system status
app.get("/api/admin/automation-status", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.json({
        status: "not_initialized",
        message: "Automation system failed to initialize",
      });
    }

    const { getAutomationStatus } = await import(
      "./automations/absentAutomation.js"
    );
    const status = getAutomationStatus();

    res.json({
      status: "running",
      initialized: true,
      timestamp: new Date().toISOString(),
      ...status,
    });
  } catch (error) {
    console.error("Error getting automation status:", error);
    res.status(500).json({
      error: "Failed to get automation status",
      details: error.message,
    });
  }
});

// Dry run endpoint to test automation safely
app.post("/api/admin/dry-run-absent-automation", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.status(500).json({
        error: "Automation system not initialized",
      });
    }

    console.log(`🧪 Dry run requested at ${new Date().toISOString()}`);
    const { manuallyTriggerForAllCompanies } = await import(
      "./automations/absentAutomation.js"
    );
    const result = await manuallyTriggerForAllCompanies(true);

    if (result.success) {
      console.log("✅ Dry run completed successfully:", result.results);
      res.json({
        message: "Dry run completed - no employees were actually marked absent",
        timestamp: new Date().toISOString(),
        results: result.results,
      });
    } else {
      console.error("❌ Dry run failed:", result.error);
      res.status(500).json({
        error: "Failed to run dry run",
        details: result.error,
      });
    }
  } catch (error) {
    console.error("Error in dry run:", error);
    res.status(500).json({
      error: "Failed to execute dry run",
      details: error.message,
    });
  }
});

// Manual trigger endpoint using the dedicated function
app.post("/api/admin/trigger-absent-automation-manual", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.status(500).json({
        error: "Absent automation not initialized",
      });
    }

    const { manuallyTriggerForAllCompanies } = await import(
      "./automations/absentAutomation.js"
    );
    const result = await manuallyTriggerForAllCompanies(false);

    if (result.success) {
      res.json({
        message: "Manual trigger completed successfully",
        timestamp: new Date().toISOString(),
        results: result.results,
      });
    } else {
      console.error("❌ Manual trigger failed:", result.error);
      res.status(500).json({
        error: "Failed to execute manual trigger",
        details: result.error,
      });
    }
  } catch (error) {
    console.error("Error in manual trigger:", error);
    res.status(500).json({
      error: "Failed to execute manual trigger",
      details: error.message,
    });
  }
});

// Emergency stop endpoint
app.post("/api/admin/stop-all-automations", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.status(500).json({
        error: "No automations running",
      });
    }

    const { stopAllAutomations } = await import(
      "./automations/absentAutomation.js"
    );
    const result = stopAllAutomations();
    automationInitialized = false;

    res.json({
      message: "Emergency stop: All automation jobs stopped",
      timestamp: new Date().toISOString(),
      stoppedJobs: result.count,
    });
  } catch (error) {
    console.error("Error stopping all automations:", error);
    res.status(500).json({
      error: "Failed to stop automations",
      details: error.message,
    });
  }
});

export default app;
