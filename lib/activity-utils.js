import prisma from "../config/prisma.config.js";

export const createActivity = async ({
  companyId,
  type,
  title,
  description,
  priority = "NORMAL",
  icon = "default",
}) => {
  try {
    const activity = await prisma.activity.create({
      data: {
        companyId,
        type,
        title,
        description,
        priority,
        icon,
      },
    });

    console.log(`✅ Activity created: ${type} - ${title} (${priority})`);
    return activity;
  } catch (error) {
    console.error(`❌ Error creating activity: ${type}`, error);
    return null;
  }
};

// Activity types matching your UI
export const ACTIVITY_TYPES = {
  PERFORMANCE_REVIEW: "PERFORMANCE_REVIEW",
  ATTENDANCE: "ATTENDANCE",
  LEAVE_REQUEST: "LEAVE_REQUEST",
  EMPLOYEE_ADDED: "EMPLOYEE_ADDED",
  EMPLOYEE_UPDATED: "EMPLOYEE_UPDATED",
  EMPLOYEE_DELETED: "EMPLOYEE_DELETED",
  PAYROLL: "PAYROLL",
  DEPARTMENT_CHANGE: "DEPARTMENT_CHANGE",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
};

// Priority levels matching your UI
export const PRIORITY_LEVELS = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
};

// Icon types for different activities
export const ICON_TYPES = {
  DEFAULT: "default",
  PERFORMANCE: "performance", // Line graph icon
  ATTENDANCE: "attendance", // Clock icon
  LEAVE: "leave", // Calendar icon
  EMPLOYEE: "employee", // User icon
  PAYROLL: "payroll", // Dollar icon
};

// Helper function to get recent activities for dashboard
export const getRecentActivities = async (companyId, limit = 10) => {
  try {
    const activities = await prisma.activity.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return activities;
  } catch (error) {
    console.error("❌ Error fetching recent activities:", error);
    return [];
  }
};
