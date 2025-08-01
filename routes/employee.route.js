import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { listEmployees } from "../controller/employee.controller.js";

const router = express.Router();

router.get("/", verifyToken, listEmployees);

export default router;
