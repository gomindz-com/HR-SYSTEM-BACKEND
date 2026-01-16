import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  getCompanies,
  getCompanyDetail,
  getCompanyStats,
  getPaymentDetail,
  getPayments,
} from "../controller/superadmin.controller.js";

const router = express.Router();

// All superadmin routes require authentication (role check is done in controllers)
router.use(verifyToken);

// Get all companies with pagination
router.get("/companies", getCompanies);

// Get company statistics
router.get("/company-stats", getCompanyStats);

router.get("/company/:id", getCompanyDetail);




router.get("/payments", getPayments);
router.get("/payment/:id",getPaymentDetail)


export default router;

