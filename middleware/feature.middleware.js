import { FEATURE_DEFINITIONS } from "../config/plans.config.js";
import prisma from "../config/prisma.config.js";

export const checkFeatureAccess = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      const subscription = req.subscription;
      if (!subscription) {
        return res.status(403).json({
          success: false,
          error: "Subscription not found",
        });
      }

      // check if plan includes that specific feature
      if (!subscription.plan.features.includes(requiredFeature)) {
        return res.status(403).json({
          success: false,
          error: `Feature ${FEATURE_DEFINITIONS[requiredFeature]} not available in your plan. Please upgrade.`,
          currentPlan: subscription.plan.name,
          requiredFeature: requiredFeature,
        });
      }

      next();
    } catch (error) {
      console.error("Feature access check failed:", error);
      res.status(500).json({
        success: false,
        error: "Feature access check failed",
      });
    }
  };
};
