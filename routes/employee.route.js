import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  listEmployees,
  getEmployeeDetails,
} from "../controller/employee.controller.js";

const router = express.Router();

router.get("/", verifyToken, listEmployees);
router.get("/:id", verifyToken, getEmployeeDetails);

export default router;
