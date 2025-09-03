import express from "express";
import {
  generateAllEmployeesPayroll,
  getCompanyPayrolls,
  getEmployeeBenefits,
  addEmployeeBenefit,
  updateEmployeeBenefit,
  removeEmployeeBenefit,
  getEmployeePayrollSettings,
  updatePayrollSetting,
} from "../controller/payroll.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

// Generate payroll for all employees
router.post("/generate", generateAllEmployeesPayroll);

// Get company payrolls with filters and pagination
router.get("/", getCompanyPayrolls);

// Get employee benefits
router.get("/employees/:employeeId/benefits", getEmployeeBenefits);

// Add benefit to employee
router.post("/employees/:employeeId/benefits", addEmployeeBenefit);

// Update employee benefit
router.put("/employees/:employeeId/benefits/:benefitId", updateEmployeeBenefit);

// Remove employee benefit (soft delete)
router.delete(
  "/employees/:employeeId/benefits/:benefitId",
  removeEmployeeBenefit
);

// Get employee payroll settings
router.get("/employees/:employeeId/settings", getEmployeePayrollSettings);

// Update employee payroll settings (tax profile)
router.put("/employees/:employeeId/settings", updatePayrollSetting);

export default router;
