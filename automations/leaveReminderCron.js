import cron from "node-cron";
import prisma from "../config/prisma.config.js";
import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "../emails/emailLayout.js";
import { createNotification } from "../utils/notification.utils.js";

const sendLeaveReminderEmail = async (leaveRequest, daysLeft) => {
  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const startStr = new Date(leaveRequest.startDate).toLocaleDateString();
    const endStr = new Date(leaveRequest.endDate).toLocaleDateString();
    const highlightBlock = [
      `Leave type: ${leaveRequest.leaveType}`,
      `Start date: ${startStr}`,
      `End date: ${endStr}`,
      `Duration: ${leaveRequest.days} day(s)`,
      ...(leaveRequest.comments ? [`Comments: ${leaveRequest.comments}`] : []),
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: `Leave reminder: ${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining`,
      mainHeading: "Leave reminder",
      highlightBlock,
      bodyParagraphs: [
        `Dear ${leaveRequest.employee.name},`,
        "This is a friendly reminder that your approved leave is ending soon.",
        `You have <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining</strong> in your leave period. Please ensure you're ready to return to work on ${endStr}.`,
        "If you have any questions or need to extend your leave, please contact your supervisor or HR department.",
        "Best regards, HR Team",
      ],
    });

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: leaveRequest.employee.email,
      subject: `Leave Reminder: ${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining`,
      html: htmlContent,
    };

    await transporter.sendMail(emailContent);
    console.log(
      `Reminder email sent to ${leaveRequest.employee.email} for leave ending in ${daysLeft} day(s)`
    );
  } catch (error) {
    console.error(
      `Error sending reminder email to ${leaveRequest.employee.email}:`,
      error
    );
  }
};

// Function to check and send reminders
const checkAndSendReminders = async () => {
  try {
    const today = new Date();

    // Set time to start of day for consistent comparison
    today.setHours(0, 0, 0, 0);

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999); // End of day

    const oneDayFromNow = new Date(today);
    oneDayFromNow.setDate(today.getDate() + 1);
    oneDayFromNow.setHours(23, 59, 59, 999); // End of day

    // Get approved leave requests ending in 3 days or 1 day
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        OR: [
          {
            endDate: {
              gte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // Start of day + 3 days
              lte: threeDaysFromNow, // End of day + 3 days
            },
          },
          {
            endDate: {
              gte: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Start of day + 1 day
              lte: oneDayFromNow, // End of day + 1 day
            },
          },
        ],
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    for (const leaveRequest of leaveRequests) {
      const endDate = new Date(leaveRequest.endDate);
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      // Only send reminder if it's exactly 3 or 1 days before
      if (daysLeft === 3 || daysLeft === 1) {
        await sendLeaveReminderEmail(leaveRequest, daysLeft);

        // Send in-app notification
        try {
          await createNotification({
            companyId: leaveRequest.companyId,
            userId: leaveRequest.employee.id,
            message: `Reminder: Your ${leaveRequest.leaveType} leave ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
            type: "REMINDER",
            category: "LEAVE",
            priority: daysLeft === 1 ? "HIGH" : "NORMAL",
            redirectUrl: `/leave`,
          });
        } catch (notifError) {
          console.error(
            "Error creating leave reminder notification:",
            notifError
          );
          // Continue with next reminder even if notification fails
        }
      }
    }

    console.log(
      `Leave reminder check completed at ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error("Error in leave reminder cron job:", error);
  }
};

// Schedule the cron job to run daily at 9:00 AM
const startLeaveReminderCron = () => {
  console.log("Starting leave reminder cron job...");

  // Run every day at 9:00 AM
  cron.schedule(
    "0 9 * * *",
    async () => {
      console.log("Running leave reminder check...");
      await checkAndSendReminders();
    },
    {
      scheduled: true,
      timezone: "UTC", // You can change this to your timezone
    }
  );

  console.log("Leave reminder cron job scheduled successfully");
};

export { checkAndSendReminders };
export default startLeaveReminderCron;
