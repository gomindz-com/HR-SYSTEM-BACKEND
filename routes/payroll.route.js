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
  getPaidPayrolls,
  markPeriodAsPaid,
  markIndividualPayrollAsPaid,
} from "../controller/payroll.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";
import { checkFeatureAccess } from "../middleware/feature.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

// Payroll requires: authentication + active subscription + 'payroll' feature
router.use(verifyToken);
router.use(checkSubscription);
router.use(checkFeatureAccess("payroll_and_payslip_automation"));

// Generate payroll for all employees
router.post("/generate", requireRole(["FINANCE"]), generateAllEmployeesPayroll);

// Get employee benefits
router.get("/employees/:employeeId/benefits", requireRole(["FINANCE"]), getEmployeeBenefits);

// Add benefit to employee
router.post("/employees/:employeeId/benefits", requireRole(["FINANCE"]), addEmployeeBenefit);

// Update employee benefit
router.put("/employees/:employeeId/benefits/:benefitId", requireRole(["FINANCE"]), updateEmployeeBenefit);

// Toggle employee benefit active status
router.put(
  "/employees/:employeeId/benefits/:benefitId/toggle",
  requireRole(["FINANCE"]),
  toggleEmployeeBenefit
);

// Get employee payroll settings
router.get("/employees/:employeeId/settings", requireRole(["FINANCE"]), getEmployeePayrollSettings);

// Update employee payroll settings (tax profile)
router.put("/employees/:employeeId/settings", requireRole(["FINANCE"]), updatePayrollSetting);

// ============================================
// BULK OPERATIONS ROUTES
// ============================================

// Bulk assign benefits to multiple employees
router.post("/bulk/benefits/assign", requireRole(["FINANCE"]), bulkAssignBenefits);

// Bulk toggle benefits for multiple employees
router.post("/bulk/benefits/toggle", requireRole(["FINANCE"]), bulkToggleBenefits);

// Bulk salary adjustment for multiple employees
router.post("/bulk/salary/adjust", requireRole(["FINANCE"]), bulkSalaryAdjustment);

// Bulk update tax settings for multiple employees
router.post("/bulk/tax-settings", requireRole(["FINANCE"]), bulkUpdateTaxSettings);

// Bulk initialize payroll profiles for multiple employees
router.post("/bulk/payroll-profiles/initialize", requireRole(["FINANCE"]), bulkInitializePayrollProfiles);

// Bulk update bonus for multiple employees
router.post("/bulk/bonus/update", requireRole(["FINANCE"]), bulkUpdateBonus);

// ============================================
// NEW PAYROLL WORKFLOW ROUTES (SPECIFIC ROUTES FIRST)
// ============================================

// Get draft payrolls (for Review & Edit tab)
router.get("/drafts", requireRole(["FINANCE"]), getDraftPayrolls);

// Get finalized payrolls (for History tab)
router.get("/finalized", requireRole(["FINANCE"]), getFinalizedPayrolls);

// Get paid payrolls (for Paid tab)
router.get("/paid", requireRole(["FINANCE"]), getPaidPayrolls);

// Get payroll preview (before generation)
router.post("/preview", requireRole(["FINANCE"]), getPayrollPreview);

// Finalize all draft payrolls
router.put("/finalize-all", requireRole(["FINANCE"]), finalizeAllPayrolls);

// ============================================
// ADDITIONAL PAYROLL ROUTES (PARAMETER ROUTES LAST)
// ============================================

// Get detailed payroll information
router.get("/:payrollId", getPayrollDetails);

// Update individual payroll record (for editing)
router.put("/:payrollId/update", requireRole(["FINANCE"]), updatePayrollRecord);

// Finalize payroll record
router.put("/:payrollId/finalize", requireRole(["FINANCE"]), finalizePayroll);

// Mark individual payroll as paid
router.put("/:payrollId/mark-paid", requireRole(["FINANCE"]), markIndividualPayrollAsPaid);

// Mark period as paid (bulk operation)
router.post("/mark-period-as-paid", requireRole(["FINANCE"]), markPeriodAsPaid);

export default router;
