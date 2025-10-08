import prisma from "../config/prisma.config.js";

export const checkSubscription = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;

    // Get company with subscription
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    // Check if company has lifetime access (bypass subscription check)
    if (company.hasLifetimeAccess) {
      console.log(
        `Company ${company.companyName} has lifetime access - bypassing subscription check`
      );
      req.subscription = {
        status: "ACTIVE",
        plan: {
          name: "Lifetime Access",
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
          maxEmployees: null, // unlimited
        },
      };
      return next();
    }

    const subscription = company.subscription;

    if (!subscription) {
      return res.status(403).json({
        success: false,
        error: "No subscription found. Please subscribe to continue.",
        errorCode: "NO_SUBSCRIPTION",
      });
    }

    const now = new Date();

    // Handle TRIAL subscription - allow access if trial hasn't expired
    if (subscription.status === "TRIAL") {
      if (subscription.trialEndDate && subscription.trialEndDate > now) {
        console.log(
          `Company ${company.companyName} is in trial period, expires: ${subscription.trialEndDate}`
        );
        req.subscription = subscription;
        return next();
      } else {
        // Trial expired, convert to PENDING
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "PENDING" },
        });

        return res.status(402).json({
          success: false,
          error: "Free trial expired. Please subscribe to continue.",
          errorCode: "TRIAL_EXPIRED",
          subscription: {
            id: subscription.id,
            status: "PENDING",
            plan: subscription.plan,
          },
        });
      }
    }

    // Handle PENDING subscription - requires payment completion
    if (subscription.status === "PENDING") {
      return res.status(402).json({
        success: false,
        error:
          "Payment required. Please complete your subscription payment to continue.",
        errorCode: "PAYMENT_REQUIRED",
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: subscription.plan,
          createdAt: subscription.createdAt,
        },
      });
    }

    const isActiveAndValid =
      subscription.status === "ACTIVE" && subscription.endDate > now;
    const isCancelledButValid =
      subscription.status === "CANCELLED" && subscription.endDate > now;

    if (!isActiveAndValid && !isCancelledButValid) {
      return res.status(403).json({
        success: false,
        error:
          "Subscription expired. Please renew to continue using the service.",
        errorCode: "SUBSCRIPTION_EXPIRED",
        subscription: {
          status: subscription.status,
          endDate: subscription.endDate,
        },
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Subscription check failed:", error);
    res.status(500).json({
      success: false,
      error: "Subscription check failed",
    });
  }
};
