import express from "express";
import {
  requestLeave,
  getLeaveRequests,
  getMyLeaveRequests,
  approveLeave,
  rejectLeave,
  getLeaveStats,
  getEmployeeLeaveBalance,
} from "../controller/leave.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { upload } from "../config/multer.cloudinary.config.js";

const router = express.Router();

router.use(verifyToken);

router.post("/request-leave", upload.array("attachmentUrls"), requestLeave);
router.get("/get-leave-requests", getLeaveRequests);
router.get("/mine", getMyLeaveRequests);
router.get("/stats", getLeaveStats);
router.get("/balance", getEmployeeLeaveBalance);
router.post("/approve/:id", approveLeave);
router.post("/reject/:id", rejectLeave);

export default router;
