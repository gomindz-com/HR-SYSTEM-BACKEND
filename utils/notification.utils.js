import prisma from "../config/prisma.config.js";

export const NOTIFICATION_PRIORITIES = {
  URGENT: "URGENT",
  HIGH: "HIGH",
  NORMAL: "NORMAL",
  LOW: "LOW",
};

export const NOTIFICATION_CATEGORIES = {
  SYSTEM: "SYSTEM",
  LEAVE: "LEAVE",
  ATTENDANCE: "ATTENDANCE",
  PAYROLL: "PAYROLL",
  PERFORMANCE: "PERFORMANCE",
};

export const createNotification = async ({
  companyId,
  userId = null,
  message,
  type,
  category = null,
  priority = NOTIFICATION_PRIORITIES.NORMAL,
  redirectUrl = null,
}) => {
  if (!companyId || !message || !type) {
    throw new Error("Missing required fields: companyId, message, or type");
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        companyId,
        message,
        type,
        category,
        priority,
        redirectUrl,
        read: false,
      },
    });
    return notification;
  } catch (error) {
    throw new Error(`Error creating notification: ${error.message}`);
  }
};

export const createBulkNotifications = async (notifications) => {
  try {
    const result = await Promise.all(
      notifications.map((notification) => createNotification(notification))
    );
    return result;
  } catch (error) {
    throw new Error(`Error creating bulk notifications: ${error.message}`);
  }
};

