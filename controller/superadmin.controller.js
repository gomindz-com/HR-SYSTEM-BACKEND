import prisma from "../config/prisma.config.js";
import { SUBSCRIPTION_PLANS } from "../config/plans.config.js";

// Get all companies with pagination
export const getCompanies = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      dateFrom,
      dateTo,
      subscriptionStatus,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { companyEmail: { contains: search, mode: "insensitive" } },
        { companyTin: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Filter by subscription status
    if (subscriptionStatus) {
      if (subscriptionStatus === "LIFETIME") {
        where.hasLifetimeAccess = true;
      } else {
        where.hasLifetimeAccess = false;
        where.subscription = {
          status: subscriptionStatus,
        };
      }
    }

    // Get companies with related data
    const [companies, totalCount] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              employees: true,
            },
          },
          hr: {
            select: {
              name: true,
              email: true,
            },
          },
          subscription: {
            include: {
              plan: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    res.status(200).json({
      success: true,
      data: companies,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        pageSize: pageSizeNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({
      message: "Failed to fetch companies",
      error: error.message,
    });
  }
};


// controllers/subscriptionController.js

export const getSubscriptionTrends = async (req, res) => {
  try {
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Forbidden: Super admin access required",
      });
    }

    const { months = 6 } = req.query;
    const monthsToShow = parseInt(months, 10);

    // Get all subscriptions with necessary fields
    const subscriptions = await prisma.subscription.findMany({
      select: {
        status: true,
        createdAt: true,
        trialEndDate: true,
        startDate: true,
        endDate: true,
      },
    });

    // Process data into monthly buckets
    const monthlyData = processSubscriptionTrends(subscriptions, monthsToShow);

    res.status(200).json({
      success: true,
      data: monthlyData,
    });
  } catch (error) {
    console.error("Error fetching subscription trends:", error);
    res.status(500).json({
      message: "Failed to fetch subscription trends",
      error: error.message,
    });
  }
};

export const getSubscriptionDistribution = async (req, res) => {
  try {
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Forbidden: Super admin access required",
      });
    }

    // Get counts by status
    const statusCounts = await prisma.subscription.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    });

    // Format for the chart
    const distribution = {
      active: 0,
      trial: 0,
      expired: 0,
      pending: 0,
      cancelled: 0,
    };

    statusCounts.forEach((item) => {
      const count = item._count.status;

      switch (item.status) {
        case "ACTIVE":
          distribution.active = count;
          break;
        case "TRIAL":
          distribution.trial = count;
          break;
        case "EXPIRED":
          distribution.expired = count;
          break;
        case "PENDING":
          distribution.pending = count;
          break;
        case "CANCELLED":
          distribution.cancelled = count;
          break;
      }
    });

    // Get total count
    const totalCount = await prisma.subscription.count();

    res.status(200).json({
      success: true,
      data: distribution,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching subscription distribution:", error);
    res.status(500).json({
      message: "Failed to fetch subscription distribution",
      error: error.message,
    });
  }
};

