import prisma from "../config/prisma.config.js";
import { PayrollCalculator } from "../lib/payrollCalculation.js";

export const generateAllEmployeesPayroll = async (req, res) => {
  const companyId = req.user.companyId;
  const { periodStart, periodEnd } = req.body;

  if (!companyId) {
    return res.status(400).json({
      message: "Company ID is required",
    });
  }

  if (!periodStart || !periodEnd) {
    return res.status(400).json({
      message: "Period start and end are required",
    });
  }

  try {
    const employees = await prisma.employee.findMany({
      where: { companyId, deleted: false },
      include: {
        benefits: { where: { isActive: true } },
        payrollProfile: true,
        attendances: { where: { date: { gte: periodStart, lte: periodEnd } } },
      },
    });

    const payrollRecords = [];
    const failedEmployees = [];

    // process each employee
    for (const employee of employees) {
      try {
        // calculate payroll
        const calculation =
          PayrollCalculator.calculateEmployeePayroll(employee);

        // save to database
        const payroll = await prisma.payroll.create({
          data: {
            employeeId: employee.id,
            companyId,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            ...calculation,
            status: "PENDING",
          },
        });

        payrollRecords.push(payroll);
      } catch (error) {
        failedEmployees.push({
          employeeId: employee.id,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Payroll generated for ${payrollRecords.length} employees`,
      data: {
        processed: payrollRecords.length,
        failed: failedEmployees.length,
        payrollRecords,
        failedEmployees,
      },
    });
  } catch (error) {
    console.error("Error in generateAllEmployeesPayroll controller:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getCompanyPayrolls = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // Validation
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    // Extract filters from query
    const { employeeId, status, createdAt, period } = req.query;

    // Build where clause
    const where = { companyId };

    // Employee filter
    const parsedEmployeeId = parseInt(employeeId);
    if (employeeId && !isNaN(parsedEmployeeId)) {
      where.employeeId = parsedEmployeeId;
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Date filter by specific day
    if (createdAt) {
      const filterDate = new Date(createdAt);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      where.createdAt = {
        gte: filterDate,
        lt: nextDay,
      };
    }

    // Period filter (e.g., "2024-01" for January 2024)
    if (period) {
      const [year, month] = period.split("-");
      if (year && month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        where.periodStart = { gte: startDate };
        where.periodEnd = { lte: endDate };
      }
    }

    // Fetch data with summary statistics
    const [payrollRecords, total, summary] = await Promise.all([
      prisma.payroll.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              profilePic: true,
              email: true,
              position: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.payroll.count({ where }),
      prisma.payroll.aggregate({
        where,
        _sum: {
          grossPay: true,
          netPay: true,
          totalDeductions: true,
          benefitsCost: true,
          incomeTax: true,
          socialSecurity: true,
          attendancePenalties: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Calculate additional statistics
    const statusCounts = await prisma.payroll.groupBy({
      by: ["status"],
      where,
      _count: {
        status: true,
      },
    });

    const statusSummary = statusCounts.reduce(
      (acc, item) => {
        acc[item.status.toLowerCase()] = item._count.status;
        return acc;
      },
      { pending: 0, processed: 0, paid: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        payrolls: payrollRecords,
        summary: {
          totalEmployees: summary._count.id || 0,
          totalGrossPay: summary._sum.grossPay || 0,
          totalNetPay: summary._sum.netPay || 0,
          totalDeductions: summary._sum.totalDeductions || 0,
          totalBenefits: summary._sum.benefitsCost || 0,
          totalTaxes: summary._sum.incomeTax || 0,
          totalSSN: summary._sum.socialSecurity || 0,
          totalPenalties: summary._sum.attendancePenalties || 0,
        },
        statusSummary,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("Error in getCompanyPayrolls controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const addEmployeeBenefit = async (req, res) => {
  try {
    const { employeeId } = req.params; // From URL params
    const { benefitType, amount } = req.body;
    const { companyId } = req.user;

    // Validate employee exists and belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: parseInt(employeeId), companyId, deleted: false },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if benefit already exists
    const existingBenefit = await prisma.employeeBenefit.findFirst({
      where: { employeeId: parseInt(employeeId), benefitType, isActive: true },
    });

    if (existingBenefit) {
      return res.status(400).json({
        success: false,
        message: "Employee already has this benefit type",
      });
    }

    // Create benefit
    const benefit = await prisma.employeeBenefit.create({
      data: {
        employeeId: parseInt(employeeId),
        companyId,
        benefitType,
        amount: parseFloat(amount),
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Benefit added successfully",
      data: benefit,
    });
  } catch (error) {
    console.error("Error adding employee benefit:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const updateEmployeeBenefit = async (req, res) => {
  try {
    const { employeeId, benefitId } = req.params; // Both from URL params
    const { amount, isActive } = req.body;
    const { companyId } = req.user;

    const benefit = await prisma.employeeBenefit.update({
      where: {
        id: benefitId,
        employeeId: parseInt(employeeId), // Ensure benefit belongs to this employee
        companyId, // Ensure user can only update their company's benefits
      },
      data: {
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      message: "Benefit updated successfully",
      data: benefit,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Benefit not found",
      });
    }

    console.error("Error updating employee benefit:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const removeEmployeeBenefit = async (req, res) => {
    try {
      const { employeeId, benefitId } = req.params;  // Both from URL params
      const { companyId } = req.user;
  
      const benefit = await prisma.employeeBenefit.update({
        where: {
          id: benefitId,
          employeeId: parseInt(employeeId),  // Ensure benefit belongs to this employee
          companyId
        },
        data: {
          isActive: false
        }
      });
  
      res.json({
        success: true,
        message: "Benefit removed successfully",
        data: benefit
      });
  
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: "Benefit not found"
        });
      }
  
      console.error("Error removing employee benefit:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  };
  export const updatePayrollSetting = async (req, res) => {
    try {
      const { employeeId } = req.params;  // From URL params
      const { taxBracket, socialSecurityRate, customTaxRate } = req.body;
      const { companyId } = req.user;
  
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: parseInt(employeeId), companyId, deleted: false }
      });
  
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found"
        });
      }
  
      // Validate rates
      if (socialSecurityRate !== undefined && (socialSecurityRate < 0 || socialSecurityRate > 1)) {
        return res.status(400).json({
          success: false,
          message: "Social security rate must be between 0 and 1"
        });
      }
  
      if (customTaxRate !== undefined && (customTaxRate < 0 || customTaxRate > 1)) {
        return res.status(400).json({
          success: false,
          message: "Custom tax rate must be between 0 and 1"
        });
      }
  
      // Update or create payroll profile
      const profile = await prisma.employeePayrollProfile.upsert({
        where: { employeeId: parseInt(employeeId) },
        update: {
          ...(taxBracket !== undefined && { taxBracket }),
          ...(socialSecurityRate !== undefined && { socialSecurityRate }),
          ...(customTaxRate !== undefined && { customTaxRate }),
        },

        create: {
          employeeId: parseInt(employeeId),
          taxBracket: taxBracket || null,
          socialSecurityRate: socialSecurityRate || 0,
          customTaxRate: customTaxRate || null,
        }
      });
  
      res.json({
        success: true,
        message: "Payroll settings updated successfully",
        data: profile
      });
  
    } catch (error) {
      console.error("Error updating payroll settings:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  };