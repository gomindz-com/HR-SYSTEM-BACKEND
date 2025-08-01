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

// CORS configuration
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://172.20.10.2:8080",
  "http://172.20.10.2:5173",
  "https://e632bfbfb94b.ngrok-free.app",
  "https://hr-system-frontend-tester.vercel.app",
  "https://hr-system-frontend-tester-*.vercel.app",
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

      // Check if origin is in allowedOrigins or matches Vercel pattern
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        (origin.includes("hr-system-frontend-tester") &&
          origin.includes("vercel.app"))
      ) {
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

export default app;
