import cron from "node-cron";
import prisma from "../config/prisma.config.js";
import { transporter } from "../config/transporter.js";

// Function to send reminder email
const sendLeaveReminderEmail = async (leaveRequest, daysLeft) => {
  try {
    const emailContent = {
      from: process.env.GMAIL_USER,
      to: leaveRequest.employee.email,
      subject: `Leave Reminder: ${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Leave Reminder</h2>
          <p>Dear ${leaveRequest.employee.name},</p>
          <p>This is a friendly reminder that your approved leave is ending soon.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #495057;">Leave Details:</h3>
            <p><strong>Leave Type:</strong> ${leaveRequest.leaveType}</p>
            <p><strong>Start Date:</strong> ${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
            <p><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
            ${leaveRequest.comments ? `<p><strong>Comments:</strong> ${leaveRequest.comments}</p>` : ""}
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">Reminder:</h3>
            <p><strong>You have ${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining in your leave period.</strong></p>
            <p>Please ensure you're ready to return to work on ${new Date(leaveRequest.endDate).toLocaleDateString()}.</p>
          </div>
          
          <p>If you have any questions or need to extend your leave, please contact your supervisor or HR department immediately.</p>
          
          <p>Best regards,<br>HR Team</p>
        </div>
      `,
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
