import prisma from "../config/prisma.config.js";

export const listCompanies = async (req, res) => {
  const id = req.user.id;

  // Validate user
  if (!id) {
    return res.status(401).json({
      success: false,
      message: "User not found",
    });
  }

  // Extract pagination parameters
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  // Validate pagination values
  if (page < 1 || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid pagination parameters. Page must be >= 1, pageSize must be between 1 and 100",
    });
  }

  // Extract search and filter parameters
  const search = req.query.search?.trim() || "";
  const dateFrom = req.query.dateFrom || "";
  const dateTo = req.query.dateTo || "";

  try {
    // Build where clause for filtering
    const whereClause = {};

    // Search across multiple fields (companyName, companyEmail, companyTin)
    if (search) {
      whereClause.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { companyEmail: { contains: search, mode: "insensitive" } },
        { companyTin: { contains: search, mode: "insensitive" } },
      ];
    }

    // Date filtering by createdAt
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = endDate;
      }
    }

    // Fetch companies with pagination and include HR relation
    const [companies, totalCount] = await Promise.all([
      prisma.company.findMany({
        where: whereClause,
        skip: skip,
        take: pageSize,
        orderBy: {
          createdAt: "desc", // Most recent first
        },
        include: {
          hr: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePic: true,
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              trialEndDate: true,
              createdAt: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
          _count: {
            select: {
              employees: true,
              departments: true,
              locations: true,
            },
          },
        },
      }),
      prisma.company.count({
        where: whereClause,
      }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Return response with pagination metadata
    return res.status(200).json({
      success: true,
      message: "Companies fetched successfully",
      data: companies,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        pageSize: pageSize,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Error fetching companies:", error);

    // Handle specific Prisma errors
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry found",
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong",
    });
  }
};

export const companyStats = async (req, res) => {
  const id = req.user.id;

  // Validate user
  if (!id) {
    return res.status(401).json({
      success: false,
      message: "User not found",
    });
  }

  try {
    // Fetch all statistics in parallel using Promise.all
    const [
      totalCompanies,
      companiesWithActiveSubscription,
      companiesWithTrialSubscription,
      companiesWithExpiredSubscription,
      companiesWithLifetimeAccess,
      companiesWithPendingSubscription,
    ] = await Promise.all([
      // Total companies count
      prisma.company.count(),

      // Companies with ACTIVE subscriptions
      prisma.company.count({
        where: {
          subscription: {
            status: "ACTIVE",
          },
        },
      }),

      // Companies with TRIAL subscriptions
      prisma.company.count({
        where: {
          subscription: {
            status: "TRIAL",
          },
        },
      }),

      // Companies with EXPIRED subscriptions
      prisma.company.count({
        where: {
          subscription: {
            status: "EXPIRED",
          },
        },
      }),

      // Companies with lifetime access
      prisma.company.count({
        where: {
          hasLifetimeAccess: true,
        },
      }),

      // Companies with PENDING subscriptions
      prisma.company.count({
        where: {
          subscription: {
            status: "PENDING",
          },
        },
      }),
    ]);

    // Return the statistics
    return res.status(200).json({
      success: true,
      message: "Company statistics fetched successfully",
      data: {
        totalCompanies,
        companiesWithActiveSubscription,
        companiesWithTrialSubscription,
        companiesWithExpiredSubscription,
        companiesWithLifetimeAccess,
        companiesWithPendingSubscription,
      },
    });
  } catch (error) {
    console.error("Error fetching company statistics:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
