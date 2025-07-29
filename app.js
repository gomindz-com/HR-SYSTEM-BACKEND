import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.js";
import invitationRoutes from "./routes/invitation.route.js";
import departmentRoutes from "./routes/department.route.js";
import attendanceRoutes from "./routes/attendance.route.js";
import employeeRoutes from "./routes/employee.route.js";

// Load environment variables first
dotenv.config();

// Initialize automation with proper error handling
try {
  await import("./automations/absentAutomation.js");
  console.log(
    "🚀 Absent automation cron job initialized - will run daily at 7:00 PM UTC"
  );
} catch (error) {
  console.error("❌ Failed to initialize absent automation:", error);
  // Don't exit the process, just log the error
}

const app = express();

// middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://172.20.10.2:8080",
      "http://172.20.10.2:5173",
    ],
    credentials: true,
  })
);

app.use(cookieParser());

// ROUTES

app.use("/api/auth", authRoutes);
app.use("/api/invitation", invitationRoutes);
app.use("/api/department", departmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/employee", employeeRoutes);

export default app;
