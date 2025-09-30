import cron from "node-cron";
import {
  checkExpiringSubscriptions,
  expireSubscriptions,
  sendReminderEmails,
} from "../services/renewalService.js";

let renewalCronJob = null;

export const startSubscriptionRenewalCron = () => {
  try {
    // Run daily at 9:00 AM to check for expiring subscriptions
    renewalCronJob = cron.schedule(
      "0 9 * * *",
      async () => {
        console.log("🔄 Running daily subscription renewal check...");

        try {
          // Send reminder emails first (3 days before expiry)
          const reminderResult = await sendReminderEmails();

          if (reminderResult.success) {
            console.log(
              `✅ Reminder emails sent: ${reminderResult.successful} successful, ${reminderResult.failed} failed`
            );
          } else {
            console.error("❌ Reminder emails failed:", reminderResult.error);
          }

          // Check for expiring subscriptions and send renewal reminders (5 days before expiry)
          const renewalResult = await checkExpiringSubscriptions();

          if (renewalResult.success) {
            console.log(
              `✅ Renewal reminders sent: ${renewalResult.successful} successful, ${renewalResult.failed} failed`
            );
          } else {
            console.error("❌ Renewal reminders failed:", renewalResult.error);
          }

          // Check for expired subscriptions (immediate deactivation)
          const expirationResult = await expireSubscriptions();

          if (expirationResult.success) {
            console.log(
              `✅ Expiration check completed: ${expirationResult.expired} subscriptions expired (immediate deactivation)`
            );
          } else {
            console.error(
              "❌ Expiration check failed:",
              expirationResult.error
            );
          }
        } catch (error) {
          console.error("❌ Error in subscription renewal cron:", error);
        }
      },
      {
        scheduled: false, // Don't start immediately
        timezone: "Africa/Banjul", // Gambia timezone
      }
    );

    // Start the cron job
    renewalCronJob.start();

    console.log(
      "✅ Subscription renewal cron job started - will run daily at 9:00 AM (Gambia time)"
    );

    return {
      success: true,
      message: "Subscription renewal cron job started successfully",
    };
  } catch (error) {
    console.error("❌ Failed to start subscription renewal cron:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const stopSubscriptionRenewalCron = () => {
  if (renewalCronJob) {
    renewalCronJob.stop();
    renewalCronJob = null;
    console.log("🛑 Subscription renewal cron job stopped");
    return { success: true, message: "Cron job stopped" };
  }
  return { success: false, message: "No cron job running" };
};

export const getRenewalCronStatus = () => {
  return {
    running: renewalCronJob ? renewalCronJob.running : false,
    scheduled: renewalCronJob ? renewalCronJob.scheduled : false,
    nextExecution: renewalCronJob ? renewalCronJob.nextDate() : null,
  };
};

// Manual trigger for testing
export const manuallyTriggerRenewalCheck = async () => {
  console.log("🧪 Manual renewal check triggered...");

  try {
    const renewalResult = await checkExpiringSubscriptions();
    const expirationResult = await expireSubscriptions();

    return {
      success: true,
      renewal: renewalResult,
      expiration: expirationResult,
    };
  } catch (error) {
    console.error("❌ Manual renewal check failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default startSubscriptionRenewalCron;
