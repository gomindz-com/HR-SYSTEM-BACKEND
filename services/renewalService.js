import prisma from "../config/prisma.config.js";
import { createPaymentIntent } from "./paymentService.js";

export const checkExpiringSubscriptions = async () => {
  try {
    console.log("🔍 Checking for expiring subscriptions...");

    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Find subscriptions expiring in the next 5 days (exclude cancelled)
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: now,
          lte: fiveDaysFromNow,
        },
      },
      include: {
        plan: true,
        company: true,
        payments: {
          where: {
            status: "COMPLETED",
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    console.log(
      `Found ${expiringSubscriptions.length} subscriptions expiring soon`
    );

    const results = [];

    for (const subscription of expiringSubscriptions) {
      try {
        // Check if there's already a recent payment (avoid duplicate renewals)
        const hasRecentPayment = subscription.payments.length > 0;

        if (hasRecentPayment) {
          console.log(
            `Subscription ${subscription.id} already has recent payment, skipping renewal creation`
          );

          // Still send reminder email even if payment exists
          results.push({
            subscriptionId: subscription.id,
            companyName: subscription.company.companyName,
            planName: subscription.plan.name,
            status: "reminder_sent",
            message: "Reminder sent (payment already exists)",
          });
          continue;
        }

        // Create renewal payment intent
        const { paymentLink, intentId } = await createPaymentIntent(
          subscription.id,
          subscription.plan.price
        );

        // Log renewal creation
        console.log(
          `✅ Renewal payment created for ${subscription.company.companyName} (${subscription.plan.name})`
        );

        results.push({
          subscriptionId: subscription.id,
          companyName: subscription.company.companyName,
          planName: subscription.plan.name,
          amount: subscription.plan.price,
          paymentLink,
          intentId,
          status: "success",
        });

        // TODO: Send renewal email notification
        // await sendRenewalEmail(subscription.company, paymentLink, subscription.plan);
      } catch (error) {
        console.error(
          `❌ Failed to create renewal for subscription ${subscription.id}:`,
          error
        );
        results.push({
          subscriptionId: subscription.id,
          companyName: subscription.company.companyName,
          status: "failed",
          error: error.message,
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  } catch (error) {
    console.error("❌ Error checking expiring subscriptions:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const expireSubscriptions = async () => {
  try {
    console.log("⏰ Checking for expired subscriptions...");

    const now = new Date();

    // Find subscriptions that have expired (immediate deactivation)
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          lt: now,
        },
      },
      include: { company: true },
    });

    if (expiredSubscriptions.length === 0) {
      console.log("No expired subscriptions found");
      return { success: true, expired: 0 };
    }

    // Mark subscriptions as expired immediately
    await prisma.subscription.updateMany({
      where: {
        id: { in: expiredSubscriptions.map((s) => s.id) },
      },
      data: { status: "EXPIRED" },
    });

    console.log(
      `✅ Marked ${expiredSubscriptions.length} subscriptions as expired (immediate deactivation)`
    );

    // TODO: Send expiration notifications
    // for (const subscription of expiredSubscriptions) {
    //   await sendExpirationEmail(subscription.company);
    // }

    return {
      success: true,
      expired: expiredSubscriptions.length,
      companies: expiredSubscriptions.map((s) => s.company.companyName),
    };
  } catch (error) {
    console.error("❌ Error expiring subscriptions:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export const sendReminderEmails = async () => {
  try {
    console.log("📧 Sending reminder emails...");

    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Find subscriptions expiring in 3 days for reminders
    const reminderSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        plan: true,
        company: true,
        payments: {
          where: {
            status: "COMPLETED",
            createdAt: {
              gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Last 3 days
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    console.log(
      `Found ${reminderSubscriptions.length} subscriptions for reminders`
    );

    const results = [];

    for (const subscription of reminderSubscriptions) {
      try {
        // Skip if already paid recently
        if (subscription.payments.length > 0) {
          console.log(
            `Subscription ${subscription.id} already paid recently, skipping reminder`
          );
          continue;
        }

        // TODO: Send actual reminder email
        console.log(
          `📧 Sending reminder to ${subscription.company.companyName} for ${subscription.plan.name} plan`
        );

        results.push({
          subscriptionId: subscription.id,
          companyName: subscription.company.companyName,
          planName: subscription.plan.name,
          endDate: subscription.endDate,
          status: "reminder_sent",
        });
      } catch (error) {
        console.error(
          `❌ Failed to send reminder for subscription ${subscription.id}:`,
          error
        );
        results.push({
          subscriptionId: subscription.id,
          companyName: subscription.company.companyName,
          status: "failed",
          error: error.message,
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      successful: results.filter((r) => r.status === "reminder_sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  } catch (error) {
    console.error("❌ Error sending reminder emails:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
