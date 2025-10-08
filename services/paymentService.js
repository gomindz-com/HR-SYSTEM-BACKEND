import modempay from "../config/modem.config.js";
import prisma from "../config/prisma.config.js";
import {
  DISPLAY_CURRENCY,
  PAYMENT_CURRENCY,
  USD_TO_GMD_RATE,
} from "../config/plans.config.js";
import {
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
} from "../emails/subscriptionEmails.js";

export const createPaymentIntent = async (
  subscriptionId,
  amount,
  currency = DISPLAY_CURRENCY.code,
  returnUrl = null,
  additionalMetadata = {}
) => {
  try {
    // Amount comes in as USD, convert to GMD for Modem Pay
    const amountInGMD = Math.round(amount * USD_TO_GMD_RATE);

    console.log(
      `Creating payment intent for subscription ${subscriptionId}, amount: $${amount} USD (GMD ${amountInGMD})`
    );

    const paymentIntentData = {
      amount: amountInGMD, // Modem Pay only accepts GMD
      currency: PAYMENT_CURRENCY.code, // Always GMD for Modem Pay
      metadata: {
        subscriptionId,
        type: "subscription",
        usdAmount: amount, // Store original USD amount for reference
        conversionRate: USD_TO_GMD_RATE,
        ...additionalMetadata,
      },
    };

    // Add return_url if provided
    if (returnUrl) {
      paymentIntentData.return_url = returnUrl;
    }

    const intent = await modempay.paymentIntents.create(paymentIntentData);

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
      const eventId = webhookData.event_id; // Track event ID for idempotency

      console.log(
        `Processing payment completion for subscription ${subscriptionId}`
      );

      // Get subscription details
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          company: {
            include: {
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

      if (!subscription) {
        console.error(`Subscription ${subscriptionId} not found`);
        return;
      }

      // Check if this is an upgrade payment using metadata
      const isUpgradePayment =
        metadata.type === "upgrade" && metadata.newPlanId;

      if (isUpgradePayment) {
        // This is an upgrade payment - update the current subscription with new plan
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            planId: metadata.newPlanId, // Switch to new plan
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Extend by 30 days
          },
        });

        console.log(
          `Upgraded subscription for company ${subscription.companyId} to plan ${metadata.newPlanId}`
        );
      } else {
        // Regular subscription payment - extend current subscription
        const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: "ACTIVE",
            startDate: subscription.startDate || new Date(),
            endDate: newEndDate,
          },
        });
      }

      // For upgrades, use the current subscription ID for payment record
      const paymentSubscriptionId = subscriptionId;

      // Check if payment already exists to prevent duplicates
      const existingPayment = await prisma.payment.findFirst({
        where: {
          subscriptionId: paymentSubscriptionId,
          modemPayReference: id,
        },
      });

      if (existingPayment) {
        console.log(
          `⚠️ Payment already processed for subscription ${paymentSubscriptionId} - skipping duplicate`
        );
        return;
      }

      // Create payment record
      // Amount from Modem Pay is in GMD, but we store in USD
      // Use the USD amount from metadata if available, otherwise convert from GMD
      const amountInUSD = metadata.usdAmount || amount / USD_TO_GMD_RATE;

      await prisma.payment.create({
        data: {
          companyId: subscription.companyId,
          subscriptionId: paymentSubscriptionId,
          amount: amountInUSD, // Store in USD for consistency
          status: "COMPLETED",
          modemPayReference: id,
          paidAt: new Date(),
        },
      });

      console.log(
        `✅ Payment completed and subscription activated for company ${subscription.company.companyName}`
      );

      // Send payment success email
      try {
        await sendPaymentSuccessEmail(subscription.company, subscription, {
          amount: amountInUSD, // Send USD amount for email display
          paidAt: new Date(),
        });
      } catch (emailError) {
        console.error("Failed to send payment success email:", emailError);
        // Don't fail the webhook if email fails
      }
    } else if (event === "charge.failed") {
      const { metadata, id } = payload || data;
      const subscriptionId = metadata.subscriptionId;

      console.log(`Payment failed for subscription ${subscriptionId}`);

      // Get subscription details for email
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          company: {
            include: {
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

      // Send payment failure email
      if (subscription) {
        try {
          await sendPaymentFailureEmail(
            subscription.company,
            subscription,
            "Payment processing failed"
          );
        } catch (emailError) {
          console.error("Failed to send payment failure email:", emailError);
          // Don't fail the webhook if email fails
        }
      }
    } else if (event === "payment_intent.created") {
      console.log("Payment intent created - no action needed");
    } else {
      console.log(`Unhandled webhook event: ${event}`);
    }
  } catch (error) {
    console.error("Webhook handling failed:", error);
    throw error;
  }
};

// Payment history is now handled directly in the controller with pagination
