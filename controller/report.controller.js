import prisma from "../config/prisma.config.js";

export const employeeReport = async (req, res) => {
  try {
    // Extract and validate user context
    if (!req.user?.companyId) {
      return res.status(401).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const { companyId } = req.user;

    // Extract query parameters
    const {
      search, // Search term for name/position/role/employmentType
      department, // Filter by department ID
      status, // Filter by employee status
      dateFrom, // Filter by creation date
      dateTo, // Filter by creation date
      timePeriod, // Predefined time periods: day, week, month, quarter, year
      page = 1, // Pagination
      limit = 10, // Items per page
    } = req.query;

    // Convert to proper types with validation
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Validate pagination values
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100",
      });
    }

    // Start building where clause
    let whereClause = {
      companyId: companyId, // Always filter by company for security
    };

    // Text search across multiple fields (matches frontend search input)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { position: { contains: searchTerm, mode: "insensitive" } },
        { role: { contains: searchTerm, mode: "insensitive" } },
        { employmentType: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    // Exact match filters

    if (department) {
      const deptId = parseInt(department);
      if (!isNaN(deptId)) {
        whereClause.departmentId = deptId;
      }
    }

    if (status && ["ACTIVE", "INACTIVE", "ON_LEAVE"].includes(status)) {
      whereClause.status = status;
    }

    // Date range filter for createdAt
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (!isNaN(fromDate.getTime())) {
          whereClause.createdAt.gte = fromDate;
        }
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        if (!isNaN(toDate.getTime())) {
          // Set to end of day for inclusive range
          toDate.setHours(23, 59, 59, 999);
          whereClause.createdAt.lte = toDate;
        }
      }
    }

    // Predefined time period filters (overrides dateFrom/dateTo if both are provided)
    if (timePeriod && !dateFrom && !dateTo) {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      switch (timePeriod) {
        case "day":
          // Today
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          break;

        case "week":
          // This week (Sunday to Saturday)
          const dayOfWeek = startDate.getDay();
          startDate.setDate(startDate.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(endDate.getDate() + (6 - dayOfWeek));
          endDate.setHours(23, 59, 59, 999);
          break;

        case "month":
          // This month
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setMonth(endDate.getMonth() + 1);
          endDate.setDate(0);
          endDate.setHours(23, 59, 59, 999);
          break;

        case "quarter":
          // This quarter
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate.setMonth(currentQuarter * 3);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setMonth((currentQuarter + 1) * 3);
          endDate.setDate(0);
          endDate.setHours(23, 59, 59, 999);
          break;

        case "year":
          // This year
          startDate.setMonth(0, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setMonth(11, 31);
          endDate.setHours(23, 59, 59, 999);
          break;

        default:
          // Invalid time period, ignore
          break;
      }

      // Only apply if we have valid dates
      if (
        startDate.getTime() !== now.getTime() ||
        endDate.getTime() !== now.getTime()
      ) {
        whereClause.createdAt = {
          gte: startDate,
          lte: endDate,
        };
      }
    }

    // Build the main query with proper relations
    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Most recent first
      },
      skip: skip,
      take: limitNum,
    });

    // Get total count for pagination
    const totalCount = await prisma.employee.count({
      where: whereClause,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Format response to match frontend expectations
    const formattedEmployees = employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      department: emp.department?.name || "Unknown",
      position: emp.position || "N/A",
      role: emp.role,
      status: emp.status,
      employmentType: emp.employmentType,
      salary: emp.salary || 0,
      createdAt: emp.createdAt,
    }));

    // Send response
    res.status(200).json({
      success: true,
      data: formattedEmployees,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error in employeeReport controller:", error);

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

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong",
    });
  }
};
