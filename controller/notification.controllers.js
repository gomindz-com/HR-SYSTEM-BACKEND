import prisma from "../config/prisma.config.js";
import { createNotification } from "../utils/notification.utils.js";

// Create company-wide announcement (admin only)
export const createAnnouncement = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const role = req.user.role;
    const { message, type, category, priority } = req.body;

    if (role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    if (!message || !type) {
      return res.status(400).json({ message: "Message and type are required" });
    }

    const notification = await createNotification({
      companyId,
      userId: null,
      message,
      type,
      category,
      priority,
      redirectUrl: null, // Company-wide announcements don't have redirect URLs
    });

    return res.status(201).json({ notification });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get recent notifications (for bell icon/dropdown)
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const limit = parseInt(req.query.limit) || 10;

    if (!userId || !companyId) {
      return res
        .status(400)
        .json({ message: "User ID and Company ID are required" });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        companyId,
        OR: [{ userId }, { userId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        companyId,
        OR: [{ userId }, { userId: null }],
        read: false,
      },
    });

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get all notifications with pagination and filters (for full notifications page)
export const getAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;
    const { read, category, priority } = req.query;

    if (!userId || !companyId) {
      return res
        .status(400)
        .json({ message: "User ID and Company ID are required" });
    }

    const where = {
      companyId,
      OR: [{ userId }, { userId: null }],
    };

    if (read !== undefined) {
      where.read = read === "true";
    }
    if (category) {
      where.category = category;
    }
    if (priority) {
      where.priority = priority;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    return res.status(200).json({
      notifications,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get company-wide announcements only (optional - for bulletin board display)
export const getCompanyWideNotifications = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const limit = parseInt(req.query.limit) || 10;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        companyId,
        userId: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Mark single notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const companyId = req.user.companyId;

    if (!id) {
      return res.status(400).json({ message: "Notification ID is required" });
    }

    console.log(`Marking notification ${id} as read for user ${userId}`);

    // Parse ID safely
    const notificationId = parseInt(id);
    if (isNaN(notificationId)) {
      console.log(`Invalid notification ID: ${id}`);
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        companyId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!notification) {
      console.log(`Notification ${id} not found for user ${userId}`);
      return res.status(404).json({ message: "Notification not found" });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    console.log(`Notification ${id} marked as read successfully`);
    return res.status(200).json({ notification: updated });
  } catch (error) {
    console.error(`Error marking notification as read:`, error);
    return res.status(500).json({ message: error.message });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const updated = await prisma.notification.updateMany({
      where: {
        companyId,
        OR: [{ userId }, { userId: null }],
        read: false,
      },
      data: { read: true },
    });

    return res.status(200).json({ count: updated.count });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete single notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const companyId = req.user.companyId;

    if (!id) {
      return res.status(400).json({ message: "Notification ID is required" });
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: parseInt(id),
        companyId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await prisma.notification.delete({
      where: { id: parseInt(id) },
    });

    return res
      .status(200)
      .json({ message: "Notification deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete all notifications for user
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const deleted = await prisma.notification.deleteMany({
      where: {
        companyId,
        OR: [{ userId }, { userId: null }],
      },
    });

    return res.status(200).json({
      message: "All notifications deleted successfully",
      count: deleted.count,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