export const getSubscriptionStats = async (req, res) => {
  try {
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Forbidden: Super admin access required",
      });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get various subscription statistics
    const [
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      newSubscriptionsThisMonth,
      expiringThisMonth,
    ] = await Promise.all([
      // Total subscriptions
      prisma.subscription.count(),

      // Active subscriptions
      prisma.subscription.count({
        where: { status: "ACTIVE" },
      }),

      // Trial subscriptions
      prisma.subscription.count({
        where: { status: "TRIAL" },
      }),

      // Expired subscriptions
      prisma.subscription.count({
        where: {
          OR: [{ status: "EXPIRED" }, { status: "CANCELLED" }],
        },
      }),

      // New subscriptions in last 30 days
      prisma.subscription.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),

      // Subscriptions expiring this month
      prisma.subscription.count({
        where: {
          endDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lte: new Date(now.getFullYear(), now.getMonth() + 1, 0),
          },
          status: "ACTIVE",
        },
      }),
    ]);

    // Calculate growth rate
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const subscriptionsLastMonth = await prisma.subscription.count({
      where: {
        createdAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
      },
    });

    const growthRate =
      subscriptionsLastMonth > 0
        ? ((newSubscriptionsThisMonth - subscriptionsLastMonth) /
            subscriptionsLastMonth) *
          100
        : 0;

    res.status(200).json({
      success: true,
      data: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        trial: trialSubscriptions,
        expired: expiredSubscriptions,
        newThisMonth: newSubscriptionsThisMonth,
        expiringThisMonth,
        growthRate: Math.round(growthRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error fetching subscription stats:", error);
    res.status(500).json({
      message: "Failed to fetch subscription statistics",
      error: error.message,
    });
  }
};

export const getSubscriptionRevenue = async (req, res) => {
  try {
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Forbidden: Super admin access required",
      });
    }

    const { months = 6 } = req.query;
    const monthsToShow = parseInt(months, 10);

    // Get completed payments with subscription details
    const payments = await prisma.payment.findMany({
      where: {
        status: "COMPLETED",
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Process revenue by month
    const revenueData = processRevenueByMonth(payments, monthsToShow);

    res.status(200).json({
      success: true,
      data: revenueData,
    });
  } catch (error) {
    console.error("Error fetching subscription revenue:", error);
    res.status(500).json({
      message: "Failed to fetch subscription revenue",
      error: error.message,
    });
  }
};

// Helper function to process subscription trends
function processSubscriptionTrends(subscriptions, monthsToShow) {
  const now = new Date();
  const monthlyStats = {};

  // Initialize last N months
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    monthlyStats[monthKey] = { active: 0, trial: 0, expired: 0 };
  }

  // Count subscriptions by status for each month
  subscriptions.forEach((sub) => {
    const createdDate = new Date(sub.createdAt);
    const monthKey = createdDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    if (monthlyStats[monthKey]) {
      // Determine current status
      const status = determineSubscriptionStatus(sub, now);

      if (status === "ACTIVE") {
        monthlyStats[monthKey].active++;
      } else if (status === "TRIAL") {
        monthlyStats[monthKey].trial++;
      } else if (status === "EXPIRED" || status === "CANCELLED") {
        monthlyStats[monthKey].expired++;
      }
    }
  });

  // Convert to array format
  return Object.entries(monthlyStats).map(([month, stats]) => ({
    month,
    ...stats,
  }));
}

// Helper function to determine subscription status
function determineSubscriptionStatus(subscription, currentDate) {
  const { status, trialEndDate, endDate } = subscription;

  // Check if trial has expired
  if (status === "TRIAL" && trialEndDate && new Date(trialEndDate) < currentDate) {
    return "EXPIRED";
  }

  // Check if subscription has expired
  if (status === "ACTIVE" && endDate && new Date(endDate) < currentDate) {
    return "EXPIRED";
  }

  return status;
}

// Helper function to process revenue by month
function processRevenueByMonth(payments, monthsToShow) {
  const now = new Date();
  const monthlyRevenue = {};

  // Initialize last N months
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    monthlyRevenue[monthKey] = { revenue: 0, count: 0 };
  }

  // Sum revenue by month
  payments.forEach((payment) => {
    const paidDate = new Date(payment.paidAt || payment.createdAt);
    const monthKey = paidDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    if (monthlyRevenue[monthKey]) {
      monthlyRevenue[monthKey].revenue += payment.amount;
      monthlyRevenue[monthKey].count++;
    }
  });

  // Convert to array format
  return Object.entries(monthlyRevenue).map(([month, data]) => ({
    month,
    revenue: Math.round(data.revenue * 100) / 100,
    count: data.count,
  }));
}


// Get company statistics
export const getCompanyStats = async (req, res) => {
  try {
    // Use Promise.all to fetch all stats in parallel for better performance
    const [
      totalCompanies,
      companiesWithLifetimeAccess,
      companiesWithActiveSubscription,
      companiesWithTrialSubscription,
      companiesWithExpiredSubscription,
      companiesWithPendingSubscription,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({
        where: { hasLifetimeAccess: true },
      }),
      prisma.company.count({
        where: {
          hasLifetimeAccess: false,
          subscription: {
            status: "ACTIVE",
          },
        },
      }),
      prisma.company.count({
        where: {
          hasLifetimeAccess: false,
          subscription: {
            status: "TRIAL",
          },
        },
      }),
      prisma.company.count({
        where: {
          hasLifetimeAccess: false,
          subscription: {
            status: "EXPIRED",
          },
        },
      }),
      prisma.company.count({
        where: {
          hasLifetimeAccess: false,
          OR: [{ subscription: { status: "PENDING" } }, { subscription: null }],
        },
      }),
    ]);

    const stats = {
      totalCompanies,
      companiesWithActiveSubscription,
      companiesWithTrialSubscription,
      companiesWithExpiredSubscription,
      companiesWithLifetimeAccess,
      companiesWithPendingSubscription,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching company stats:", error);
    res.status(500).json({
      message: "Failed to fetch company statistics",
      error: error.message,
    });
  }
};

