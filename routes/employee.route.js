import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";
import {
  listEmployees,
  getEmployeeDetails,
  updateEmployee,
  deleteEmployee,
  listArchivedEmployees,
  reinstateEmployee,
  updateEmployeeProfile,
  toggleEmployeeStatus,
} from "../controller/employee.controller.js";

const router = express.Router();

// Employee routes require: authentication + active subscription
// Note: Employee limit checking is handled in feature.middleware when creating new employees
router.get("/", verifyToken, checkSubscription, listEmployees);
router.get("/archived", verifyToken, checkSubscription, listArchivedEmployees);
router.get("/:id", verifyToken, checkSubscription, getEmployeeDetails);
router.put(
  "/update-employee/:id",
  verifyToken,
  checkSubscription,
  updateEmployee
);
router.put(
  "/update-profile/:id",
  verifyToken,
  checkSubscription,
  updateEmployeeProfile
);
router.put(
  "/toggle-status/:id",
  verifyToken,
  checkSubscription,
  toggleEmployeeStatus
);
router.put(
  "/delete-employee/:id",
  verifyToken,
  checkSubscription,
  deleteEmployee
);
router.put(
  "/reinstate-employee/:id",
  verifyToken,
  checkSubscription,
  reinstateEmployee
);

export default router;
