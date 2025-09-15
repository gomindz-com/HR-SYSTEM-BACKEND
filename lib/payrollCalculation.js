/**
 * Pure Payroll Calculation Engine
 * Formula: Basic Salary + Bonuses + Benefits = Gross Pay
 * Gross Pay - (Income Tax + Social Security + Attendance Penalties) = Net Pay
 */

export class PayrollCalculator {
  /**
   * Calculate payroll for an employee
   */
  static calculateEmployeePayroll(employeeData, options = {}) {
    const { salary, sumBonuses, benefits, payrollProfile, attendances } =
      employeeData;

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
  static calculateTaxes(grossPay, payrollProfile) {
    if (!payrollProfile) {
      return { incomeTax: 0, socialSecurity: 0 };
    }

    // Tax Rate: customTaxRate is always the source of truth (numeric value)
    // taxBracket is just a label for reference
    const taxRate = payrollProfile.customTaxRate || 0;

    // Social Security Rate
    const socialSecurityRate = payrollProfile.socialSecurityRate || 0;

    return {
      incomeTax: grossPay * taxRate,
      socialSecurity: grossPay * socialSecurityRate,
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
