import prisma from "../config/prisma.config.js";
import { getDepartmentFilter } from "../utils/access-control.utils.js";
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
    if (pageNum < 1 || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 10000",
      });
    }

    // Start building where clause
    let whereClause = {
      companyId: companyId,
      ...getDepartmentFilter(req.user),
    };

    // Text search across multiple fields (matches frontend search input)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchConditions = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { position: { contains: searchTerm, mode: "insensitive" } },
      ];

      // Check if search term matches any valid role values with fuzzy matching
      const validRoles = [
        "EMPLOYEE",
        "DIRECTOR",
        "HR",
        "CTO",
        "CEO",
        "MANAGEMENT",
      ];

      const matchingRoles = validRoles.filter((role) => {
        const roleLower = role.toLowerCase();
        const searchLower = searchTerm.toLowerCase();

        // Direct match
        if (roleLower.includes(searchLower)) return true;

        // Common variations for roles
        if (searchLower.includes("hr") && roleLower === "hr") return true;
        if (searchLower.includes("ceo") && roleLower === "ceo") return true;
        if (searchLower.includes("cto") && roleLower === "cto") return true;
        if (searchLower.includes("director") && roleLower === "director")
          return true;
        if (searchLower.includes("management") && roleLower === "management")
          return true;
        if (searchLower.includes("employee") && roleLower === "employee")
          return true;

        return false;
      });

      if (matchingRoles.length > 0) {
        searchConditions.push({ role: { in: matchingRoles } });
      }

      // Check if search term matches any valid employment type values with fuzzy matching
      const validEmploymentTypes = ["FULL_TIME", "PART_TIME", "CONTRACTOR"];
      const matchingEmploymentTypes = validEmploymentTypes.filter((type) => {
        const typeLower = type.toLowerCase();
        const searchLower = searchTerm.toLowerCase();

        // Direct match
        if (typeLower.includes(searchLower)) return true;

        // Common variations for employment types
        if (searchLower.includes("full") && typeLower === "full_time")
          return true;
        if (searchLower.includes("part") && typeLower === "part_time")
          return true;
        if (searchLower.includes("contract") && typeLower === "contractor")
          return true;
        if (
          searchLower.includes("time") &&
          (typeLower === "full_time" || typeLower === "part_time")
        )
          return true;

        return false;
      });

      if (matchingEmploymentTypes.length > 0) {
        searchConditions.push({
          employmentType: { in: matchingEmploymentTypes },
        });
      }

      whereClause.OR = searchConditions;
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
export const leaveReport = async (req, res) => {
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
      search, // Search term for employee name
      department, // Filter by department ID
      leaveType, // Filter by leave type
      status, // Filter by leave status
      dateFrom, // Filter by leave start date
      dateTo, // Filter by leave end date
      timePeriod, // Predefined time periods: day, week, month, quarter, year
      page = 1, // Pagination
      limit = 10, // Items per page
    } = req.query;

    // Convert to proper types with validation
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Validate pagination values
    if (pageNum < 1 || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 10000",
      });
    }

    // Start building where clause
    let whereClause = {
      companyId: companyId,
      ...getDepartmentFilter(req.user),
    };

    // Text search across employee name
    if (search && search.trim()) {
      whereClause.employee = {
        name: { contains: search.trim(), mode: "insensitive" },
      };
    }

    // Exact match filters
    if (department) {
      const deptId = parseInt(department);
      if (!isNaN(deptId)) {
        whereClause.employee = {
          ...whereClause.employee,
          departmentId: deptId,
        };
      }
    }

    if (
      leaveType &&
      ["STUDY", "MATERNITY", "SICK", "VACATION", "ANNUAL", "PERSONAL"].includes(
        leaveType
      )
    ) {
      whereClause.leaveType = leaveType;
    }

    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      whereClause.status = status;
    }

    // Date range filter for leave start date
    if (dateFrom || dateTo) {
      whereClause.startDate = {};

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (!isNaN(fromDate.getTime())) {
          whereClause.startDate.gte = fromDate;
        }
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        if (!isNaN(toDate.getTime())) {
          // Set to end of day for inclusive range
          toDate.setHours(23, 59, 59, 999);
          whereClause.startDate.lte = toDate;
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
        whereClause.startDate = {
          gte: startDate,
          lte: endDate,
        };
      }
    }

    // Build the main query with proper relations
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            department: {
              select: {
                name: true,
              },
            },
          },
        },
        approver: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startDate: "desc", // Most recent first
      },
      skip: skip,
      take: limitNum,
    });

    // Get total count for pagination
    const totalCount = await prisma.leaveRequest.count({
      where: whereClause,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Format response to match frontend expectations
    const formattedLeaveRequests = leaveRequests.map((leave) => ({
      id: leave.id,
      employeeName: leave.employee.name,
      department: leave.employee.department?.name || "Unknown",
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      status: leave.status,
      approverName: leave.approver?.name || "Not Assigned",
      comments: leave.comments || "",
      createdAt: leave.createdAt,
    }));

    // Send response
    res.status(200).json({
      success: true,
      data: formattedLeaveRequests,
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
    console.error("Error in leaveReport controller:", error);

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
export const attendanceReport = async (req, res) => {
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
      search, // Search term for employee name
      department, // Filter by department ID
      status, // Filter by attendance status
      dateFrom, // Filter by attendance date
      dateTo, // Filter by attendance date
      timePeriod, // Predefined time periods: day, week, month, quarter, year
      page = 1, // Pagination
      limit = 10, // Items per page
    } = req.query;

    // Convert to proper types with validation
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Validate pagination values
    if (pageNum < 1 || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 10000",
      });
    }

    // Start building where clause
    let whereClause = {
        companyId: companyId,
      ...getDepartmentFilter(req.user),
    };

    // Text search across employee name
    if (search && search.trim()) {
      whereClause.employee = {
        name: { contains: search.trim(), mode: "insensitive" },
      };
    }

    // Exact match filters
    if (department) {
      const deptId = parseInt(department);
      if (!isNaN(deptId)) {
        whereClause.employee = {
          ...whereClause.employee,
          departmentId: deptId,
        };
      }
    }

    if (status && ["ON_TIME", "LATE", "ABSENT"].includes(status)) {
      whereClause.status = status;
    }

    // Date range filter for attendance date
    if (dateFrom || dateTo) {
      whereClause.date = {};

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (!isNaN(fromDate.getTime())) {
          whereClause.date.gte = fromDate;
        }
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        if (!isNaN(toDate.getTime())) {
          // Set to end of day for inclusive range
          toDate.setHours(23, 59, 59, 999);
          whereClause.date.lte = toDate;
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
        whereClause.date = {
          gte: startDate,
          lte: endDate,
        };
      }
    }

    // Build the main query with proper relations
    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "desc", // Most recent first
      },
      skip: skip,
      take: limitNum,
    });

    // Get total count for pagination
    const totalCount = await prisma.attendance.count({
      where: whereClause,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Format response to match frontend expectations
    const formattedAttendances = attendances.map((att) => ({
      id: att.id,
      employeeName: att.employee.name,
      department: att.employee.department?.name || "Unknown",
      date: att.date,
      timeIn: att.timeIn
        ? att.timeIn.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
      timeOut: att.timeOut
        ? att.timeOut.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
      status: att.status,
      createdAt: att.createdAt,
    }));

    // Send response
    res.status(200).json({
      success: true,
      data: formattedAttendances,
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
    console.error("Error in attendanceReport controller:", error);

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
export const payrollReports = async (req, res) => {
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
      search, // Search term for employee name/position
      employeeId, // Filter by specific employee
      status, // Filter by payroll status (PENDING, PROCESSED, PAID)
      periodStart, // Filter by payroll period start
      periodEnd, // Filter by payroll period end
      timePeriod, // Predefined time periods: month, quarter, year
      page = 1, // Pagination
      limit = 10, // Items per page
      reportType = "summary", // summary, detailed, benefits, taxes
    } = req.query;

    // Convert to proper types with validation
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Validate pagination values
    if (pageNum < 1 || limitNum < 1 || limitNum > 10000) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 10000",
      });
    }

    // Start building where clause
    let whereClause = {
      companyId: companyId, ...getDepartmentFilter
    };

    // Employee filter
    if (employeeId) {
      const empId = parseInt(employeeId);
      if (!isNaN(empId)) {
        whereClause.employeeId = empId;
      }
    }

    // Status filter
    if (status && ["DRAFT", "FINALIZED", "PAID"].includes(status)) {
      whereClause.status = status;
    }

    // Search filter for employee name
    if (search && search.trim()) {
      whereClause.employee = {
        ...whereClause.employee,
        name: { contains: search.trim(), mode: "insensitive" },
      };
    }

    // Period filters - filter by creation date (when payroll was created)
    if (periodStart && periodEnd) {
      whereClause.AND = whereClause.AND || [];
      const fromDate = new Date(periodStart);
      const toDate = new Date(periodEnd);
      toDate.setHours(23, 59, 59, 999);
      whereClause.AND.push({
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      });
    } else if (timePeriod) {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      switch (timePeriod.toLowerCase()) {
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
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        case "last3months":
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
      }

      whereClause.AND = whereClause.AND || [];
      endDate.setHours(23, 59, 59, 999);
      whereClause.AND.push({
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      });
    }

    // Handle different report types
    switch (reportType) {
      case "detailed":
        return await generateDetailedPayrollReport(
          req,
          res,
          whereClause,
          pageNum,
          limitNum,
          skip,
          search
        );
      case "benefits":
        return await generateBenefitsReport(
          req,
          res,
          whereClause,
          pageNum,
          limitNum,
          skip
        );
      case "taxes":
        return await generateTaxReport(
          req,
          res,
          whereClause,
          pageNum,
          limitNum,
          skip
        );
      default:
        return await generateDetailedPayrollReport(
          req,
          res,
          whereClause,
          pageNum,
          limitNum,
          skip,
          search
        );
    }
  } catch (error) {
    console.error("Error in payrollReports controller:", error);

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

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while generating payroll report",
    });
  }
};
// Helper function for payroll summary report
const generatePayrollSummaryReport = async (
  req,
  res,
  whereClause,
  pageNum,
  limitNum,
  skip
) => {
  try {
    const payrolls = await prisma.payroll.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            name: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: skip,
      take: limitNum,
    });

    const totalCount = await prisma.payroll.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedPayrolls = payrolls.map((payroll) => ({
      id: payroll.id,
      employeeName: payroll.employee.name,
      department: payroll.employee.department?.name || "Unknown",
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      baseSalary: payroll.baseSalary,
      bonuses: payroll.bonuses,
      grossPay: payroll.grossPay,
      totalDeductions: payroll.totalDeductions,
      netPay: payroll.netPay,
      status: payroll.status,
      createdAt: payroll.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedPayrolls,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error in generatePayrollSummaryReport:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Helper function for detailed payroll report
const generateDetailedPayrollReport = async (
  req,
  res,
  whereClause,
  pageNum,
  limitNum,
  skip,
  search
) => {
  try {
    // Add search filter if provided
    if (search && search.trim()) {
      whereClause.employee = {
        ...whereClause.employee,
        name: { contains: search.trim(), mode: "insensitive" },
      };
    }

    const payrolls = await prisma.payroll.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            name: true,
            email: true,
            position: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: skip,
      take: limitNum,
    });

    const totalCount = await prisma.payroll.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedPayrolls = payrolls.map((payroll) => ({
      id: payroll.id,
      employeeName: payroll.employee.name,
      employeeEmail: payroll.employee.email,
      position: payroll.employee.position,
      department: payroll.employee.department?.name || "Unknown",
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      baseSalary: payroll.baseSalary,
      bonuses: payroll.bonuses,
      benefitsCost: payroll.benefitsCost,
      incomeTax: payroll.incomeTax,
      socialSecurity: payroll.socialSecurity,
      attendancePenalties: payroll.attendancePenalties,
      grossPay: payroll.grossPay,
      totalDeductions: payroll.totalDeductions,
      netPay: payroll.netPay,
      status: payroll.status,
      notes: payroll.notes,
      createdAt: payroll.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedPayrolls,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error in generateDetailedPayrollReport:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Helper function for benefits report
const generateBenefitsReport = async (
  req,
  res,
  whereClause,
  pageNum,
  limitNum,
  skip
) => {
  try {
    const payrolls = await prisma.payroll.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            name: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: skip,
      take: limitNum,
    });

    const totalCount = await prisma.payroll.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedPayrolls = payrolls.map((payroll) => ({
      id: payroll.id,
      employeeName: payroll.employee.name,
      department: payroll.employee.department?.name || "Unknown",
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      baseSalary: payroll.baseSalary,
      benefitsCost: payroll.benefitsCost,
      grossPay: payroll.grossPay,
      status: payroll.status,
      createdAt: payroll.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedPayrolls,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error in generateBenefitsReport:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Helper function for tax report
const generateTaxReport = async (
  req,
  res,
  whereClause,
  pageNum,
  limitNum,
  skip
) => {
  try {
    const payrolls = await prisma.payroll.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            name: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: skip,
      take: limitNum,
    });

    const totalCount = await prisma.payroll.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedPayrolls = payrolls.map((payroll) => ({
      id: payroll.id,
      employeeName: payroll.employee.name,
      department: payroll.employee.department?.name || "Unknown",
      periodStart: payroll.periodStart,
      periodEnd: payroll.periodEnd,
      grossPay: payroll.grossPay,
      incomeTax: payroll.incomeTax,
      socialSecurity: payroll.socialSecurity,
      totalTaxes: payroll.incomeTax + payroll.socialSecurity,
      netPay: payroll.netPay,
      status: payroll.status,
      createdAt: payroll.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedPayrolls,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error in generateTaxReport:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const reportStats = async (req, res) => {
  try {
    // Extract and validate user context
    if (!req.user?.companyId) {
      return res.status(401).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const { companyId } = req.user;

    // Extract query parameters for date filtering
    const { dateFrom, dateTo, timePeriod } = req.query;

    // Build date filter for all queries
    let dateFilter = {};

    // Priority: Custom date range takes precedence over time period
    if (dateFrom || dateTo) {
      if (dateFrom) {
        // Set start of day for dateFrom
        const startDate = new Date(dateFrom);
        startDate.setHours(0, 0, 0, 0);
        dateFilter.gte = startDate;
      }
      if (dateTo) {
        // Set end of day for dateTo to include the full day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.lte = endDate;
      }
    } else if (timePeriod && timePeriod !== "all") {
      const now = new Date();
      let startDate, endDate;

      switch (timePeriod) {
        case "day":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1
          );
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = new Date(now);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now);
          break;
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
          endDate = new Date(now);
      }

      if (startDate) {
        dateFilter.gte = startDate;
      }
      if (endDate) {
        dateFilter.lte = endDate;
      }
    }
    // If both are "all" or undefined, no date filtering is applied

    // Get total employees count (always total company employees, not filtered by attendance)
    const totalEmployees = await prisma.employee.count({
      where: { companyId },
    });

    // Get total departments count
    const totalDepartments = await prisma.department.count({
      where: { companyId },
    });

    // Get attendance statistics
    const attendanceStats = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        companyId,
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      _count: {
        status: true,
      },
    });

    // Get leave request statistics
    let leaveWhereClause = { companyId };

    if (Object.keys(dateFilter).length > 0) {
      // For leave requests, check if the leave period overlaps with the filter period
      if (dateFilter.gte && dateFilter.lte) {
        leaveWhereClause = {
          ...leaveWhereClause,
          AND: [
            { startDate: { lte: dateFilter.lte } },
            { endDate: { gte: dateFilter.gte } },
          ],
        };
      } else if (dateFilter.gte) {
        leaveWhereClause = {
          ...leaveWhereClause,
          endDate: { gte: dateFilter.gte },
        };
      } else if (dateFilter.lte) {
        leaveWhereClause = {
          ...leaveWhereClause,
          startDate: { lte: dateFilter.lte },
        };
      }
    }

    const leaveStats = await prisma.leaveRequest.groupBy({
      by: ["status"],
      where: leaveWhereClause,
      _count: {
        status: true,
      },
    });

    // Get monthly attendance trend for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyAttendance = await prisma.attendance.groupBy({
      by: ["date"],
      where: {
        companyId,
        date: {
          gte: sixMonthsAgo,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    // Get monthly leave trend for the last 6 months
    const monthlyLeave = await prisma.leaveRequest.groupBy({
      by: ["startDate"],
      where: {
        companyId,
        startDate: {
          gte: sixMonthsAgo,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        startDate: "asc",
      },
    });

    // Process attendance stats
    const attendanceCounts = {
      ON_TIME: 0,
      ABSENT: 0,
      LATE: 0,
      EARLY: 0,
    };

    attendanceStats.forEach((stat) => {
      attendanceCounts[stat.status] = stat._count.status;
    });

    // Process leave stats
    const leaveCounts = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
    };

    leaveStats.forEach((stat) => {
      leaveCounts[stat.status] = stat._count.status;
    });

    // Calculate attendance rate
    const totalPresent =
      attendanceCounts.ON_TIME + attendanceCounts.LATE + attendanceCounts.EARLY;
    const totalAbsent = attendanceCounts.ABSENT;
    const totalRecords = totalPresent + totalAbsent;

    let attendanceRate;
    if (Object.keys(dateFilter).length > 0) {
      // If filtering by date, calculate rate based on filtered data
      if (totalRecords > 0) {
        attendanceRate = Math.round((totalPresent / totalRecords) * 100);
      } else {
        // If no records in filtered period, attendance rate is 0%
        attendanceRate = 0;
      }
    } else {
      // If no date filter, calculate overall company attendance rate
      // This should be based on total employees, not just attendance records
      if (totalEmployees > 0) {
        // For overall company rate, we need to count unique employees who have attendance records
        const employeesWithAttendance = await prisma.attendance.groupBy({
          by: ["employeeId"],
          where: {
            companyId,
            status: { in: ["ON_TIME", "LATE", "EARLY"] },
          },
          _count: {
            employeeId: true,
          },
        });

        const totalPresentEmployees = employeesWithAttendance.length;
        attendanceRate = Math.round(
          (totalPresentEmployees / totalEmployees) * 100
        );
      } else {
        attendanceRate = 0;
      }
    }

    // Process monthly trends
    const processMonthlyData = (data, dateField) => {
      const monthlyMap = new Map();

      // Initialize last 6 months with 0
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(monthKey, 0);
      }

      // Fill in actual data
      data.forEach((item) => {
        const date = new Date(item[dateField]);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, item._count.id);
        }
      });

      return Array.from(monthlyMap.values());
    };

    const attendanceTrend = processMonthlyData(monthlyAttendance, "date");
    const leaveTrend = processMonthlyData(monthlyLeave, "startDate");

    // Get department distribution
    const departmentDistribution = await prisma.employee.groupBy({
      by: ["departmentId"],
      where: { companyId },
      _count: {
        id: true,
      },
    });

    // Get department names for the distribution
    const departmentNames = await prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });

    const departmentMap = new Map(
      departmentNames.map((dept) => [dept.id, dept.name])
    );

    const departmentData = departmentDistribution.map((dept) => ({
      name: departmentMap.get(dept.departmentId) || "Unknown",
      value: dept._count.id,
    }));

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalEmployees,
          totalDepartments,
          attendanceRate,
          totalAttendance: totalRecords,
        },
        attendance: {
          present: attendanceCounts.ON_TIME,
          absent: attendanceCounts.ABSENT,
          late: attendanceCounts.LATE,
          early: attendanceCounts.EARLY,
        },
        leave: {
          pending: leaveCounts.PENDING,
          approved: leaveCounts.APPROVED,
          rejected: leaveCounts.REJECTED,
        },
        trends: {
          attendance: attendanceTrend,
          leave: leaveTrend,
        },
        departmentDistribution: departmentData,
      },
    });
  } catch (error) {
    console.error("Error in reportStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
