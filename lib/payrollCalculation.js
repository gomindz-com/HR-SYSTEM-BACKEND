/**
 * Pure Payroll Calculation Engine
 * Formula: Basic Salary + Benefits = Gross Pay
 * Gross Pay - (Income Tax + Social Security + Attendance Penalties) = Net Pay
 */

export class PayrollCalculator {
  
    /**
     * Calculate payroll for an employee
     */
    static calculateEmployeePayroll(employeeData) {
      const { salary, benefits, payrollProfile, attendances } = employeeData;
  
      // Step 1: Calculate Gross Pay
      const baseSalary = salary || 0;
      const benefitsCost = this.calculateBenefits(benefits || []);
      const grossPay = baseSalary + benefitsCost;
  
      // Step 2: Calculate Deductions
      const { incomeTax, socialSecurity } = this.calculateTaxes(grossPay, payrollProfile);
      const attendancePenalties = this.calculateAttendancePenalties(attendances || [], baseSalary);
      const totalDeductions = incomeTax + socialSecurity + attendancePenalties;
  
      // Step 3: Calculate Net Pay
      const netPay = grossPay - totalDeductions;
  
      return {
        baseSalary,
        benefitsCost,
        grossPay,
        incomeTax,
        socialSecurity,
        attendancePenalties,
        totalDeductions,
        netPay
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
  
      let taxRate = 0;
      let socialSecurityRate = 0;
  
      if (payrollProfile.customTaxRate) {
        taxRate = payrollProfile.customTaxRate;
      } else if (payrollProfile.taxBracket) {
        taxRate = parseFloat(payrollProfile.taxBracket.replace('%', '')) / 100;
      }
  
      if (payrollProfile.socialSecurityRate) {
        socialSecurityRate = payrollProfile.socialSecurityRate;
      }
  
      return {
        incomeTax: grossPay * taxRate,
        socialSecurity: grossPay * socialSecurityRate
      };
    }
  
    /**
     * Calculate attendance penalties
     */
    static calculateAttendancePenalties(attendances, monthlySalary) {
      const dailyRate = monthlySalary / 22; // 22 working days
      let totalPenalty = 0;
  
      attendances.forEach(attendance => {
        switch (attendance.status) {
          case 'ABSENT':
            totalPenalty += dailyRate; // Full day deduction
            break;
          case 'LATE':
            totalPenalty += dailyRate * 0.1; // 10% deduction
            break;
        }
      });
  
      return totalPenalty;
    }
  }