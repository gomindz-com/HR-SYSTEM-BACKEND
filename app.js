import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.js";
import invitationRoutes from "./routes/invitation.route.js";
dotenv.config();

const app = express();

// middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
  })
);

app.use(cookieParser());

// ROUTES

app.use("/api/auth", authRoutes);
app.use("/api/invitation", invitationRoutes);


export default app;
