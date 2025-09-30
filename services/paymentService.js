import modempay from "../config/modem.config.js";
import prisma from "../config/prisma.config.js";
import { CURRENCY_CONFIG } from "../config/plans.config.js";

export const createPaymentIntent = async (
  subscriptionId,
  amount,
  currency = CURRENCY_CONFIG.code
) => {
  try {
    console.log(
      `Creating payment intent for subscription ${subscriptionId}, amount: ${amount} ${currency}`
    );

    const intent = await modempay.paymentIntents.create({
      amount: Math.round(amount), // GMD is already in base units, no conversion needed
      currency: currency,
      metadata: {
        subscriptionId,
        type: "subscription",
      },
    });

    console.log(
      "Payment intent created successfully:",
      intent.data.payment_intent_id
    );

    return {
      paymentLink: intent.data.payment_link,
      intentId: intent.data.payment_intent_id,
    };
  } catch (error) {
    console.error("Payment intent creation failed:", error);
    throw new Error(`Payment intent creation failed: ${error.message}`);
  }
};

export const handlePaymentWebhook = async (webhookData) => {
  try {
    console.log(
      "Full webhook data received:",
      JSON.stringify(webhookData, null, 2)
    );

    const { event, data, payload } = webhookData;
    console.log(`Received webhook event: ${event}`);

    if (event === "charge.succeeded") {
      const { metadata, amount, id } = payload || data;
      const subscriptionId = metadata.subscriptionId;

      console.log(
        `Processing payment completion for subscription ${subscriptionId}`
      );

      // Get subscription details
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { company: true, plan: true },
      });

      if (!subscription) {
        console.error(`Subscription ${subscriptionId} not found`);
        return;
      }

      // Calculate new end date - always add 30 days from payment date
      const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "ACTIVE",
          startDate: subscription.startDate || new Date(), // Keep original start date if exists
          endDate: newEndDate, // New 30-day period from payment date
        },
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          companyId: subscription.companyId,
          subscriptionId,
          amount: amount, // GMD is already in base units, no conversion needed
          status: "COMPLETED",
          modemPayReference: id,
          paidAt: new Date(),
        },
      });

      console.log(
        `✅ Payment completed and subscription activated for company ${subscription.company.companyName}`
      );

      // TODO: Send confirmation email to company
      // await sendSubscriptionConfirmationEmail(subscription.company, subscription.plan);
    } else if (event === "charge.failed") {
      const { metadata, id } = payload || data;
      const subscriptionId = metadata.subscriptionId;

      console.log(`Payment failed for subscription ${subscriptionId}`);

      // Update payment status to failed
      await prisma.payment.updateMany({
        where: {
          subscriptionId,
          modemPayReference: id,
        },
        data: {
          status: "FAILED",
        },
      });

      // TODO: Send payment failure notification
      // await sendPaymentFailureEmail(subscription.company);
    } else {
      console.log(`Unhandled webhook event: ${event}`);
    }
  } catch (error) {
    console.error("Webhook handling failed:", error);
    throw error;
  }
};

// Payment history is now handled directly in the controller with pagination
