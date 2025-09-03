import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  listEmployees,
  getEmployeeDetails,
  updateEmployee,
  deleteEmployee,
  listArchivedEmployees,
  reinstateEmployee,
  updateEmployeeProfile,
} from "../controller/employee.controller.js";

const router = express.Router();

router.get("/", verifyToken, listEmployees);
router.get("/archived", verifyToken, listArchivedEmployees);
router.get("/:id", verifyToken, getEmployeeDetails);
router.put("/update-employee/:id", verifyToken, updateEmployee);
router.put("/update-profile/:id", verifyToken, updateEmployeeProfile);
router.put("/delete-employee/:id", verifyToken, deleteEmployee);
router.put("/reinstate-employee/:id", verifyToken, reinstateEmployee);

export default router;
