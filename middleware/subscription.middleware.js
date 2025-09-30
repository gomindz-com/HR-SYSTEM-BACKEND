import prisma from "../config/prisma.config.js";

export const checkSubscription = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;

    const subscription = await prisma.subscription.findUnique({
      where: {
        companyId,
      },
      include: { plan: true },
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        error: "No active subscription found. Please subscribe to continue.",
      });
    }

    const now = new Date();
    const isActive = subscription.status === "ACTIVE";
    const isCancelledButValid =
      subscription.status === "ACTIVE" && subscription.endDate > now;

    if (!isActive && !isCancelledButValid) {
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
