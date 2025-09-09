import prisma from "../config/prisma.config.js";
import { PayrollCalculator } from "../lib/payrollCalculation.js";

// ================================
// BENEFITS AND PAYROLL SETTING
// ================================
export const getEmployeeBenefits = async (req, res) => {
  try {
    const { employeeId } = req.params;
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

    // Fetch employee benefits
    const benefits = await prisma.employeeBenefit.findMany({
      where: {
        employeeId: parseInt(employeeId),
        companyId,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: benefits,
    });
  } catch (error) {
    console.error("Error fetching employee benefits:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
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

    // Check if benefit already exists (active or inactive)
    const existingBenefit = await prisma.employeeBenefit.findFirst({
      where: { employeeId: parseInt(employeeId), benefitType, companyId },
    });

    if (existingBenefit) {
      if (existingBenefit.isActive) {
        return res.status(400).json({
          success: false,
          message: "Employee already has an active benefit of this type",
        });
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Employee already has this benefit type. Please activate the existing one instead of creating a new one.",
        });
      }
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
export const toggleEmployeeBenefit = async (req, res) => {
  try {
    const { employeeId, benefitId } = req.params; // Both from URL params
    const { isActive } = req.body;
    const { companyId } = req.user;

    // Validate isActive is a boolean
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    if (isActive) {
      const currentBenefit = await prisma.employeeBenefit.findUnique({
        where: { id: benefitId },
      });

      if (currentBenefit) {
        const existingActiveBenefit = await prisma.employeeBenefit.findFirst({
          where: {
            employeeId: parseInt(employeeId),
            companyId,
            benefitType: currentBenefit.benefitType,
            isActive: true,
            id: { not: benefitId }, // Exclude current benefit
          },
        });

        if (existingActiveBenefit) {
          return res.status(400).json({
            success: false,
            message: "Employee already has an active benefit of this type",
          });
        }
      }
    }

    const benefit = await prisma.employeeBenefit.update({
      where: {
        id: benefitId,
        employeeId: parseInt(employeeId), // Ensure benefit belongs to this employee
        companyId,
      },
      data: {
        isActive,
      },
    });

    res.json({
      success: true,
      message: `Benefit ${isActive ? "activated" : "deactivated"} successfully`,
      data: benefit,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Benefit not found",
      });
    }

    console.error("Error toggling employee benefit:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const getEmployeePayrollSettings = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { companyId } = req.user;

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: parseInt(employeeId), companyId, deleted: false },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Fetch payroll profile or return defaults
    let profile = await prisma.employeePayrollProfile.findUnique({
      where: { employeeId: parseInt(employeeId) },
    });

    // If no profile exists, return default values
    if (!profile) {
      profile = {
        id: null,
        employeeId: parseInt(employeeId),
        taxBracket: null,
        socialSecurityRate: 0,
        customTaxRate: 0, // This ensures payroll calculation works even without settings
        createdAt: null,
        updatedAt: null,
      };
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error fetching payroll settings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updatePayrollSetting = async (req, res) => {
  try {
    const { employeeId } = req.params; // From URL params
    const { taxBracket, socialSecurityRate, customTaxRate } = req.body;
    const { companyId } = req.user;

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: { id: parseInt(employeeId), companyId, deleted: false },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Validate rates
    if (
      socialSecurityRate !== undefined &&
      (socialSecurityRate < 0 || socialSecurityRate > 1)
    ) {
      return res.status(400).json({
        success: false,
        message: "Social security rate must be between 0 and 1",
      });
    }

    if (
      customTaxRate !== undefined &&
      (customTaxRate < 0 || customTaxRate > 1)
    ) {
      return res.status(400).json({
        success: false,
        message: "Custom tax rate must be between 0 and 1",
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
      },
    });

    res.json({
      success: true,
      message: "Payroll settings updated successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error updating payroll settings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================
// BULK OPERATIONS ENDPOINTS
// ============================================

export const bulkAssignBenefits = async (req, res) => {
  try {
    const { employeeIds, benefitType, amount } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee IDs array is required and must not be empty",
      });
    }

    if (!benefitType || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Benefit type and valid amount are required",
      });
    }

    const results = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Validate employee exists and belongs to company
        const employee = await prisma.employee.findFirst({
          where: { id: parseInt(employeeId), companyId, deleted: false },
        });

        if (!employee) {
          errors.push({ employeeId, error: "Employee not found" });
          continue;
        }

        // Check if benefit already exists
        const existingBenefit = await prisma.employeeBenefit.findFirst({
          where: { employeeId: parseInt(employeeId), benefitType, companyId },
        });

        if (existingBenefit) {
          if (existingBenefit.isActive) {
            errors.push({
              employeeId,
              error: "Employee already has an active benefit of this type",
            });
          } else {
            errors.push({
              employeeId,
              error:
                "Employee already has this benefit type. Please activate the existing one instead.",
            });
          }
          continue;
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

        results.push({ employeeId, benefit, status: "success" });
      } catch (error) {
        console.error(
          `Error assigning benefit to employee ${employeeId}:`,
          error
        );
        errors.push({ employeeId, error: "Failed to assign benefit" });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk benefit assignment completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: employeeIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk assign benefits:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const bulkToggleBenefits = async (req, res) => {
  try {
    const { employeeIds, benefitType, isActive } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee IDs array is required and must not be empty",
      });
    }

    if (!benefitType || typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Benefit type and isActive boolean are required",
      });
    }

    const results = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Validate employee exists and belongs to company
        const employee = await prisma.employee.findFirst({
          where: { id: parseInt(employeeId), companyId, deleted: false },
        });

        if (!employee) {
          errors.push({ employeeId, error: "Employee not found" });
          continue;
        }

        // Find existing benefit
        const existingBenefit = await prisma.employeeBenefit.findFirst({
          where: { employeeId: parseInt(employeeId), benefitType, companyId },
        });

        if (!existingBenefit) {
          errors.push({
            employeeId,
            error: "Employee does not have this benefit type",
          });
          continue;
        }

        // If activating, check if there's already an active benefit of the same type
        if (isActive) {
          const activeConflict = await prisma.employeeBenefit.findFirst({
            where: {
              employeeId: parseInt(employeeId),
              companyId,
              benefitType,
              isActive: true,
              id: { not: existingBenefit.id },
            },
          });

          if (activeConflict) {
            errors.push({
              employeeId,
              error: "Employee already has an active benefit of this type",
            });
            continue;
          }
        }

        // Update benefit status
        const updatedBenefit = await prisma.employeeBenefit.update({
          where: { id: existingBenefit.id },
          data: { isActive },
        });

        results.push({
          employeeId,
          benefit: updatedBenefit,
          status: "success",
        });
      } catch (error) {
        console.error(
          `Error toggling benefit for employee ${employeeId}:`,
          error
        );
        errors.push({ employeeId, error: "Failed to toggle benefit" });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk benefit toggle completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: employeeIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk toggle benefits:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const bulkSalaryAdjustment = async (req, res) => {
  try {
    const { employeeIds, adjustmentType, adjustmentValue } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee IDs array is required and must not be empty",
      });
    }

    if (!adjustmentType || !adjustmentValue || adjustmentValue === 0) {
      return res.status(400).json({
        success: false,
        message: "Adjustment type and value are required",
      });
    }

    if (!["percentage", "fixed-amount"].includes(adjustmentType)) {
      return res.status(400).json({
        success: false,
        message: "Adjustment type must be 'percentage' or 'fixed-amount'",
      });
    }

    const results = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Validate employee exists and belongs to company
        const employee = await prisma.employee.findFirst({
          where: { id: parseInt(employeeId), companyId, deleted: false },
        });

        if (!employee) {
          errors.push({ employeeId, error: "Employee not found" });
          continue;
        }

        if (!employee.salary) {
          errors.push({
            employeeId,
            error: "Employee does not have a salary set",
          });
          continue;
        }

        // Calculate new salary
        let newSalary;
        if (adjustmentType === "percentage") {
          newSalary =
            employee.salary + employee.salary * (adjustmentValue / 100);
        } else {
          newSalary = employee.salary + adjustmentValue;
        }

        // Ensure salary doesn't go below 0
        if (newSalary < 0) {
          errors.push({
            employeeId,
            error: "Adjustment would result in negative salary",
          });
          continue;
        }

        // Update employee salary
        const updatedEmployee = await prisma.employee.update({
          where: { id: parseInt(employeeId) },
          data: { salary: newSalary },
          select: { id: true, name: true, salary: true },
        });

        results.push({
          employeeId,
          employee: updatedEmployee,
          oldSalary: employee.salary,
          newSalary,
          adjustment:
            adjustmentType === "percentage"
              ? `${adjustmentValue}%`
              : `GMD ${adjustmentValue}`,
          status: "success",
        });
      } catch (error) {
        console.error(
          `Error adjusting salary for employee ${employeeId}:`,
          error
        );
        errors.push({ employeeId, error: "Failed to adjust salary" });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk salary adjustment completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: employeeIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk salary adjustment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const bulkUpdateTaxSettings = async (req, res) => {
  try {
    const { employeeIds, socialSecurityRate, customTaxRate } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee IDs array is required and must not be empty",
      });
    }

    if (socialSecurityRate === undefined && customTaxRate === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one tax setting must be provided",
      });
    }

    // Validate rates are between 0 and 1 (decimal format)
    if (socialSecurityRate !== undefined) {
      const rate = parseFloat(socialSecurityRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return res.status(400).json({
          success: false,
          message:
            "Social security rate must be between 0 and 1 (decimal format)",
        });
      }
    }

    if (customTaxRate !== undefined) {
      const rate = parseFloat(customTaxRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return res.status(400).json({
          success: false,
          message: "Custom tax rate must be between 0 and 1 (decimal format)",
        });
      }
    }

    const results = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Validate employee exists and belongs to company
        const employee = await prisma.employee.findFirst({
          where: { id: parseInt(employeeId), companyId, deleted: false },
        });

        if (!employee) {
          errors.push({ employeeId, error: "Employee not found" });
          continue;
        }

        // Prepare update data
        const updateData = {};
        if (socialSecurityRate !== undefined) {
          updateData.socialSecurityRate = parseFloat(socialSecurityRate);
        }
        if (customTaxRate !== undefined) {
          updateData.customTaxRate = parseFloat(customTaxRate);
        }

        // Update or create payroll profile
        const payrollProfile = await prisma.employeePayrollProfile.upsert({
          where: { employeeId: parseInt(employeeId) },
          update: updateData,
          create: {
            employeeId: parseInt(employeeId),
            socialSecurityRate: socialSecurityRate
              ? parseFloat(socialSecurityRate)
              : 0,
            customTaxRate: customTaxRate ? parseFloat(customTaxRate) : 0,
          },
        });

        results.push({ employeeId, payrollProfile, status: "success" });
      } catch (error) {
        console.error(
          `Error updating tax settings for employee ${employeeId}:`,
          error
        );
        errors.push({ employeeId, error: "Failed to update tax settings" });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk tax settings update completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: employeeIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk tax settings update:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const bulkInitializePayrollProfiles = async (req, res) => {
  try {
    const { employeeIds } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee IDs array is required and must not be empty",
      });
    }

    const results = [];
    const errors = [];
    const skipped = [];

    for (const employeeId of employeeIds) {
      try {
        // Validate employee exists and belongs to company
        const employee = await prisma.employee.findFirst({
          where: { id: parseInt(employeeId), companyId, deleted: false },
        });

        if (!employee) {
          errors.push({ employeeId, error: "Employee not found" });
          continue;
        }

        // Check if payroll profile already exists
        const existingProfile = await prisma.employeePayrollProfile.findUnique({
          where: { employeeId: parseInt(employeeId) },
        });

        if (existingProfile) {
          skipped.push({
            employeeId,
            reason: "Payroll profile already exists",
          });
          continue;
        }

        // Create default payroll profile
        const payrollProfile = await prisma.employeePayrollProfile.create({
          data: {
            employeeId: parseInt(employeeId),
            socialSecurityRate: 0, // Default values
            customTaxRate: 0,
          },
        });

        results.push({ employeeId, payrollProfile, status: "success" });
      } catch (error) {
        console.error(
          `Error initializing payroll profile for employee ${employeeId}:`,
          error
        );
        errors.push({
          employeeId,
          error: "Failed to initialize payroll profile",
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk payroll profile initialization completed. ${results.length} created, ${skipped.length} skipped, ${errors.length} failed.`,
      data: {
        successful: results,
        skipped: skipped,
        failed: errors,
        summary: {
          total: employeeIds.length,
          successful: results.length,
          skipped: skipped.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk payroll profile initialization:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const bulkUpdateBonus = async (req, res) => {
  try {
    const { employeeIds, bonus } = req.body;
    const { companyId } = req.user;

    // Validate input
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Employee IDs array is required and must not be empty",
      });
    }

    if (bonus === undefined || bonus === null || bonus < 0) {
      return res.status(400).json({
        success: false,
        message: "Bonus must be a non-negative number",
      });
    }

    const results = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Validate employee exists and belongs to company
        const employee = await prisma.employee.findFirst({
          where: { id: parseInt(employeeId), companyId, deleted: false },
        });

        if (!employee) {
          errors.push({ employeeId, error: "Employee not found" });
          continue;
        }

        // Update employee bonus
        const updatedEmployee = await prisma.employee.update({
          where: { id: parseInt(employeeId) },
          data: { sumBonuses: parseFloat(bonus) },
          select: { id: true, name: true, sumBonuses: true },
        });

        results.push({
          employeeId,
          employee: updatedEmployee,
          oldBonus: employee.sumBonuses || 0,
          newBonus: parseFloat(bonus),
          status: "success",
        });
      } catch (error) {
        console.error(
          `Error updating bonus for employee ${employeeId}:`,
          error
        );
        errors.push({ employeeId, error: "Failed to update bonus" });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk bonus update completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: employeeIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk bonus update:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================
//  PAYROLL ENDPOINTS
// ============================================

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
        attendances: {
          where: {
            date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
          },
        },
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
            bonuses: calculation.bonuses, // Include bonuses in payroll record
            status: "DRAFT",
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

export const getPayrollDetails = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { companyId } = req.user;

    // Validate payrollId is a valid number
    const parsedPayrollId = parseInt(payrollId);
    if (isNaN(parsedPayrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }

    // Validate payroll exists and belongs to company
    const payroll = await prisma.payroll.findFirst({
      where: {
        id: parsedPayrollId,
        companyId,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            profilePic: true,
            department: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found",
      });
    }

    // Get employee benefits for this period
    const benefits = await prisma.employeeBenefit.findMany({
      where: {
        employeeId: payroll.employeeId,
        companyId,
        isActive: true,
      },
    });

    // Get attendance records for this period
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: payroll.employeeId,
        date: {
          gte: payroll.periodStart,
          lte: payroll.periodEnd,
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        payroll,
        benefits,
        attendances,
      },
    });
  } catch (error) {
    console.error("Error fetching payroll details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPayrollPreview = async (req, res) => {
  try {
    const { periodStart, periodEnd, employeeIds } = req.body;
    const { companyId } = req.user;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Period start and end are required",
      });
    }

    // Get employees for preview
    const whereClause = { companyId, deleted: false };
    if (employeeIds && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds.map((id) => parseInt(id)) };
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        benefits: { where: { isActive: true } },
        payrollProfile: true,
        attendances: {
          where: {
            date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
          },
        },
      },
    });

    const previewData = [];
    const errors = [];

    // Calculate preview for each employee
    for (const employee of employees) {
      try {
        const calculation =
          PayrollCalculator.calculateEmployeePayroll(employee);
        previewData.push({
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email,
          position: employee.position,
          department: employee.department?.name,
          ...calculation,
        });
      } catch (error) {
        errors.push({
          employeeId: employee.id,
          employeeName: employee.name,
          error: error.message,
        });
      }
    }

    // Calculate totals
    const totals = previewData.reduce(
      (acc, item) => ({
        totalGross: acc.totalGross + item.grossPay,
        totalNet: acc.totalNet + item.netPay,
        totalDeductions: acc.totalDeductions + item.totalDeductions,
        totalBenefits: acc.totalBenefits + item.benefitsCost,
        totalTaxes: acc.totalTaxes + item.incomeTax,
        totalSSN: acc.totalSSN + item.socialSecurity,
        totalPenalties: acc.totalPenalties + item.attendancePenalties,
      }),
      {
        totalGross: 0,
        totalNet: 0,
        totalDeductions: 0,
        totalBenefits: 0,
        totalTaxes: 0,
        totalSSN: 0,
        totalPenalties: 0,
      }
    );

    res.status(200).json({
      success: true,
      data: {
        preview: previewData,
        errors,
        totals,
        summary: {
          totalEmployees: previewData.length,
          failedEmployees: errors.length,
          periodStart,
          periodEnd,
        },
      },
    });
  } catch (error) {
    console.error("Error generating payroll preview:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================
// NEW PAYROLL WORKFLOW ENDPOINTS
// ============================================

export const getDraftPayrolls = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    // Get draft payrolls only
    const where = {
      companyId,
      status: "DRAFT",
    };

    const [payrollRecords, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
              department: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.payroll.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payrolls: payrollRecords,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching draft payrolls:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updatePayrollRecord = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const {
      baseSalary,
      bonuses,
      benefitsCost,
      incomeTax,
      socialSecurity,
      attendancePenalties,
      notes,
    } = req.body;
    const { companyId } = req.user;

    // Validate payrollId is a valid number
    const parsedPayrollId = parseInt(payrollId);
    if (isNaN(parsedPayrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }

    // Validate payroll exists and is in DRAFT status
    const payroll = await prisma.payroll.findFirst({
      where: {
        id: parsedPayrollId,
        companyId,
        status: "DRAFT", // Only allow editing DRAFT records
      },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Draft payroll record not found",
      });
    }

    // Calculate new values
    const newGrossPay =
      (baseSalary || payroll.baseSalary) +
      (bonuses || payroll.bonuses || 0) +
      (benefitsCost || payroll.benefitsCost || 0);

    const newTotalDeductions =
      (incomeTax || payroll.incomeTax || 0) +
      (socialSecurity || payroll.socialSecurity || 0) +
      (attendancePenalties || payroll.attendancePenalties || 0);

    const newNetPay = newGrossPay - newTotalDeductions;

    // Update payroll record
    const updatedPayroll = await prisma.payroll.update({
      where: { id: parsedPayrollId },
      data: {
        ...(baseSalary !== undefined && { baseSalary }),
        ...(bonuses !== undefined && { bonuses }),
        ...(benefitsCost !== undefined && { benefitsCost }),
        ...(incomeTax !== undefined && { incomeTax }),
        ...(socialSecurity !== undefined && { socialSecurity }),
        ...(attendancePenalties !== undefined && { attendancePenalties }),
        ...(notes !== undefined && { notes }),
        grossPay: newGrossPay,
        totalDeductions: newTotalDeductions,
        netPay: newNetPay,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Payroll record updated successfully",
      data: updatedPayroll,
    });
  } catch (error) {
    console.error("Error updating payroll record:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const finalizePayroll = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { companyId, id: userId } = req.user;

    // Validate payrollId is a valid number
    const parsedPayrollId = parseInt(payrollId);
    if (isNaN(parsedPayrollId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll ID",
      });
    }

    // Validate payroll exists and is in DRAFT status
    const payroll = await prisma.payroll.findFirst({
      where: {
        id: parsedPayrollId,
        companyId,
        status: "DRAFT",
      },
    });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Draft payroll record not found",
      });
    }

    // Finalize the payroll
    const finalizedPayroll = await prisma.payroll.update({
      where: { id: parsedPayrollId },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedBy: userId,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Payroll finalized successfully",
      data: finalizedPayroll,
    });
  } catch (error) {
    console.error("Error finalizing payroll:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const finalizeAllPayrolls = async (req, res) => {
  try {
    const { companyId, id: userId } = req.user;

    // Get all draft payrolls for the company
    const draftPayrolls = await prisma.payroll.findMany({
      where: {
        companyId,
        status: "DRAFT",
      },
      select: {
        id: true,
        employee: {
          select: {
            name: true,
          },
        },
      },
    });

    if (draftPayrolls.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No draft payroll records found to finalize",
      });
    }

    // Finalize all draft payrolls in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const finalizedPayrolls = [];

      for (const payroll of draftPayrolls) {
        const finalizedPayroll = await tx.payroll.update({
          where: { id: payroll.id },
          data: {
            status: "FINALIZED",
            finalizedAt: new Date(),
            finalizedBy: userId,
          },
        });
        finalizedPayrolls.push({
          id: finalizedPayroll.id,
          employeeName: payroll.employee.name,
        });
      }

      return finalizedPayrolls;
    });

    res.json({
      success: true,
      message: `Successfully finalized ${result.length} payroll records`,
      data: {
        finalizedCount: result.length,
        finalizedPayrolls: result,
      },
    });
  } catch (error) {
    console.error("Error finalizing all payrolls:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getFinalizedPayrolls = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    // Get finalized payrolls only
    const where = {
      companyId,
      status: "FINALIZED",
    };

    const [payrollRecords, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        orderBy: { finalizedAt: "desc" },
        skip,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              position: true,
              department: {
                select: { name: true },
              },
            },
          },
          finalizedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.payroll.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payrolls: payrollRecords,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching finalized payrolls:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
