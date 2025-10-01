import express from "express";
import { updateUserProfile } from "../controller/user.controller..js";
import { upload } from "../config/multer.cloudinary.config.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

// User profile routes require: authentication + active subscription (all plans)
router.put(
  "/update-profile",
  verifyToken,
  checkSubscription,
  upload.single("profilePic"),
  updateUserProfile
);

export default router;
