import prisma from "../config/prisma.config.js";
import { createPaymentIntent } from "../services/paymentService.js";
import { CURRENCY_CONFIG } from "../config/plans.config.js";

export const getPlans = async (req, res) => {
  try {
    console.log("Fetching subscription plans...");

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });

    console.log(`Found ${plans.length} active plans`);
    res.json({
      success: true,
      plans,
      currency: CURRENCY_CONFIG,
    });
  } catch (error) {
    console.error("Get plans failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get subscription plans",
    });
  }
};

export const createSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const companyId = req.user.companyId;

    console.log(
      `Creating subscription for company ${companyId}, plan: ${planId}`
    );

    // Check if company already has subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { companyId },
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: "Company already has an active subscription",
      });
    }

    // Get plan details
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: "Subscription plan not found",
      });
    }

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        companyId,
        planId,
        status: "PENDING",
      },
      include: {
        plan: true,
      },
    });

    console.log(`Subscription created: ${subscription.id}`);

    // Create payment intent with return URL
    const returnUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/hr-choice`;
    const { paymentLink, intentId } = await createPaymentIntent(
      subscription.id,
      plan.price,
      CURRENCY_CONFIG.code,
      returnUrl
    );

    res.json({
      success: true,
      message:
        "Subscription created successfully. Please complete payment to activate.",
      data: {
        subscription,
        paymentLink,
        intentId,
      },
    });
  } catch (error) {
    console.error("Create subscription failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create subscription",
    });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    console.log(`Getting subscription status for company ${companyId}`);

    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 5, // Last 5 payments
        },
      },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "No subscription found for this company",
      });
    }

    res.json({
      success: true,
      data: { subscription },
    });
  } catch (error) {
    console.error("Get subscription status failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get subscription status",
    });
  }
};

export const switchPlan = async (req, res) => {
  try {
    const { planId } = req.body;
    const companyId = req.user.companyId;

    console.log(`Switching plan for company ${companyId} to ${planId}`);

    // Validate planId
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "Plan ID is required",
      });
    }

    // Get current subscription (allow switching from cancelled subscriptions too)
    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        companyId,
        status: { in: ["ACTIVE", "CANCELLED"] },
      },
      include: { plan: true },
    });

    if (!currentSubscription) {
      return res.status(404).json({
        success: false,
        error: "No subscription found. Please create a new subscription first.",
      });
    }

    // Get new plan details
    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!newPlan) {
      return res.status(404).json({
        success: false,
        error: "New plan not found",
      });
    }

    // Check if it's the same plan
    if (currentSubscription.planId === planId) {
      return res.status(400).json({
        success: false,
        error: "Already subscribed to this plan",
      });
    }

    // If subscription is cancelled, reactivate it with new plan
    if (currentSubscription.status === "CANCELLED") {
      const newEndDate = new Date();
      newEndDate.setMonth(newEndDate.getMonth() + 1); // 1 month from now

      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: planId,
          status: "PENDING", // Will be activated after payment
          startDate: new Date(),
          endDate: newEndDate,
        },
      });

      // Create payment intent for the new plan
      const returnUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/subscription?reactivate=success`;
      const { paymentLink, intentId } = await createPaymentIntent(
        currentSubscription.id,
        newPlan.price,
        CURRENCY_CONFIG.code,
        returnUrl,
        {
          type: "reactivate",
          newPlanId: planId,
        }
      );

      res.json({
        success: true,
        message:
          "Subscription reactivated with new plan. Please complete payment to activate.",
        data: {
          paymentLink,
          intentId,
          amount: newPlan.price,
          currency: CURRENCY_CONFIG,
          newPlan: newPlan,
          isReactivation: true,
        },
      });
      return;
    }

    // Calculate prorated amount if upgrading
    const isUpgrade = newPlan.price > currentSubscription.plan.price;
    const daysRemaining = Math.ceil(
      (currentSubscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
    );

    let amountToCharge = 0;
    if (isUpgrade) {
      // Charge the difference for remaining days
      const priceDifference = newPlan.price - currentSubscription.plan.price;
      const dailyRate = priceDifference / 30;
      amountToCharge = Math.round(dailyRate * daysRemaining); // Round to avoid decimals
    }

    // If upgrade, create payment for difference first (don't change plan yet)
    if (isUpgrade && amountToCharge > 0) {
      const returnUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/subscription?upgrade=success`;

      // Create payment intent with upgrade metadata
      const { paymentLink, intentId } = await createPaymentIntent(
        currentSubscription.id, // Use current subscription ID
        amountToCharge,
        CURRENCY_CONFIG.code,
        returnUrl,
        {
          type: "upgrade",
          newPlanId: planId,
          currentPlanId: currentSubscription.planId,
        }
      );

      res.json({
        success: true,
        message:
          "Please complete payment to upgrade your plan. Your current plan remains active until payment is successful.",
        data: {
          paymentLink,
          intentId,
          amount: amountToCharge,
          currency: CURRENCY_CONFIG,
          newPlan: newPlan,
          isUpgrade: true,
        },
      });
    } else {
      // For downgrades or same price, change plan immediately
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: { planId: planId },
      });

      res.json({
        success: true,
        message: "Plan switched successfully",
        data: {
          newPlan: newPlan,
          isUpgrade: false,
        },
      });
    }
  } catch (error) {
    console.error("Plan switch failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to switch plan",
    });
  }
};

export const createRenewalPayment = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // Get current subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        companyId,
        status: "ACTIVE",
      },
      include: { plan: true },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "No active subscription found",
      });
    }

    // Check if subscription is expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (subscription.endDate > thirtyDaysFromNow) {
      return res.status(400).json({
        success: false,
        error: "Subscription is not due for renewal yet",
        endDate: subscription.endDate,
      });
    }

    // Create fresh payment intent for renewal
    const { paymentLink, intentId } = await createPaymentIntent(
      subscription.id,
      subscription.plan.price
    );

    res.json({
      success: true,
      message: "Renewal payment intent created successfully",
      data: {
        paymentLink,
        intentId,
        amount: subscription.plan.price,
        currency: CURRENCY_CONFIG,
        plan: subscription.plan,
        subscription: {
          id: subscription.id,
          endDate: subscription.endDate,
        },
      },
    });
  } catch (error) {
    console.error("Create renewal payment failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create renewal payment",
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    console.log(`Cancelling subscription for company ${companyId}`);

    const subscription = await prisma.subscription.findFirst({
      where: {
        companyId,
        status: "ACTIVE",
      },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "No active subscription found",
      });
    }

    // Mark subscription as cancelled (will expire at end of current period)
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
        // Keep endDate as is - they get access until current period ends
      },
    });

    res.json({
      success: true,
      message:
        "Subscription cancelled. You will retain access until the end of your current billing period.",
      data: {
        endDate: subscription.endDate,
      },
    });
  } catch (error) {
    console.error("Subscription cancellation failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel subscription",
    });
  }
};

export const regeneratePaymentLink = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    console.log(`Regenerating payment link for company ${companyId}`);

    // Get current subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        companyId,
        status: "PENDING",
      },
      include: { plan: true },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "No pending subscription found",
      });
    }

    // Create fresh payment intent
    const returnUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/hr-choice?payment=success`;
    const { paymentLink, intentId } = await createPaymentIntent(
      subscription.id,
      subscription.plan.price,
      CURRENCY_CONFIG.code,
      returnUrl,
      {
        type: "subscription",
        planId: subscription.planId,
      }
    );

    res.json({
      success: true,
      message: "Payment link regenerated successfully",
      data: {
        paymentLink,
        intentId,
        amount: subscription.plan.price,
        currency: CURRENCY_CONFIG,
        plan: subscription.plan,
        subscription: {
          id: subscription.id,
          createdAt: subscription.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Regenerate payment link failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to regenerate payment link",
    });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(
      `Getting payment history for company ${companyId}, page: ${page}, limit: ${limit}`
    );

    // Get total count for pagination
    const totalCount = await prisma.payment.count({
      where: { companyId },
    });

    // Get paginated payments
    const payments = await prisma.payment.findMany({
      where: { companyId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get payment history failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get payment history",
    });
  }
};
