import express from "express";
import {
  listCompanies,
  companyStats,
} from "../controller/superadmin.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const router = express.Router();
router.get(
  "/companies",
  verifyToken,
  requireRole(["SUPER_ADMIN"]),
  listCompanies
);
router.get(
  "/company-stats",
  verifyToken,
  requireRole(["SUPER_ADMIN"]),
  companyStats
);

export default router;
