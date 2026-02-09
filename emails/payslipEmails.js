import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "./emailLayout.js";

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
 * Format period for display (e.g., "January 2024")
 */
const formatPeriod = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString("en-GB", { month: "short" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "short" });
  const year = start.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${year}`;
  }
  return `${startMonth} - ${endMonth} ${year}`;
};

/**
 * Format currency with commas
 */
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "0.00";
  return Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Humanize payroll status for display
 */
const formatStatus = (status) => {
  if (!status) return "Processed";
  return String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase();
};

/**
 * Send payslip email with PDF attachment
 */
export const sendPayslipEmail = async (employee, payrollData, pdfBuffer) => {
  try {
    const period = formatPeriod(payrollData.periodStart, payrollData.periodEnd);
    const netPayFormatted = formatCurrency(payrollData.netPay);

    const payDate = formatDate(payrollData.finalizedAt || payrollData.processedDate || new Date());
    const statusLabel = formatStatus(payrollData.status);
    const showPaymentMethod = payrollData.paymentMethod && payrollData.paymentMethod.trim() !== "";

    const summaryLines = [
      `Pay period: ${period}`,
      `Pay date: ${payDate}`,
      `Status: ${statusLabel}`,
      ...(showPaymentMethod ? [`Payment method: ${payrollData.paymentMethod.trim()}`] : []),
    ];
    const highlightBlock = summaryLines.join("<br />");

    const bodyParagraphs = [
      `Dear ${employee.name},`,
      `Please find attached your payslip for the period <strong>${period}</strong>. This document is for your records and confirms your earnings and deductions for this pay period.`,
      `Net pay: <strong>${netPayFormatted} GMD</strong>`,
      "Your payslip is attached to this email as a PDF. Please retain it for your records.",
    ];
    if (payrollData.notes && payrollData.notes.trim() !== "") {
      bodyParagraphs.push(`Note from HR: ${payrollData.notes.trim()}`);
    }
    bodyParagraphs.push("For any questions regarding this payslip, please contact your HR department.");

    const htmlContent = renderEmailLayout({
      preheaderText: "Your payslip is ready",
      mainHeading: "Your payslip is ready",
      highlightBlock,
      bodyParagraphs,
      footerAddress: `© ${new Date().getFullYear()} HR Management System. Confidential — for the addressee only.`,
    });

    const base64Content = Buffer.from(pdfBuffer).toString("base64");
    const attachment = {
      filename: `Payslip_${employee.name.replace(/\s+/g, "_")}_${formatPeriod(payrollData.periodStart, payrollData.periodEnd).replace(/\s+/g, "_")}.pdf`,
      content: base64Content,
    };

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: `Your Payslip - ${period}`,
      html: htmlContent,
      attachments: [attachment],
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ Payslip email sent successfully to ${employee.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send payslip email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send bulk payslip notification email (summary without attachments)
 */
export const sendBulkPayslipNotification = async (
  hrContact,
  count,
  employeeNames
) => {
  try {
    const listHtml = employeeNames
      .map((name) => `${name}`)
      .join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: "Bulk payroll processed",
      mainHeading: "Bulk payroll processed",
      highlightBlock: `<strong>${count}</strong> payroll records have been finalized and payslips have been sent to the respective employees.`,
      bodyParagraphs: [
        "Processed employees:",
        listHtml,
        "All employees have received their payslips via email with PDF attachments and in-app notifications.",
        "This is an automated notification from the HR Management System.",
      ],
      footerAddress: `© ${new Date().getFullYear()} HR Management System.`,
    });

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: hrContact.email,
      subject: `Bulk Payroll Processing Complete - ${count} Payslips Sent`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ Bulk payslip notification sent to ${hrContact.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send bulk notification email:", error);
    return { success: false, error: error.message };
  }
};
