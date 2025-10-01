import express from "express";
import {
  listDepartments,
  addDepartment,
} from "../controller/department.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

// Department routes require: authentication + active subscription (all plans)
router.get("/", verifyToken, checkSubscription, listDepartments);
router.post("/", verifyToken, checkSubscription, addDepartment);

export default router;
