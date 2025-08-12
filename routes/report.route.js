import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { employeeReport } from "../controller/report.controller.js";
const router = express.Router();
router.use(verifyToken);

router.get("/employee-report", employeeReport);


export default router;