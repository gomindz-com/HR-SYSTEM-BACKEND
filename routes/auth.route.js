import express from "express";
import { signUpCompany } from "../controller/company.controller.js";
import { forgotPassword, login, resetPassword } from "../controller/auth.controller.js";
const router = express.Router();

router.post("/signup", signUpCompany);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

export default router;