// Get Detail Company
export const getCompanyDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid company ID is required",
      });
    }

    // Fetch company with related data
    const company = await prisma.company.findUnique({
      where: { id: parseInt(id) },
      include: {
        // HR person details
        hr: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },

        // Employees with limited fields for overview
        employees: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            departmentId: true,
            status: true,
          },
          take: 10, // Limit for performance
          orderBy: { createdAt: "desc" },
        },

        // Departments
        departments: {
          select: {
            id: true,
            name: true,
            _count: {
              select: { employees: true },
            },
          },
        },

        // Locations
        locations: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },

        // Subscription info
        subscription: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            trialEndDate: true,
            plan: {
              select: {
                name: true,
              },
            },
          },
        },

        // Workday configuration
        WorkdayDaysConfig: {
          select: {
            id: true,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: true,
          },
        },

        // Counts for statistics
        _count: {
          select: {
            employees: true,
            departments: true,
            locations: true,
            attendances: true,
            leaveRequests: true,
          },
        },
      },
    });

    // Check if company exists
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Transform HR data to match frontend expectations
    let transformedHr = null;
    if (company.hr) {
      const nameParts = company.hr.name.split(" ");
      transformedHr = {
        id: company.hr.id,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: company.hr.email,
        phoneNumber: company.hr.phone,
      };
    }

    // Transform employees data
    const transformedEmployees = company.employees.map((emp) => {
      const nameParts = emp.name.split(" ");
      return {
        id: emp.id,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: emp.email,
        position: emp.position,
        departmentId: emp.departmentId,
        employeeStatus: emp.status,
      };
    });

    // Transform departments data
    const transformedDepartments = company.departments.map((dept) => ({
      id: dept.id,
      departmentName: dept.name,
      _count: dept._count,
    }));

    // Transform locations data
    const transformedLocations = company.locations.map((loc) => ({
      id: loc.id,
      locationName: loc.name,
      address: null, // CompanyLocation doesn't have address field
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));

    // Transform subscription data
    let transformedSubscription = null;
    if (company.subscription) {
      transformedSubscription = {
        id: company.subscription.id,
        subscriptionStatus: company.subscription.status,
        startDate: company.subscription.startDate,
        endDate: company.subscription.endDate,
        trialEndDate: company.subscription.trialEndDate,
        planType: company.subscription.plan?.name || "TRIAL",
      };
    }

    // Transform WorkdayDaysConfig to match frontend format
    const transformedWorkdayConfig = company.WorkdayDaysConfig.map((config) => {
      const days = [
        { day: "Monday", value: config.monday },
        { day: "Tuesday", value: config.tuesday },
        { day: "Wednesday", value: config.wednesday },
        { day: "Thursday", value: config.thursday },
        { day: "Friday", value: config.friday },
        { day: "Saturday", value: config.saturday },
        { day: "Sunday", value: config.sunday },
      ];

      return days.map(({ day, value }) => ({
        id: `${config.id}-${day}`,
        dayOfWeek: day,
        isWorkday: value,
      }));
    }).flat();

    // Calculate trial days remaining
    let trialInfo = null;
    if (company.subscription) {
      const isTrial = company.subscription.status === "TRIAL";

      if (isTrial && company.subscription.trialEndDate) {
        const now = new Date();
        const trialEndDate = new Date(company.subscription.trialEndDate);

        // Calculate days remaining
        const timeDiff = trialEndDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const isExpired = daysRemaining <= 0;

        trialInfo = {
          isTrial: true,
          daysRemaining: isExpired ? 0 : daysRemaining,
          isExpired: isExpired,
          endDate: company.subscription.trialEndDate,
        };
      } else if (isTrial && !company.subscription.trialEndDate) {
        // Trial subscription but no trialEndDate set
        trialInfo = {
          isTrial: true,
          daysRemaining: 0,
          isExpired: true,
          endDate: null,
        };
      }
    }

    // Return transformed company data
    return res.status(200).json({
      success: true,
      data: {
        id: company.id,
        companyName: company.companyName,
        companyEmail: company.companyEmail,
        companyTin: company.companyTin,
        companyAddress: company.companyAddress,
        companyDescription: company.companyDescription,
        timezone: company.timezone,
        workStartTime: company.workStartTime,
        workEndTime: company.workEndTime,
        workStartTime2: company.workStartTime2,
        workEndTime2: company.workEndTime2,
        lateThreshold: company.lateThreshold,
        checkInDeadline: company.checkInDeadline,
        lateThreshold2: company.lateThreshold2,
        checkInDeadline2: company.checkInDeadline2,
        hasLifetimeAccess: company.hasLifetimeAccess,
        createdAt: company.createdAt,
        hr: transformedHr,
        employees: transformedEmployees,
        departments: transformedDepartments,
        locations: transformedLocations,
        subscription: transformedSubscription,
        WorkdayDaysConfig: transformedWorkdayConfig,
        trialInfo,
        _count: company._count,
      },
    });
  } catch (error) {
    console.error("Error fetching company details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch company details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Grant lifetime access to a company
export const grantLifetimeAccess = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid company ID is required",
      });
    }

    const companyId = parseInt(id);

    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        hasLifetimeAccess: true,
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (company.hasLifetimeAccess) {
      return res.status(400).json({
        success: false,
        message: "Company already has lifetime access",
      });
    }

    // Delete any existing subscription and grant lifetime access in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete any existing subscription
      await tx.subscription.deleteMany({
        where: { companyId },
      });

      // Grant lifetime access
      await tx.company.update({
        where: { id: companyId },
        data: { hasLifetimeAccess: true },
      });
    });

    // Fetch updated company
    const updatedCompany = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
        hr: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Lifetime access granted successfully",
      data: updatedCompany,
    });
  } catch (error) {
    console.error("Error granting lifetime access:", error);
    res.status(500).json({
      success: false,
      message: "Failed to grant lifetime access",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Revoke lifetime access from a company
export const revokeLifetimeAccess = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid company ID is required",
      });
    }

    const companyId = parseInt(id);

    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        hasLifetimeAccess: true,
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (!company.hasLifetimeAccess) {
      return res.status(400).json({
        success: false,
        message: "Company does not have lifetime access",
      });
    }

    // Ensure Basic plan exists
    const basicPlanData = SUBSCRIPTION_PLANS.basic;
    const basicPlan = await prisma.subscriptionPlan.upsert({
      where: { id: basicPlanData.id },
      update: {
        name: basicPlanData.name,
        price: basicPlanData.price,
        maxEmployees: basicPlanData.maxEmployees,
        features: basicPlanData.features,
        isActive: true,
      },
      create: {
        id: basicPlanData.id,
        name: basicPlanData.name,
        price: basicPlanData.price,
        maxEmployees: basicPlanData.maxEmployees,
        features: basicPlanData.features,
        isActive: true,
      },
    });

    // Revoke lifetime access and create PENDING subscription in a transaction
    await prisma.$transaction(async (tx) => {
      // Revoke lifetime access
      await tx.company.update({
        where: { id: companyId },
        data: { hasLifetimeAccess: false },
      });

      // Delete any existing subscription first (in case one exists)
      await tx.subscription.deleteMany({
        where: { companyId },
      });

      // Create new PENDING subscription with Basic plan
      await tx.subscription.create({
        data: {
          companyId,
          planId: basicPlan.id,
          status: "PENDING",
          startDate: null,
          endDate: null,
          trialEndDate: null,
        },
      });
    });

    // Fetch updated company with subscription
    const updatedCompany = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
        hr: {
          select: {
            name: true,
            email: true,
          },
        },
        subscription: {
          include: {
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Lifetime access revoked. Basic PENDING subscription created.",
      data: updatedCompany,
    });
  } catch (error) {
    console.error("Error revoking lifetime access:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke lifetime access",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get companies with lifetime access
export const getLifetimeCompanies = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause - only companies with lifetime access
    const where = {
      hasLifetimeAccess: true,
    };

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { companyEmail: { contains: search, mode: "insensitive" } },
        { companyTin: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Get companies with related data
    const [companies, totalCount] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              employees: true,
            },
          },
          hr: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    res.status(200).json({
      success: true,
      data: companies,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        pageSize: pageSizeNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching lifetime companies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lifetime companies",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// List all subscriptions with filters
export const listSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      status,
      planId,
      planName,
      companyId,
      search = "",
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause
    const where = {};

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by planId or planName
    if (planId) {
      where.planId = planId;
    } else if (planName) {
      const plan = await prisma.subscriptionPlan.findFirst({
        where: { name: planName },
      });
      if (plan) {
        where.planId = plan.id;
      } else {
        // If plan not found, return empty result
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            currentPage: pageNum,
            totalPages: 0,
            totalCount: 0,
            pageSize: pageSizeNum,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
    }

    // Filter by companyId
    if (companyId) {
      where.companyId = parseInt(companyId);
    }

    // Search by company name/email/tin
    if (search) {
      where.company = {
        OR: [
          { companyName: { contains: search, mode: "insensitive" } },
          { companyEmail: { contains: search, mode: "insensitive" } },
          { companyTin: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Filter by date range (subscription createdAt)
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Get subscriptions with related data
    const [subscriptions, totalCount] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { createdAt: "desc" },
        include: {
          company: {
            select: {
              id: true,
              companyName: true,
              companyEmail: true,
              companyTin: true,
              hasLifetimeAccess: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              maxEmployees: true,
              features: true,
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        pageSize: pageSizeNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error listing subscriptions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list subscriptions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update subscription
export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate, trialEndDate, planId } = req.body;

    // Validate subscription ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID is required",
      });
    }

    // Get existing subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        company: {
          select: {
            id: true,
            companyName: true,
            hasLifetimeAccess: true,
          },
        },
      },
    });

    if (!existingSubscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Validate status enum if provided
    const validStatuses = ["TRIAL", "PENDING", "ACTIVE", "EXPIRED", "CANCELLED"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Build update data
    const updateData = {};

    if (status !== undefined) {
      updateData.status = status;
    }

    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null;
    }

    if (trialEndDate !== undefined) {
      updateData.trialEndDate = trialEndDate ? new Date(trialEndDate) : null;
    }

    if (planId !== undefined) {
      // Validate plan exists
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Plan not found",
        });
      }

      updateData.planId = planId;
    }

    // Validation logic based on status
    const finalStatus = status || existingSubscription.status;
    const finalStartDate = updateData.startDate !== undefined ? updateData.startDate : existingSubscription.startDate;
    const finalEndDate = updateData.endDate !== undefined ? updateData.endDate : existingSubscription.endDate;
    const finalTrialEndDate = updateData.trialEndDate !== undefined ? updateData.trialEndDate : existingSubscription.trialEndDate;

    // If setting to ACTIVE or CANCELLED, require endDate
    if ((finalStatus === "ACTIVE" || finalStatus === "CANCELLED") && !finalEndDate) {
      return res.status(400).json({
        success: false,
        message: "endDate is required when status is ACTIVE or CANCELLED",
      });
    }

    // If setting to TRIAL, require trialEndDate
    if (finalStatus === "TRIAL" && !finalTrialEndDate) {
      return res.status(400).json({
        success: false,
        message: "trialEndDate is required when status is TRIAL",
      });
    }

    // Validate trialEndDate is in the future if TRIAL
    if (finalStatus === "TRIAL" && finalTrialEndDate) {
      const now = new Date();
      if (new Date(finalTrialEndDate) <= now) {
        return res.status(400).json({
          success: false,
          message: "trialEndDate must be in the future for TRIAL status",
        });
      }
    }

    // Validate endDate > startDate if both are present
    if (finalStartDate && finalEndDate) {
      if (new Date(finalEndDate) <= new Date(finalStartDate)) {
        return res.status(400).json({
          success: false,
          message: "endDate must be after startDate",
        });
      }
    }

    // Update subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            companyEmail: true,
            companyTin: true,
            hasLifetimeAccess: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            maxEmployees: true,
            features: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: updatedSubscription,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};




