import cron from "node-cron";
import prisma from "../config/prisma.config.js";
import { createNotification } from "../utils/notification.utils.js";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
} from "../utils/notification.utils.js";
import {
  sendSelfReviewReminderEmail,
  sendManagerReviewReminderEmail,
} from "../emails/performanceEmails.js";

// Function to send self-review reminder (notification + email)
const sendSelfReviewReminder = async (review, cycle, daysLeft, companyId) => {
  let notificationSent = false;
  let emailSent = false;

  // Send in-app notification
  try {
    await createNotification({
      companyId,
      userId: review.subject.id,
      message: `Reminder: Your self-review for "${cycle.name}" is due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`,
      type: "REVIEW",
      category: NOTIFICATION_CATEGORIES.PERFORMANCE,
      priority:
        daysLeft <= 1
          ? NOTIFICATION_PRIORITIES.HIGH
          : NOTIFICATION_PRIORITIES.NORMAL,
      redirectUrl: `/my-portal/reviews/${review.id}`,
    });
    notificationSent = true;
  } catch (error) {
    console.error(
      `Failed to send self-review notification to ${review.subject.email}:`,
      error
    );
  }

  // Send email
  try {
    const emailResult = await sendSelfReviewReminderEmail(
      review.subject,
      cycle,
      daysLeft
    );
    emailSent = emailResult.success;
  } catch (error) {
    console.error(
      `Failed to send self-review email to ${review.subject.email}:`,
      error
    );
  }

  if (notificationSent || emailSent) {
    console.log(
      `Self-review reminder sent to ${review.subject.email} (${daysLeft} days left) - Notification: ${notificationSent}, Email: ${emailSent}`
    );
  }

  return notificationSent || emailSent;
};

// Function to send manager review reminder (notification + email)
const sendManagerReviewReminder = async (
  review,
  cycle,
  daysLeft,
  companyId
) => {
  let notificationSent = false;
  let emailSent = false;

  // Send in-app notification
  try {
    await createNotification({
      companyId,
      userId: review.manager.id,
      message: `Reminder: Your review of ${review.subject.name} for "${cycle.name}" is due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`,
      type: "REVIEW",
      category: NOTIFICATION_CATEGORIES.PERFORMANCE,
      priority:
        daysLeft <= 1
          ? NOTIFICATION_PRIORITIES.HIGH
          : NOTIFICATION_PRIORITIES.NORMAL,
      redirectUrl: `/performance/reviews/${review.id}`,
    });
    notificationSent = true;
  } catch (error) {
    console.error(
      `Failed to send manager review notification to ${review.manager.email}:`,
      error
    );
  }

  // Send email
  try {
    const emailResult = await sendManagerReviewReminderEmail(
      review.manager,
      review.subject,
      cycle,
      daysLeft
    );
    emailSent = emailResult.success;
  } catch (error) {
    console.error(
      `Failed to send manager review email to ${review.manager.email}:`,
      error
    );
  }

  if (notificationSent || emailSent) {
    console.log(
      `Manager review reminder sent to ${review.manager.email} for ${review.subject.name} (${daysLeft} days left) - Notification: ${notificationSent}, Email: ${emailSent}`
    );
  }

  return notificationSent || emailSent;
};

// Main function to check and send performance review reminders
const checkAndSendPerformanceReminders = async () => {
  console.log(
    `[${new Date().toISOString()}] Starting performance review reminder check...`
  );

  try {
    // Get all companies
    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
    });

    let totalRemindersSent = 0;

    for (const company of companies) {
      // Get performance settings for this company
      const settings = await prisma.performanceSettings.findUnique({
        where: { companyId: company.id },
      });

      // Skip if email notifications are disabled
      if (!settings?.enableEmailNotifications) {
        console.log(`[${company.name}] Skipped - Notifications disabled`);
        continue;
      }

      const reminderDays = settings?.reminderDaysBefore || 7;
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Calculate the reminder window date
      const reminderWindowEnd = new Date(now);
      reminderWindowEnd.setDate(now.getDate() + reminderDays);
      reminderWindowEnd.setHours(23, 59, 59, 999);

      // Find active cycles with upcoming due dates
      const activeCycles = await prisma.reviewCycle.findMany({
        where: {
          companyId: company.id,
          status: "ACTIVE",
          OR: [
            {
              selfReviewDueDate: {
                gte: now,
                lte: reminderWindowEnd,
              },
            },
            {
              managerReviewDueDate: {
                gte: now,
                lte: reminderWindowEnd,
              },
            },
          ],
        },
        include: {
          reviews: {
            where: {
              status: {
                in: ["NOT_STARTED", "IN_PROGRESS", "PENDING_MANAGER"],
              },
            },
            include: {
              subject: { select: { id: true, name: true, email: true } },
              manager: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      let companyRemindersSent = 0;

      for (const cycle of activeCycles) {
        for (const review of cycle.reviews) {
          // Check self-review reminders
          if (
            cycle.selfReviewDueDate &&
            (review.status === "NOT_STARTED" || review.status === "IN_PROGRESS")
          ) {
            const daysUntilSelfDue = Math.ceil(
              (new Date(cycle.selfReviewDueDate) - now) / (1000 * 60 * 60 * 24)
            );

            // Send reminder if within the reminder window
            if (daysUntilSelfDue >= 0 && daysUntilSelfDue <= reminderDays) {
              const sent = await sendSelfReviewReminder(
                review,
                cycle,
                daysUntilSelfDue,
                company.id
              );
              if (sent) companyRemindersSent++;
            }
          }

          // Check manager review reminders
          if (
            cycle.managerReviewDueDate &&
            review.status === "PENDING_MANAGER" &&
            review.manager
          ) {
            const daysUntilManagerDue = Math.ceil(
              (new Date(cycle.managerReviewDueDate) - now) /
                (1000 * 60 * 60 * 24)
            );

            // Send reminder if within the reminder window
            if (
              daysUntilManagerDue >= 0 &&
              daysUntilManagerDue <= reminderDays
            ) {
              const sent = await sendManagerReviewReminder(
                review,
                cycle,
                daysUntilManagerDue,
                company.id
              );
              if (sent) companyRemindersSent++;
            }
          }
        }
      }

      if (companyRemindersSent > 0) {
        console.log(
          `[${company.name}] Sent ${companyRemindersSent} reminder(s) for ${activeCycles.length} active cycle(s)`
        );
      }

      totalRemindersSent += companyRemindersSent;
    }

    console.log(
      `[${new Date().toISOString()}] Performance reminder check completed. Total reminders sent: ${totalRemindersSent}`
    );

    return totalRemindersSent;
  } catch (error) {
    console.error("Error in performance reminder cron job:", error);
    throw error;
  }
};

// Schedule the cron job to run daily at 9:00 AM
const startPerformanceReminderCron = () => {
  console.log("Starting performance review reminder cron job...");

  // Run every day at 9:00 AM
  cron.schedule(
    "0 9 * * *",
    async () => {
      console.log("Running performance review reminder check...");
      await checkAndSendPerformanceReminders();
    },
    {
      scheduled: true,
      timezone: "UTC", // You can change this to your timezone
    }
  );

  console.log("Performance review reminder cron job scheduled successfully");
};

export { checkAndSendPerformanceReminders };
export default startPerformanceReminderCron;
