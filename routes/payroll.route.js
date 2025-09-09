import express from "express";
import {
  generateAllEmployeesPayroll,
  getEmployeeBenefits,
  addEmployeeBenefit,
  updateEmployeeBenefit,
  toggleEmployeeBenefit,
  getEmployeePayrollSettings,
  updatePayrollSetting,
  bulkAssignBenefits,
  bulkToggleBenefits,
  bulkSalaryAdjustment,
  bulkUpdateTaxSettings,
  bulkInitializePayrollProfiles,
  bulkUpdateBonus,
  getPayrollDetails,
  getPayrollPreview,
  getDraftPayrolls,
  updatePayrollRecord,
  finalizePayroll,
  finalizeAllPayrolls,
  getFinalizedPayrolls,
} from "../controller/payroll.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

// Generate payroll for all employees
router.post("/generate", generateAllEmployeesPayroll);

// Get employee benefits
router.get("/employees/:employeeId/benefits", getEmployeeBenefits);

// Add benefit to employee
router.post("/employees/:employeeId/benefits", addEmployeeBenefit);

// Update employee benefit
router.put("/employees/:employeeId/benefits/:benefitId", updateEmployeeBenefit);

// Toggle employee benefit active status
router.put(
  "/employees/:employeeId/benefits/:benefitId/toggle",
  toggleEmployeeBenefit
);

// Get employee payroll settings
router.get("/employees/:employeeId/settings", getEmployeePayrollSettings);

// Update employee payroll settings (tax profile)
router.put("/employees/:employeeId/settings", updatePayrollSetting);

// ============================================
// BULK OPERATIONS ROUTES
// ============================================

// Bulk assign benefits to multiple employees
router.post("/bulk/benefits/assign", bulkAssignBenefits);

// Bulk toggle benefits for multiple employees
router.post("/bulk/benefits/toggle", bulkToggleBenefits);

// Bulk salary adjustment for multiple employees
router.post("/bulk/salary/adjust", bulkSalaryAdjustment);

// Bulk update tax settings for multiple employees
router.post("/bulk/tax-settings", bulkUpdateTaxSettings);

// Bulk initialize payroll profiles for multiple employees
router.post("/bulk/payroll-profiles/initialize", bulkInitializePayrollProfiles);

// Bulk update bonus for multiple employees
router.post("/bulk/bonus/update", bulkUpdateBonus);

// ============================================
// NEW PAYROLL WORKFLOW ROUTES (SPECIFIC ROUTES FIRST)
// ============================================

// Get draft payrolls (for Review & Edit tab)
router.get("/drafts", getDraftPayrolls);

// Get finalized payrolls (for History tab)
router.get("/finalized", getFinalizedPayrolls);

// Get payroll preview (before generation)
router.post("/preview", getPayrollPreview);

// Finalize all draft payrolls
router.put("/finalize-all", finalizeAllPayrolls);

// ============================================
// ADDITIONAL PAYROLL ROUTES (PARAMETER ROUTES LAST)
// ============================================

// Get detailed payroll information
router.get("/:payrollId", getPayrollDetails);

// Update individual payroll record (for editing)
router.put("/:payrollId/update", updatePayrollRecord);

// Finalize payroll record
router.put("/:payrollId/finalize", finalizePayroll);

export default router;
