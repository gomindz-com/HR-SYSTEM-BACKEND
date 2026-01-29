import { PayrollCalculator } from '../payrollCalculation.js';

/**
 * Helper: build minimal employee and run payroll with taxes only (no benefits, no attendance).
 * Returns the payroll result so we can assert on incomeTax, netPay, etc.
 */
function runPayrollForGrossSalary(grossSalary) {
  const employee = {
    salary: grossSalary,
    sumBonuses: 0,
    EmployeeBenefit: [],
    EmployeePayrollProfile: null,
    attendances: [],
  };
  return PayrollCalculator.calculateEmployeePayroll(employee, {
    includeBenefits: false,
    applyTaxes: true,
    includeAttendance: false,
  });
}

describe('GRA income tax (via PayrollCalculator)', () => {
  test('D2,500 – below threshold, no tax', () => {
    const result = runPayrollForGrossSalary(2500);
    expect(result.incomeTax).toBe(0);
    expect(result.netPay).toBe(2500 - result.socialSecurity);
  });

  test('D3,000 – at threshold, no tax', () => {
    const result = runPayrollForGrossSalary(3000);
    expect(result.incomeTax).toBe(0);
  });

  test('D3,500 – first taxable band, tax D50', () => {
    const result = runPayrollForGrossSalary(3500);
    expect(result.incomeTax).toBeCloseTo(50, 2);
    expect(result.netPay).toBeCloseTo(3450 - result.socialSecurity, 2);
  });

  test('D5,000 – middle band, tax D275', () => {
    const result = runPayrollForGrossSalary(5000);
    expect(result.incomeTax).toBeCloseTo(275, 2);
    expect(result.netPay).toBeCloseTo(4725 - result.socialSecurity, 2);
  });

  test('D8,000 – higher band, tax D1083.35', () => {
    const result = runPayrollForGrossSalary(8000);
    expect(result.incomeTax).toBeCloseTo(1083.35, 2);
    expect(result.netPay).toBeCloseTo(6916.65 - result.socialSecurity, 2);
  });

  test('D15,000 – top band, tax D3183.35', () => {
    const result = runPayrollForGrossSalary(15000);
    expect(result.incomeTax).toBeCloseTo(3183.35, 2);
    expect(result.netPay).toBeCloseTo(11816.65 - result.socialSecurity, 2);
  });
});

describe('GRA tax edge cases', () => {
  test('D0 gross – no tax', () => {
    const result = runPayrollForGrossSalary(0);
    expect(result.incomeTax).toBe(0);
    expect(result.grossPay).toBe(0);
  });

  test('D4,000 – tax D108.35', () => {
    const result = runPayrollForGrossSalary(4000);
    expect(result.incomeTax).toBeCloseTo(108.35, 2);
  });
});