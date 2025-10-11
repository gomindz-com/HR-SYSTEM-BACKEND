import cron from "node-cron";
import prisma from "../config/prisma.config.js";

let trialExpirationCronJob = null;

// Function to check and expire trials
export const expireTrials = async () => {
  try {
    console.log("🔍 Checking for expired trials...");

    const now = new Date();

    // Find all subscriptions in TRIAL status with expired trialEndDate
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

    console.log(`Found ${expiredTrials.length} expired trials`);

    let successful = 0;
    let failed = 0;

    for (const subscription of expiredTrials) {
      try {
        // Skip if company has lifetime access (safety check)
        if (subscription.company.hasLifetimeAccess) {
          console.log(
            `⏭️ Skipping trial expiration for ${subscription.company.companyName} - has lifetime access`
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
          `✅ Expired trial for ${subscription.company.companyName} - status changed to PENDING`
        );
        successful++;
      } catch (error) {
        console.error(
          `❌ Failed to expire trial for company ${subscription.company.companyName}:`,
          error
        );
        failed++;
      }
    }

    return {
      success: true,
      total: expiredTrials.length,
      successful,
      failed,
      message: `Expired ${successful} trials, ${failed} failed`,
    };
  } catch (error) {
    console.error("❌ Error checking expired trials:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Start the cron job
export const startTrialExpirationCron = () => {
  try {
    // Run daily at 12:00 AM (midnight) to check for expired trials
    trialExpirationCronJob = cron.schedule(
      "0 0 * * *",
      async () => {
        console.log("🔄 Running daily trial expiration check...");

        try {
          const result = await expireTrials();

          if (result.success) {
            console.log(
              `✅ Trial expiration check completed: ${result.successful} trials expired, ${result.failed} failed`
            );
          } else {
            console.error("❌ Trial expiration check failed:", result.error);
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
      "✅ Trial expiration cron job started - will run daily at midnight (Gambia time)"
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

// Stop the cron job
export const stopTrialExpirationCron = () => {
  if (trialExpirationCronJob) {
    trialExpirationCronJob.stop();
    trialExpirationCronJob = null;
    console.log("🛑 Trial expiration cron job stopped");
    return { success: true, message: "Cron job stopped" };
  }
  return { success: false, message: "No cron job running" };
};

// Get cron status
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
export const manuallyExpireTrials = async () => {
  console.log("🧪 Manual trial expiration check triggered...");
  return await expireTrials();
};

export default startTrialExpirationCron;
