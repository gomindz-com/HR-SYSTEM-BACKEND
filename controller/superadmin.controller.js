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
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Valid company ID is required',
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
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
        
        // Employees with limited fields for overview
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            departmentId: true,
            employeeStatus: true,
          },
          take: 10, // Limit for performance
          orderBy: { createdAt: 'desc' },
        },
        
        // Departments
        departments: {
          select: {
            id: true,
            departmentName: true,
            _count: {
              select: { employees: true },
            },
          },
        },
        
        // Locations
        locations: {
          select: {
            id: true,
            locationName: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        
        // Subscription info
        subscription: {
          select: {
            id: true,
            subscriptionStatus: true,
            startDate: true,
            endDate: true,
            planType: true,
          },
        },
        
        // Workday configuration
        WorkdayDaysConfig: {
          select: {
            id: true,
            dayOfWeek: true,
            isWorkday: true,
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
        message: 'Company not found',
      });
    }

    // Calculate trial days remaining
    let trialInfo = null;
    
    if (company.subscription) {
      const now = new Date();
      const endDate = new Date(company.subscription.endDate);
      
      // Calculate days remaining
      const timeDiff = endDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // Check if it's a trial subscription
      const isTrial = company.subscription.planType === 'TRIAL' || 
                      company.subscription.subscriptionStatus === 'TRIAL';
      
      trialInfo = {
        isTrial,
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        isExpired: daysRemaining <= 0,
        endDate: company.subscription.endDate,
      };
    }

    // Return company data with trial info
    return res.status(200).json({
      success: true,
      data: {
        ...company,
        trialInfo,
      },
    });

  } catch (error) {
    console.error('Error fetching company details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch company details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
