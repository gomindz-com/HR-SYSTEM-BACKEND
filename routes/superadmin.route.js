import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  getCompanies,
  getCompanyDetail,
  getCompanyStats,
  grantLifetimeAccess,
  revokeLifetimeAccess,
  getLifetimeCompanies,
  listSubscriptions,
  updateSubscription,
  getPaymentDetail,
  getPayments,
  getSubscriptionTrends,
  getSubscriptionDistribution,
  getSubscriptionStats,
  getSubscriptionRevenue,
} from "../controller/superadmin.controller.js";

const router = express.Router();

// All superadmin routes require authentication (role check is done in controllers)
router.use(verifyToken);

// Get all companies with pagination
router.get("/companies", getCompanies);

// Get company statistics
router.get("/company-stats", getCompanyStats);

// Get company detail
router.get("/company/:id", getCompanyDetail);

// Lifetime access management
router.post("/company/:id/lifetime-access/grant", grantLifetimeAccess);
router.post("/company/:id/lifetime-access/revoke", revokeLifetimeAccess);

// Get companies with lifetime access
router.get("/companies/lifetime", getLifetimeCompanies);

// Subscription management
router.get("/subscriptions", listSubscriptions);
router.patch("/subscription/:id", updateSubscription);

// Subscription analytics routes
router.get("/subscriptions/trends", getSubscriptionTrends);
router.get("/subscriptions/distribution", getSubscriptionDistribution);
router.get("/subscriptions/stats", getSubscriptionStats);
router.get("/subscriptions/revenue", getSubscriptionRevenue);

//Get payment
router.get("/payments", getPayments);
router.get("/payment/:id",getPaymentDetail)


export default router;

