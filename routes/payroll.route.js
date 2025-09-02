import express from "express";
import {
  generateAllEmployeesPayroll,
  getCompanyPayrolls,
  addEmployeeBenefit,
  updateEmployeeBenefit,
  removeEmployeeBenefit,
  updatePayrollSetting,
} from "../controller/payroll.controller.js";
import  { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);


// Generate payroll for all employees
router.post("/generate", generateAllEmployeesPayroll);

// Get company payrolls with filters and pagination
router.get("/", getCompanyPayrolls);


// Add benefit to employee
router.post("/employees/:employeeId/benefits", addEmployeeBenefit);

// Update employee benefit
router.put("/employees/:employeeId/benefits/:benefitId", updateEmployeeBenefit);

// Remove employee benefit (soft delete)
router.delete(
  "/employees/:employeeId/benefits/:benefitId",
  removeEmployeeBenefit
);


// Update employee payroll settings (tax profile)
router.put("/employees/:employeeId/settings", updatePayrollSetting);

export default router;
