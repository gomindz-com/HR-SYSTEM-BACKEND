import prisma from "../config/prisma.config.js";

// Get all companies with pagination
export const getCompanies = async (req, res) => {
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

// Get company statistics
export const getCompanyStats = async (req, res) => {
  try {
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Forbidden: Super admin access required",
      });
    }

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
    // Check if user has SUPER_ADMIN role
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Super admin access required",
      });
    }

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
    if (transformedSubscription) {
      const now = new Date();
      const endDate = new Date(transformedSubscription.endDate);

      // Calculate days remaining
      const timeDiff = endDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Check if it's a trial subscription
      const isTrial =
        transformedSubscription.planType === "TRIAL" ||
        transformedSubscription.subscriptionStatus === "TRIAL";

      trialInfo = {
        isTrial,
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        isExpired: daysRemaining <= 0,
        endDate: transformedSubscription.endDate,
      };
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
