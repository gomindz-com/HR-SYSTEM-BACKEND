import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  getCompanies,
  getCompanyStats,
} from "../controller/superadmin.controller.js";

const router = express.Router();

// All superadmin routes require authentication (role check is done in controllers)
router.use(verifyToken);

// Get all companies with pagination
router.get("/companies", getCompanies);

// Get company statistics
router.get("/company-stats", getCompanyStats);

export default router;
