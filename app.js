import express from "express";

import dotenv from "dotenv";

dotenv.config();

const app = express();

// middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(cookieParser());

// ROUTES

export default app;
