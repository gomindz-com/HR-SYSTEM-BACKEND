import express from "express";
import {
  requestLeave,
  getLeaveRequests,
  getMyLeaveRequests,
  approveLeave,
  rejectLeave,
  getLeaveStats,
  getEmployeeLeaveBalance,
  hrApproveLeave,
  hrRejectLeave,
} from "../controller/leave.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";
import { upload } from "../config/multer.cloudinary.config.js";

const router = express.Router();

// Leave management requires: authentication + active subscription (all plans have 'leave' feature)
router.use(verifyToken);
router.use(checkSubscription);

router.post("/request-leave", upload.array("attachmentUrls"), requestLeave);
router.get("/get-leave-requests", getLeaveRequests);
router.get("/mine", getMyLeaveRequests);
router.get("/stats", getLeaveStats);
router.get("/balance", getEmployeeLeaveBalance);
router.post("/approve/:id", approveLeave);
router.post("/reject/:id", rejectLeave);
router.post("/hr-approve/:id", hrApproveLeave);
router.post("/hr-reject/:id", hrRejectLeave);

export default router;
