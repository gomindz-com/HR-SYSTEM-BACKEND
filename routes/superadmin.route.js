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
  requireRole(["SUPER_ADMIN"]),
  verifyToken,
  listCompanies
);
router.get(
  "/company-stats",
  requireRole(["SUPER_ADMIN"]),
  verifyToken,
  companyStats
);

export default router;
