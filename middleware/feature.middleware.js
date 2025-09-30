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

      // Check employee count limits
      if (subscription.plan.maxEmployees) {
        const employeeCount = await prisma.employee.count({
          where: {
            companyId: req.user.companyId,
            deleted: false,
          },
        });

        if (employeeCount >= subscription.plan.maxEmployees) {
          return res.status(403).json({
            success: false,
            error: `Employee limit reached (${subscription.plan.maxEmployees}). Please upgrade your plan.`,
            currentCount: employeeCount,
            maxEmployees: subscription.plan.maxEmployees,
          });
        }
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
