import express from "express";
import { updateUserProfile } from "../controller/user.controller..js";
import { upload } from "../config/multer.cloudinary.config.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.put(
  "/update-profile",
  verifyToken,
  upload.single("profilePic"),
  updateUserProfile
);

export default router;
