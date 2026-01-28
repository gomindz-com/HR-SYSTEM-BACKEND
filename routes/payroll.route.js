import express from "express";
import {
  generateAllEmployeesPayroll,
  getEmployeeBenefits,
  addEmployeeBenefit,
  updateEmployeeBenefit,
  toggleEmployeeBenefit,
  bulkAssignBenefits,
  bulkToggleBenefits,
  bulkSalaryAdjustment,
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
router.get("/employees/:employeeId/benefits", requireRole(["ADMIN", "FINANCE"]), getEmployeeBenefits);

// Add benefit to employee
router.post("/employees/:employeeId/benefits", requireRole(["ADMIN", "FINANCE"]), addEmployeeBenefit);

// Update employee benefit
router.put("/employees/:employeeId/benefits/:benefitId", requireRole(["ADMIN", "FINANCE"]), updateEmployeeBenefit);

// Toggle employee benefit active status
router.put(
  "/employees/:employeeId/benefits/:benefitId/toggle",
  requireRole(["ADMIN", "FINANCE"]),
  toggleEmployeeBenefit
);

// ============================================
// BULK OPERATIONS ROUTES
// ============================================

// Bulk assign benefits to multiple employees
router.post("/bulk/benefits/assign", requireRole(["ADMIN", "FINANCE"]), bulkAssignBenefits);

// Bulk toggle benefits for multiple employees
router.post("/bulk/benefits/toggle", requireRole(["ADMIN", "FINANCE"]), bulkToggleBenefits);

// Bulk salary adjustment for multiple employees
router.post("/bulk/salary/adjust", requireRole(["ADMIN", "FINANCE"]), bulkSalaryAdjustment);


// Bulk update bonus for multiple employees
router.post("/bulk/bonus/update", requireRole(["ADMIN", "FINANCE"]), bulkUpdateBonus);

// ============================================
// NEW PAYROLL WORKFLOW ROUTES (SPECIFIC ROUTES FIRST)
// ============================================

// Get draft payrolls (for Review & Edit tab)
router.get("/drafts", requireRole(["ADMIN", "FINANCE"]), getDraftPayrolls);

// Get finalized payrolls (for History tab)
router.get("/finalized", requireRole(["ADMIN", "FINANCE"]), getFinalizedPayrolls);

// Get paid payrolls (for Paid tab)
router.get("/paid", requireRole(["ADMIN", "FINANCE"]), getPaidPayrolls);

// Get payroll preview (before generation)
router.post("/preview", requireRole(["ADMIN", "FINANCE"]), getPayrollPreview);

// Finalize all draft payrolls
router.put("/finalize-all", requireRole(["ADMIN", "FINANCE"]), finalizeAllPayrolls);

// ============================================
// ADDITIONAL PAYROLL ROUTES (PARAMETER ROUTES LAST)
// ============================================

// Get detailed payroll information
router.get("/:payrollId", getPayrollDetails);

// Update individual payroll record (for editing)
router.put("/:payrollId/update", requireRole(["ADMIN", "FINANCE"]), updatePayrollRecord);

// Finalize payroll record
router.put("/:payrollId/finalize", requireRole(["ADMIN", "FINANCE"]), finalizePayroll);

// Mark individual payroll as paid
router.put("/:payrollId/mark-paid", requireRole(["ADMIN", "FINANCE"]), markIndividualPayrollAsPaid);

// Mark period as paid (bulk operation)
router.post("/mark-period-as-paid", requireRole(["ADMIN", "FINANCE"]), markPeriodAsPaid);

export default router;
