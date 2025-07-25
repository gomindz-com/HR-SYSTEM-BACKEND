import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { listEmployees, myAttendance } from "../controller/employee.controller.js";

const router = express.Router();

router.get("/", verifyToken, listEmployees);
router.get("/my-attendance", verifyToken, myAttendance);

export default router;
