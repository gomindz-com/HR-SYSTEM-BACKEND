import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Format date to readable string
 */
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Format date long (month long, day, year) for PDF
 */
const formatDateLong = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Format number with commas and 2 decimal places
 */
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "0.00";
  return Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Generate employee ID from prisma ID if not available
 */
const generateEmployeeId = (employee) => {
  if (employee.employeeId) return employee.employeeId;
  return `EMP-${String(employee.id).padStart(3, "0")}`;
};

const MARGIN = 20;
const FONT_SIZE_SMALL = 9;
const FONT_SIZE_NORMAL = 11;
const FONT_SIZE_TITLE = 28;
const FONT_SIZE_HEADER = 22;
const LINE_HEIGHT = 6;

/**
 * Generate PDF payslip using jsPDF
 * @param {Object} payrollData - Payroll record data
 * @param {Object} employee - Employee data
 * @param {Object} company - Company data
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generatePayslipPDF = async (payrollData, employee, company) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    let y = MARGIN;

    // Header: logo box (black square with company initial)
    const companyName = company?.companyName || "Company";
    const companyLetter = companyName.charAt(0).toUpperCase();
    const logoSize = 15;
    doc.setFillColor(0, 0, 0);
    doc.rect(MARGIN, y, logoSize, logoSize, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(companyLetter, MARGIN + logoSize / 2 - 2, y + logoSize / 2 + 3);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.text(companyName, MARGIN + logoSize + 5, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONT_SIZE_HEADER);
    doc.text("PAYSLIP", MARGIN + logoSize + 5, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SIZE_SMALL);
    const contactLine =
      (company?.companyEmail || "contact@company.com") +
      (company?.companyAddress ? ` | ${company.companyAddress}` : "");
    doc.text(contactLine, MARGIN + logoSize + 5, y + 18);

    y += logoSize + 15;

    // Title
    doc.setFontSize(FONT_SIZE_TITLE);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Payslip for ${employee?.position || "Employee"}`,
      MARGIN,
      y,
      { align: "left" }
    );
    y += LINE_HEIGHT * 2;

    // Dates
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SIZE_NORMAL);
    const startDateStr = formatDateLong(payrollData.periodStart);
    const endDateStr = formatDateLong(payrollData.periodEnd);
    const payDateStr = formatDateLong(
      payrollData.finalizedAt || new Date()
    );
    doc.text(`Start Date: ${startDateStr}`, MARGIN, y);
    doc.text(`End Date: ${endDateStr}`, MARGIN + 65, y);
    y += LINE_HEIGHT;
    doc.text(`Pay Date: ${payDateStr}`, MARGIN, y);
    y += LINE_HEIGHT * 2;

    // Employee info
    doc.setFont("helvetica", "bold");
    doc.text("Employee Name:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(employee?.name ?? "—", MARGIN + 45, y);
    y += LINE_HEIGHT;
    doc.setFont("helvetica", "bold");
    doc.text("Employee ID:", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(generateEmployeeId(employee), MARGIN + 45, y);
    y += LINE_HEIGHT * 2;

    // Earnings table
    const earningsBody = [
      ["Base Salary", `${formatCurrency(payrollData.baseSalary)} GMD`],
    ];
    if (payrollData.bonuses && payrollData.bonuses > 0) {
      earningsBody.push(["Bonuses", `${formatCurrency(payrollData.bonuses)} GMD`]);
    }
    if (payrollData.benefitsCost && payrollData.benefitsCost > 0) {
      earningsBody.push([
        "Benefits",
        `${formatCurrency(payrollData.benefitsCost)} GMD`,
      ]);
    }
    if (payrollData.hoursWorked) {
      earningsBody.push([
        "Hours Worked",
        `${payrollData.hoursWorked} hrs`,
      ]);
    }
    earningsBody.push([
      "Gross Salary",
      `${formatCurrency(payrollData.grossPay)} GMD`,
    ]);

    autoTable(doc, {
      head: [["Earnings", "Amount"]],
      body: earningsBody,
      startY: y,
      theme: "grid",
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [60, 60, 60],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: "auto", halign: "right" },
      },
      styles: { fontSize: FONT_SIZE_SMALL },
    });

    y = doc.lastAutoTable.finalY + 8;

    // Deductions table
    const taxAmount =
      payrollData.incomeTax && payrollData.incomeTax > 0
        ? `${formatCurrency(payrollData.incomeTax)} GMD`
        : "0.00 GMD";
    const penaltiesAmount =
      payrollData.attendancePenalties && payrollData.attendancePenalties > 0
        ? `${formatCurrency(payrollData.attendancePenalties)} GMD`
        : "0.00 GMD";
    const insuranceAmount =
      payrollData.socialSecurity && payrollData.socialSecurity > 0
        ? `${formatCurrency(payrollData.socialSecurity)} GMD`
        : "0.00 GMD";

    const deductionsBody = [
      ["Taxes", taxAmount],
      ["Late Penalties", penaltiesAmount],
      ["Insurances", insuranceAmount],
      [
        "Total Deductions",
        `${formatCurrency(payrollData.totalDeductions)} GMD`,
      ],
    ];

    autoTable(doc, {
      head: [["Deductions", "Amount"]],
      body: deductionsBody,
      startY: y,
      theme: "grid",
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [60, 60, 60],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: "auto", halign: "right" },
      },
      styles: { fontSize: FONT_SIZE_SMALL },
      bodyStyles: { fontStyle: "normal" },
    });

    y = doc.lastAutoTable.finalY + 10;

    // Net pay box
    const netPayStr = `${formatCurrency(payrollData.netPay)} GMD`;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, y, 170, 12, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Net Pay", MARGIN + 4, y + 8);
    doc.text(netPayStr, MARGIN + 166 - doc.getTextWidth(netPayStr), y + 8);

    y += 25;

    // Signature section
    doc.setDrawColor(0, 0, 0);
    doc.line(MARGIN + 125, y, MARGIN + 170, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setTextColor(100, 100, 100);
    doc.text("Employee Signature", MARGIN + 125, y);

    const arrayBuffer = doc.output("arraybuffer");
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("❌ Error generating payslip PDF:", error);
    throw new Error(`Failed to generate payslip PDF: ${error.message}`);
  }
};
