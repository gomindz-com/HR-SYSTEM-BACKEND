import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import {
  superadminLogin,
  superadminCheckAuth,
  superadminLogout,
} from "../controller/superadmin-auth.controller.js";

const router = express.Router();

// Superadmin login (no auth required)
router.post("/login", superadminLogin);

// Superadmin check auth (requires token)
router.get("/check-auth", verifyToken, superadminCheckAuth);

// Superadmin logout (requires token)
router.post("/logout", verifyToken, superadminLogout);

export default router;
