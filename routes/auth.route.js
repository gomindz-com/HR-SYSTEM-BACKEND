import express from "express";
import { signUpCompany } from "../controller/company.controller.js";
import {
  checkAuth,
  forgotPassword,
  login,
  logout,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from "../controller/auth.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
const router = express.Router();

router.post("/company-signup", signUpCompany);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);
router.get("/check-auth", verifyToken, checkAuth);
router.post("/logout", logout);
export default router;
