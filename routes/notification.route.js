import express from "express";
import {
  createAnnouncement,
  getMyNotifications,
  getAllNotifications,
  getCompanyWideNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../controller/notification.controllers.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// All notification routes require authentication
router.use(verifyToken);

// Admin only - create company-wide announcement
router.post("/announcement", createAnnouncement);

// Get notifications
router.get("/my-notifications", getMyNotifications);
router.get("/all", getAllNotifications);
router.get("/company-wide", getCompanyWideNotifications);

// Mark as read
router.patch("/:id/read", markAsRead);
router.patch("/mark-all-read", markAllAsRead);

// Delete notifications
router.delete("/:id", deleteNotification);
router.delete("/", deleteAllNotifications);

export default router;
