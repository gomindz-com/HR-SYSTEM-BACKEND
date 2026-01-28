/**
 * Pure Payroll Calculation Engine
 * Formula: Basic Salary + Bonuses + Benefits = Gross Pay
 * Gross Pay - (Income Tax + Social Security + Attendance Penalties) = Net Pay
 */
const EMPLOYEE_SS_RATE = 0.05;
const EMPLOYER_SS_RATE = 0.10;

const GRA_TAX_BANDS = [
  { limit: 3000, rate: 0.00 }, // 0 – 3,000  → 0%
  { limit: 3833, rate: 0.10 }, // 3,001 – 3,833 → 10%
  { limit: 4667, rate: 0.15 }, // 3,834 – 4,667 → 15%
  { limit: 5500, rate: 0.20 }, // 4,668 – 5,500 → 20%
  { limit: 6333, rate: 0.25 }, // 5,501 – 6,333 → 25%
];

const GRA_TOP_RATE = 0.30; // 30% above 6,333




const calculateGRAIncomeTax = (monthlyIncome) => {

  let income = Math.max(0, monthlyIncome || 0)
  let tax = 0
  let previousLimit = 0

  for (const band of GRA_TAX_BANDS) {
    if (income <= previousLimit) break;

    const bandWidth = band.limit - previousLimit;
    const taxableInBand = Math.min(income - previousLimit, bandWidth);

    tax += taxableInBand * band.rate;
    previousLimit = band.limit
  }

  if (income > previousLimit) {
    tax += (income - previousLimit) * GRA_TOP_RATE
  }


  return Number(tax.toFixed(2))

}

export class PayrollCalculator {
  /**
   * Calculate payroll for an employee
   */
  static calculateEmployeePayroll(employeeData, options = {}) {
    const {
      salary,
      sumBonuses,
      EmployeeBenefit,
      EmployeePayrollProfile,
      attendances,
    } = employeeData;

    // Map the new field names to the expected ones for backward compatibility
    const benefits = EmployeeBenefit;
    const payrollProfile = EmployeePayrollProfile;

    const {
      includeBenefits = true,
      applyTaxes = true,
      includeAttendance = true,
    } = options;

    // Step 1: Calculate Gross Pay
    const baseSalary = salary || 0;
    const bonuses = sumBonuses || 0; // Add bonuses from employee model
    const benefitsCost = includeBenefits
      ? this.calculateBenefits(benefits || [])
      : 0;
    const grossPay = baseSalary + bonuses + benefitsCost;

    // Step 2: Calculate Deductions
    const { incomeTax, socialSecurity } = applyTaxes
      ? this.calculateTaxes(grossPay, payrollProfile)
      : { incomeTax: 0, socialSecurity: 0 };

    const attendancePenalties = includeAttendance
      ? this.calculateAttendancePenalties(attendances || [], baseSalary)
      : 0;

    const totalDeductions = incomeTax + socialSecurity + attendancePenalties;

    // Step 3: Calculate Net Pay
    const netPay = grossPay - totalDeductions;

    return {
      baseSalary,
      bonuses, // Include bonuses in return
      benefitsCost,
      grossPay,
      incomeTax,
      socialSecurity,
      attendancePenalties,
      totalDeductions,
      netPay,
    };
  }

  /**
   * Calculate total benefits cost
   */

  static calculateBenefits(benefits) {
    return benefits.reduce((total, benefit) => {
      return total + (benefit.amount || 0);
    }, 0);
  }

  /**
   * Calculate taxes - ZERO if not provided
   */

  
  static calculateTaxes(grossPay) {

    // Tax Rate: customTaxRate is always the source of truth (numeric value)
    // taxBracket is just a label for reference
    const taxableIncome = grossPay || 0;
    let incomeTax = calculateGRAIncomeTax(taxableIncome);

    // Social Security Rate is 5% of the gross pay for each employee generally.
    return {
      incomeTax,
      socialSecurity: taxableIncome * EMPLOYEE_SS_RATE,
    };
  }

  /**
   * Calculate attendance penalties based on labor law rules:
   * - Three consecutive lates = 100% daily rate deduction
   * - One absent = 100% daily rate deduction
   * - Nothing else
   */
  static calculateAttendancePenalties(attendances, monthlySalary) {
    const dailyRate = monthlySalary / 22; // 22 working days
    let totalPenalty = 0;

    // Sort attendances by date to check for consecutive lates
    const sortedAttendances = [...attendances].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    let consecutiveLateCount = 0;
    let penaltyAppliedForConsecutiveLates = false;

    sortedAttendances.forEach((attendance) => {
      switch (attendance.status) {
        case "ABSENT":
          // One absent = 100% daily rate deduction
          totalPenalty += dailyRate;
          // Reset consecutive late count
          consecutiveLateCount = 0;
          penaltyAppliedForConsecutiveLates = false;
          break;

        case "LATE":
          consecutiveLateCount++;

          // Check if we have 3 consecutive lates and haven't applied penalty yet
          if (consecutiveLateCount >= 3 && !penaltyAppliedForConsecutiveLates) {
            totalPenalty += dailyRate; // 100% daily rate deduction
            penaltyAppliedForConsecutiveLates = true;
          }
          break;

        case "ON_TIME":
        case "EARLY":
          // Reset consecutive late count for on-time or early arrivals
          consecutiveLateCount = 0;
          penaltyAppliedForConsecutiveLates = false;
          break;
      }
    });

    return totalPenalty;
  }
}



