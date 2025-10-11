import cron from "node-cron";
import prisma from "../config/prisma.config.js";

let trialExpirationCronJob = null;

/**
 * Check for expired trials and convert them to PENDING status
 */
const checkExpiredTrials = async () => {
  try {
    console.log("🔍 Checking for expired trials...");

    const now = new Date();

    // Find all subscriptions in TRIAL status where trial has expired
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: "TRIAL",
        trialEndDate: {
          lte: now, // Trial end date is less than or equal to now
        },
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            hasLifetimeAccess: true,
          },
        },
        plan: true,
      },
    });

    console.log(`Found ${expiredTrials.length} expired trial(s)`);

    let successCount = 0;
    let failedCount = 0;

    // Convert each expired trial to PENDING status
    for (const subscription of expiredTrials) {
      try {
        // Skip if company has lifetime access
        if (subscription.company.hasLifetimeAccess) {
          console.log(
            `⏭️ Skipping ${subscription.company.companyName} - has lifetime access`
          );
          continue;
        }

        // Update subscription status to PENDING
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "PENDING",
          },
        });

        console.log(
          `✅ Trial expired for ${subscription.company.companyName} - Status changed to PENDING`
        );
        successCount++;

        // TODO: Send trial expired email notification
        // await sendTrialExpiredEmail(subscription.company, subscription);
      } catch (error) {
        console.error(
          `❌ Failed to expire trial for company ${subscription.company.companyName}:`,
          error
        );
        failedCount++;
      }
    }

    return {
      success: true,
      total: expiredTrials.length,
      expired: successCount,
      failed: failedCount,
    };
  } catch (error) {
    console.error("❌ Error checking expired trials:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send trial expiring soon reminders (2 days before expiry)
 */
const sendTrialExpiringReminders = async () => {
  try {
    console.log("📧 Checking for expiring trials...");

    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Find trials expiring in 2 days
    const expiringTrials = await prisma.subscription.findMany({
      where: {
        status: "TRIAL",
        trialEndDate: {
          gte: now,
          lte: twoDaysFromNow,
        },
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            companyEmail: true,
            hasLifetimeAccess: true,
            hr: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        plan: true,
      },
    });

    console.log(`Found ${expiringTrials.length} trial(s) expiring in 2 days`);

    let successCount = 0;
    let failedCount = 0;

    for (const subscription of expiringTrials) {
      try {
        // Skip if company has lifetime access
        if (subscription.company.hasLifetimeAccess) {
          continue;
        }

        const daysLeft = Math.ceil(
          (subscription.trialEndDate - now) / (1000 * 60 * 60 * 24)
        );

        console.log(
          `📧 Trial expiring soon for ${subscription.company.companyName} - ${daysLeft} day(s) left`
        );
        
        // TODO: Send trial expiring soon email
        // await sendTrialExpiringEmail(subscription.company, subscription, daysLeft);
        
        successCount++;
      } catch (error) {
        console.error(
          `❌ Failed to send reminder to ${subscription.company.companyName}:`,
          error
        );
        failedCount++;
      }
    }

    return {
      success: true,
      total: expiringTrials.length,
      sent: successCount,
      failed: failedCount,
    };
  } catch (error) {
    console.error("❌ Error sending trial expiring reminders:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const startTrialExpirationCron = () => {
  try {
    // Run daily at 8:00 AM to check for expired trials
    trialExpirationCronJob = cron.schedule(
      "0 8 * * *",
      async () => {
        console.log("🔄 Running daily trial expiration check...");

        try {
          // Send reminders for trials expiring in 2 days
          const reminderResult = await sendTrialExpiringReminders();

          if (reminderResult.success) {
            console.log(
              `✅ Trial expiring reminders: ${reminderResult.sent} sent, ${reminderResult.failed} failed`
            );
          } else {
            console.error(
              "❌ Trial reminder sending failed:",
              reminderResult.error
            );
          }

          // Check and expire trials
          const expirationResult = await checkExpiredTrials();

          if (expirationResult.success) {
            console.log(
              `✅ Trial expiration completed: ${expirationResult.expired} trials expired, ${expirationResult.failed} failed`
            );
          } else {
            console.error(
              "❌ Trial expiration failed:",
              expirationResult.error
            );
          }
        } catch (error) {
          console.error("❌ Error in trial expiration cron:", error);
        }
      },
      {
        scheduled: false, // Don't start immediately
        timezone: "Africa/Banjul", // Gambia timezone
      }
    );

    // Start the cron job
    trialExpirationCronJob.start();

    console.log(
      "✅ Trial expiration cron job started - will run daily at 8:00 AM (Gambia time)"
    );

    return {
      success: true,
      message: "Trial expiration cron job started successfully",
    };
  } catch (error) {
    console.error("❌ Failed to start trial expiration cron:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const stopTrialExpirationCron = () => {
  if (trialExpirationCronJob) {
    trialExpirationCronJob.stop();
    trialExpirationCronJob = null;
    console.log("🛑 Trial expiration cron job stopped");
    return { success: true, message: "Cron job stopped" };
  }
  return { success: false, message: "No cron job running" };
};

export const getTrialCronStatus = () => {
  return {
    running: trialExpirationCronJob ? trialExpirationCronJob.running : false,
    scheduled: trialExpirationCronJob
      ? trialExpirationCronJob.scheduled
      : false,
    nextExecution: trialExpirationCronJob
      ? trialExpirationCronJob.nextDate()
      : null,
  };
};

// Manual trigger for testing
export const manuallyTriggerTrialCheck = async () => {
  console.log("🧪 Manual trial expiration check triggered...");

  try {
    const expirationResult = await checkExpiredTrials();
    const reminderResult = await sendTrialExpiringReminders();

    return {
      success: true,
      expiration: expirationResult,
      reminders: reminderResult,
    };
  } catch (error) {
    console.error("❌ Manual trial check failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default startTrialExpirationCron;

