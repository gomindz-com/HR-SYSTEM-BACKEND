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
        error: "No active subscription found. Please subscribe to continue.",
      });
    }

    const now = new Date();
    const isActiveAndValid =
      subscription.status === "ACTIVE" && subscription.endDate > now;
    const isCancelledButValid =
      subscription.status === "CANCELLED" && subscription.endDate > now;

    if (!isActiveAndValid && !isCancelledButValid) {
      return res.status(403).json({
        success: false,
        error:
          "Subscription expired. Please renew to continue using the service.",
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
