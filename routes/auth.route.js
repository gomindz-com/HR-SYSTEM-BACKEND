import express from "express";
import { signUpCompany } from "../controller/company.controller.js";
import { checkAuth, forgotPassword, login, resetPassword } from "../controller/auth.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
const router = express.Router();

router.post("/signup", signUpCompany);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/check-auth", verifyToken, checkAuth);
export default router;
