import prisma from "../config/prisma.config.js";
import { createPaymentIntent } from "../services/paymentService.js";
import { DISPLAY_CURRENCY } from "../config/plans.config.js";

export const getPlans = async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    });

    res.json({
      success: true,
      plans,
      currency: DISPLAY_CURRENCY,
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
    const companyId = req.user.companyId;

    console.log(`Creating trial subscription for company ${companyId}`);

    // Check if company has lifetime access
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { hasLifetimeAccess: true },
    });

    if (company?.hasLifetimeAccess) {
      return res.status(400).json({
        success: false,
        error: "Company has lifetime access. No subscription needed.",
      });
    }

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

    // Get Enterprise plan (everyone gets full access during trial)
    const enterprisePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Enterprise" },
    });

    if (!enterprisePlan) {
      return res.status(404).json({
        success: false,
        error: "Enterprise plan not found. Please contact support.",
      });
    }

    // Create subscription with 14-day free trial (Enterprise features)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days from now

    const subscription = await prisma.subscription.create({
      data: {
        companyId,
        planId: enterprisePlan.id,
        status: "TRIAL",
        startDate: new Date(),
        trialEndDate: trialEndDate,
      },
      include: {
        plan: true,
      },
    });

    console.log(
      `Trial subscription created: ${subscription.id}, expires: ${trialEndDate}`
    );

    res.json({
      success: true,
      message:
        "🎉 Welcome! You have 14 days of full access to all Enterprise features.",
      data: {
        subscription,
        trialDays: 14,
        trialEndDate: trialEndDate,
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

    // Check if company has lifetime access
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { hasLifetimeAccess: true },
    });

    if (company?.hasLifetimeAccess) {
      // Return mock subscription for lifetime access
      return res.json({
        success: true,
        data: {
          subscription: {
            id: "lifetime",
            companyId: companyId,
            status: "ACTIVE",
            plan: {
              id: "lifetime",
              name: "Lifetime Access",
              price: 0,
              maxEmployees: null, // unlimited
              features: [
                "attendance",
                "leave",
                "basic_reports",
                "payroll",
                "reports",
                "performance",
                "analytics",
                "api_access",
                "custom_integrations",
              ],
              isActive: true,
            },
            payments: [],
          },
        },
      });
    }

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

    // Check if company has lifetime access
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { hasLifetimeAccess: true },
    });

    if (company?.hasLifetimeAccess) {
      return res.status(400).json({
        success: false,
        error: "Company has lifetime access. Plan switching not available.",
      });
    }

    // Validate planId
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: "Plan ID is required",
      });
    }

    // Get current subscription (allow switching from any status)
    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        companyId,
        status: { in: ["TRIAL", "PENDING", "ACTIVE", "CANCELLED"] },
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

    // For TRIAL or PENDING status, just update the plan (no payment yet)
    if (
      currentSubscription.status === "TRIAL" ||
      currentSubscription.status === "PENDING"
    ) {
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: { planId: planId },
      });

      const updatedSubscription = await prisma.subscription.findUnique({
        where: { id: currentSubscription.id },
        include: { plan: true, company: true },
      });

      res.json({
        success: true,
        message: "Plan updated successfully. Complete payment when ready.",
        data: {
          subscription: updatedSubscription,
          newPlan: newPlan,
        },
      });
      return;
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
      const returnUrl = `${process.env.CLIENT_URL || "http://localhost:8080"}/subscription?reactivate=success`;
      const { paymentLink, intentId } = await createPaymentIntent(
        currentSubscription.id,
        newPlan.price,
        DISPLAY_CURRENCY.code,
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
          currency: DISPLAY_CURRENCY,
          newPlan: newPlan,
          isReactivation: true,
        },
      });
      return;
    }

    // Calculate prorated amount if upgrading (for ACTIVE subscriptions)
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
      const returnUrl = `${process.env.CLIENT_URL || "http://localhost:8080"}/subscription?upgrade=success`;

      // Create payment intent with upgrade metadata
      const { paymentLink, intentId } = await createPaymentIntent(
        currentSubscription.id, // Use current subscription ID
        amountToCharge,
        DISPLAY_CURRENCY.code,
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
          currency: DISPLAY_CURRENCY,
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

    // Check if company has lifetime access
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { hasLifetimeAccess: true },
    });

    if (company?.hasLifetimeAccess) {
      return res.status(400).json({
        success: false,
        error: "Company has lifetime access. No renewal needed.",
      });
    }

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
    const returnUrl = `${process.env.CLIENT_URL || "http://localhost:8080"}/subscription?renewal=success`;
    const { paymentLink, intentId } = await createPaymentIntent(
      subscription.id,
      subscription.plan.price,
      DISPLAY_CURRENCY.code,
      returnUrl
    );

    // Check if this is a direct link request (from email)
    const userAgent = req.get("User-Agent") || "";
    const isDirectLink =
      req.query.direct === "true" || userAgent.includes("Mozilla");

    if (isDirectLink) {
      // Redirect directly to payment link for email clicks
      res.redirect(paymentLink);
    } else {
      // Return JSON for API calls
      res.json({
        success: true,
        message: "Renewal payment intent created successfully",
        data: {
          paymentLink,
          intentId,
          amount: subscription.plan.price,
          currency: DISPLAY_CURRENCY,
          plan: subscription.plan,
          subscription: {
            id: subscription.id,
            endDate: subscription.endDate,
          },
        },
      });
    }
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

    // Check if company has lifetime access
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { hasLifetimeAccess: true },
    });

    if (company?.hasLifetimeAccess) {
      return res.status(400).json({
        success: false,
        error:
          "Company has lifetime access. Cannot cancel lifetime subscription.",
      });
    }

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

    // Check if company has lifetime access
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { hasLifetimeAccess: true },
    });

    if (company?.hasLifetimeAccess) {
      return res.status(400).json({
        success: false,
        error: "Company has lifetime access. No payment needed.",
      });
    }

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
    const returnUrl = `${process.env.CLIENT_URL || "http://localhost:8080"}/hr-choice?payment=success`;
    const { paymentLink, intentId } = await createPaymentIntent(
      subscription.id,
      subscription.plan.price,
      DISPLAY_CURRENCY.code,
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
        currency: DISPLAY_CURRENCY,
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
