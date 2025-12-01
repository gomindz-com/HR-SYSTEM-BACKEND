import modempay from "../config/modem.config.js";
import prisma from "../config/prisma.config.js";
import { DISPLAY_CURRENCY, PAYMENT_CURRENCY } from "../config/plans.config.js";
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
    // Amount is already in GMD (plans are priced in GMD)
    const amountInGMD = Math.round(amount);

    const employeeInfo = additionalMetadata.employeeCount
      ? ` (${additionalMetadata.pricePerUser} GMD × ${additionalMetadata.employeeCount} users)`
      : "";

    console.log(
      `Creating payment intent for subscription ${subscriptionId}, amount: ${amountInGMD} GMD${employeeInfo}`
    );

    const paymentIntentData = {
      amount: amountInGMD, // Modem Pay only accepts GMD
      currency: PAYMENT_CURRENCY.code, // Always GMD for Modem Pay
      metadata: {
        subscriptionId,
        type: "subscription",
        gmdAmount: amount, // Store GMD amount
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

    // Get payment link from Modem Pay response
    // Modem Pay should provide payment_link directly
    let paymentLink = intent.data.payment_link || intent.data.link;

    // Only reconstruct if payment_link is not provided (fallback)
    if (!paymentLink) {
      const token = intent.data.token;
      const paymentIntentId = intent.data.payment_intent_id || intent.data.id;

      if (token) {
        paymentLink = `https://checkout.modempay.com/?token=${token}`;
        console.log("Payment link not provided, constructed using token");
      } else if (paymentIntentId) {
        paymentLink = `https://checkout.modempay.com/?payment_intent=${paymentIntentId}`;
        console.log(
          "Payment link not provided, constructed using payment intent ID"
        );
      } else {
        console.error(
          "Payment link not found in Modem Pay response:",
          JSON.stringify(intent.data, null, 2)
        );
        throw new Error(
          "Payment link not provided by Modem Pay. Please check the API response."
        );
      }
    }

    // Validate that payment link is a valid absolute URL
    try {
      const url = new URL(paymentLink);
      if (!url.protocol || !url.host) {
        throw new Error("Payment link is not a valid absolute URL");
      }
    } catch (urlError) {
      console.error("Invalid payment link format:", paymentLink, urlError);
      throw new Error("Invalid payment link format received from Modem Pay");
    }

    return {
      paymentLink,
      intentId: intent.data.payment_intent_id || intent.data.id,
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
        // Add 30 days to current endDate (or use now + 30 days if subscription is expired)
        const currentEndDate = subscription.endDate || new Date();
        const now = new Date();
        const baseDate = currentEndDate > now ? currentEndDate : now;
        const newEndDate = new Date(
          baseDate.getTime() + 30 * 24 * 60 * 60 * 1000
        ); // Add 30 days

        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            planId: metadata.newPlanId, // Switch to new plan
            endDate: newEndDate,
          },
        });

        console.log(
          `Upgraded subscription for company ${subscription.companyId} to plan ${metadata.newPlanId}`
        );
      } else {
        // Regular subscription payment - extend current subscription by 30 days
        // Add 30 days to current endDate (or use now + 30 days if subscription is expired)
        const currentEndDate = subscription.endDate || new Date();
        const now = new Date();
        const baseDate = currentEndDate > now ? currentEndDate : now;
        const newEndDate = new Date(
          baseDate.getTime() + 30 * 24 * 60 * 60 * 1000
        ); // Add 30 days

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
      // Amount from Modem Pay is in GMD
      // Use the GMD amount from metadata if available, otherwise use the amount from payload
      const amountInGMD = metadata.gmdAmount || amount;

      await prisma.payment.create({
        data: {
          companyId: subscription.companyId,
          subscriptionId: paymentSubscriptionId,
          amount: amountInGMD, // Store in GMD
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
          amount: amountInGMD, // Send GMD amount for email display
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
