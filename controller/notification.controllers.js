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

    // Fetch notifications (both user-specific and company-wide)
    const notifications = await prisma.notification.findMany({
      where: {
        companyId,
        OR: [{ userId }, { userId: null }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        userReads: {
          where: { userId },
        },
      },
    });

    // Map notifications with correct read status and filter out hidden ones
    const notificationsWithReadStatus = notifications
      .map((notification) => {
        // If notification is user-specific, use the notification's read field
        // If notification is company-wide, check if user has read it
        const isRead =
          notification.userId !== null
            ? notification.read
            : notification.userReads.length > 0;

        // Check if user has hidden this notification
        const isHidden =
          notification.userId === null && notification.userReads.length > 0
            ? notification.userReads[0].hidden
            : false;

        return {
          ...notification,
          read: isRead,
          hidden: isHidden,
          userReads: undefined, // Remove from response
        };
      })
      .filter((notification) => !notification.hidden); // Exclude hidden notifications

    // Count unread notifications
    const userSpecificNotifications = await prisma.notification.count({
      where: {
        companyId,
        userId,
        read: false,
      },
    });

    // Count company-wide notifications not read by this user (and not hidden)
    const companyWideNotifications = await prisma.notification.findMany({
      where: {
        companyId,
        userId: null,
      },
      include: {
        userReads: {
          where: { userId },
        },
      },
    });

    const unreadCompanyWide = companyWideNotifications.filter(
      (n) => n.userReads.length === 0 // No record = unread and not hidden
    ).length;

    const unreadCount = userSpecificNotifications + unreadCompanyWide;

    return res
      .status(200)
      .json({ notifications: notificationsWithReadStatus, unreadCount });
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

    if (category) {
      where.category = category;
    }
    if (priority) {
      where.priority = priority;
    }

    // Fetch all notifications matching basic filters
    const allNotifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        userReads: {
          where: { userId },
        },
      },
    });

    // Map notifications with correct read status and filter out hidden ones
    let notificationsWithReadStatus = allNotifications
      .map((notification) => {
        const isRead =
          notification.userId !== null
            ? notification.read
            : notification.userReads.length > 0;

        // Check if user has hidden this notification
        const isHidden =
          notification.userId === null && notification.userReads.length > 0
            ? notification.userReads[0].hidden
            : false;

        return {
          ...notification,
          read: isRead,
          hidden: isHidden,
          userReads: undefined,
        };
      })
      .filter((notification) => !notification.hidden); // Exclude hidden notifications

    // Apply read filter if specified
    if (read !== undefined) {
      const readFilter = read === "true";
      notificationsWithReadStatus = notificationsWithReadStatus.filter(
        (n) => n.read === readFilter
      );
    }

    // Calculate pagination
    const total = notificationsWithReadStatus.length;
    const paginatedNotifications = notificationsWithReadStatus.slice(
      skip,
      skip + pageSize
    );

    return res.status(200).json({
      notifications: paginatedNotifications,
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

    // If notification is user-specific, update the notification's read field
    if (notification.userId !== null) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });
    } else {
      // If notification is company-wide, create/update UserNotificationRead entry
      await prisma.userNotificationRead.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          userId,
          notificationId,
          readAt: new Date(),
        },
      });
    }

    console.log(`Notification ${id} marked as read successfully`);
    return res.status(200).json({ success: true });
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

    // Mark all user-specific notifications as read
    await prisma.notification.updateMany({
      where: {
        companyId,
        userId,
        read: false,
      },
      data: { read: true },
    });

    // Get all company-wide notifications for this company
    const companyWideNotifications = await prisma.notification.findMany({
      where: {
        companyId,
        userId: null,
      },
      select: { id: true },
    });

    // Create UserNotificationRead entries for all company-wide notifications
    // that the user hasn't read yet
    const createPromises = companyWideNotifications.map((notification) =>
      prisma.userNotificationRead.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId: notification.id,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          userId,
          notificationId: notification.id,
          readAt: new Date(),
        },
      })
    );

    await Promise.all(createPromises);

    return res.status(200).json({ success: true });
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

    const notificationId = parseInt(id);
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        companyId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // If it's a company-wide notification, mark as hidden for this user only
    if (notification.userId === null) {
      await prisma.userNotificationRead.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId,
          },
        },
        update: {
          hidden: true,
        },
        create: {
          userId,
          notificationId,
          hidden: true,
          readAt: new Date(),
        },
      });

      return res
        .status(200)
        .json({ message: "Notification hidden successfully" });
    }

    // If it's a user-specific notification, only allow deletion if it belongs to the user
    if (notification.userId === userId) {
      await prisma.notification.delete({
        where: { id: notificationId },
      });

      return res
        .status(200)
        .json({ message: "Notification deleted successfully" });
    }

    // User trying to delete someone else's notification
    return res.status(403).json({ message: "Access denied" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete all notifications for user
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    // Delete user-specific notifications (hard delete)
    const deletedUserSpecific = await prisma.notification.deleteMany({
      where: {
        companyId,
        userId,
      },
    });

    // Hide all company-wide notifications for this user
    const companyWideNotifications = await prisma.notification.findMany({
      where: {
        companyId,
        userId: null,
      },
      select: { id: true },
    });

    // Mark all company-wide notifications as hidden for this user
    const hidePromises = companyWideNotifications.map((notification) =>
      prisma.userNotificationRead.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId: notification.id,
          },
        },
        update: {
          hidden: true,
        },
        create: {
          userId,
          notificationId: notification.id,
          hidden: true,
          readAt: new Date(),
        },
      })
    );

    await Promise.all(hidePromises);

    return res.status(200).json({
      message: "All notifications cleared successfully",
      deletedCount: deletedUserSpecific.count,
      hiddenCount: companyWideNotifications.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
