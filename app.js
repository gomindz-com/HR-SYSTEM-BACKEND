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
/*
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
*/

const app = express();

// middleware
app.use(express.json());

// CORS configuration
const allowedOrigins = [
  "http://localhost:8080",
  "http://172.20.10.2:8080",
  "https://subtle-strudel-6843d3.netlify.app",
];

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

// AUTOMATION ADMIN ENDPOINTS

// Get automation system status
app.get("/api/admin/automation-status", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.json({
        status: "not_initialized",
        message: "Automation system failed to initialize",
        automations: [],
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

// Manually trigger automation for all companies
app.post("/api/admin/trigger-absent-automation", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.status(500).json({
        error: "Automation system not initialized",
      });
    }

    const { manuallyTriggerForAllCompanies } = await import(
      "./automations/absentAutomation.js"
    );
    const result = await manuallyTriggerForAllCompanies();

    if (result.success) {
      res.json({
        message: "Absent automation triggered for all companies",
        timestamp: new Date().toISOString(),
        results: result.results,
      });
    } else {
      res.status(500).json({
        error: "Failed to trigger automation for all companies",
        details: result.error,
      });
    }
  } catch (error) {
    console.error("Error triggering automation for all companies:", error);
    res.status(500).json({
      error: "Failed to trigger automation",
      details: error.message,
    });
  }
});

// Manually trigger automation for a specific company
app.post("/api/admin/trigger-company-automation", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.status(500).json({
        error: "Automation system not initialized",
      });
    }

    const { companyId, timezone } = req.body;

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    const { manuallyTriggerForCompany } = await import(
      "./automations/absentAutomation.js"
    );
    const result = await manuallyTriggerForCompany(
      companyId,
      timezone || "UTC"
    );

    if (result.success) {
      res.json({
        message: `Absent automation completed for company ${companyId}`,
        timestamp: new Date().toISOString(),
        result,
      });
    } else {
      res.status(500).json({
        error: `Failed to run automation for company ${companyId}`,
        details: result.message,
      });
    }
  } catch (error) {
    console.error("Error triggering company automation:", error);
    res.status(500).json({
      error: "Failed to trigger company automation",
      details: error.message,
    });
  }
});

// Reinitialize the automation system (useful when companies are added/updated)
app.post("/api/admin/reinitialize-automation", async (req, res) => {
  try {
    const { reinitializeAutomation } = await import(
      "./automations/absentAutomation.js"
    );
    const result = await reinitializeAutomation();

    automationInitialized = result.success;

    if (result.success) {
      res.json({
        message: "Automation system reinitialized successfully",
        timestamp: new Date().toISOString(),
        total: result.total,
        successful: result.successful,
        failed: result.failed,
      });
    } else {
      res.status(500).json({
        error: "Failed to reinitialize automation system",
        details: result.error,
      });
    }
  } catch (error) {
    console.error("Error reinitializing automation:", error);
    res.status(500).json({
      error: "Failed to reinitialize automation",
      details: error.message,
    });
  }
});

// Stop automation for a specific company
app.post("/api/admin/stop-company-automation", async (req, res) => {
  try {
    if (!automationInitialized) {
      return res.status(500).json({
        error: "Automation system not initialized",
      });
    }

    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID is required",
      });
    }

    const { stopCompanyAutomation } = await import(
      "./automations/absentAutomation.js"
    );
    const result = stopCompanyAutomation(companyId);

    res.json({
      message: result.message,
      timestamp: new Date().toISOString(),
      success: result.success,
    });
  } catch (error) {
    console.error("Error stopping company automation:", error);
    res.status(500).json({
      error: "Failed to stop company automation",
      details: error.message,
    });
  }
});

// Stop all automations
app.post("/api/admin/stop-all-automations", async (req, res) => {
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
      message: `Stopped all automation jobs`,
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
