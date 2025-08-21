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

// Emergency stop all automations
app.post("/api/admin/emergency-stop-automations", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.json({
        message: "Automation system was not initialized, nothing to stop",
        timestamp: new Date().toISOString(),
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