// Get all payments with pagination
export const getPayments = async (req, res) => {
  try {
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Forbidden: Super admin access required",
      });
    }

    const {
      page = 1,
      pageSize = 10,
      search = "",
      dateFrom,
      dateTo,
      status,
      companyId,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause
    const where = {};

    // Search by company name, email, or modemPayReference
    if (search) {
      where.OR = [
        { modemPayReference: { contains: search, mode: "insensitive" } },
        { company: { companyName: { contains: search, mode: "insensitive" } } },
        { company: { companyEmail: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Filter by payment status
    if (status) {
      where.status = status;
    }

    // Filter by company
    if (companyId) {
      where.companyId = parseInt(companyId, 10);
    }

    // Get payments with related data
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { createdAt: "desc" },
        include: {
          company: {
            select: {
              id: true,
              companyName: true,
              companyEmail: true,
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / pageSizeNum);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        pageSize: pageSizeNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};


export const getPaymentDetail = async (req, res) => {
  try {
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Super admin access required",
      });
    }

    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Valid payment ID is required",
      });
    }

    // Fetch payment with related data
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            companyEmail: true,
            companyTin: true,
            companyAddress: true,
            hasLifetimeAccess: true,
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            trialEndDate: true,
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                maxEmployees: true,
                features: true,
              },
            },
          },
        },
      },
    });

    // Check if payment exists
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Return payment data
    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};