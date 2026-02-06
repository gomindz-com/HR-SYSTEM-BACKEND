import { transporter } from "../config/transporter.js";

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
 * @param {Object} employee - Employee data with name and email
 * @param {Object} payrollData - Payroll record data
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} Result object with success status
 */
export const sendPayslipEmail = async (employee, payrollData, pdfBuffer) => {
  try {
    const period = formatPeriod(payrollData.periodStart, payrollData.periodEnd);
    const netPayFormatted = formatCurrency(payrollData.netPay);

    const payDate = formatDate(payrollData.finalizedAt || payrollData.processedDate || new Date());
    const statusLabel = formatStatus(payrollData.status);
    const showPaymentMethod = payrollData.paymentMethod && payrollData.paymentMethod.trim() !== "";

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
        <tr>
          <td style="padding: 0 0 24px; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280; letter-spacing: 0.5px;">PAYSLIP NOTIFICATION</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px 0 24px;">
            <p style="margin: 0 0 8px; font-size: 16px; color: #374151;">Dear ${employee.name},</p>
            <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">
              Please find attached your payslip for the period <strong>${period}</strong>. This document is for your records and confirms your earnings and deductions for this pay period.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #374151;">Summary</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #6b7280;">Pay period</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${period}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #6b7280;">Pay date</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${payDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #6b7280;">Status</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #059669; font-weight: 500; text-align: right;">${statusLabel}</td>
                    </tr>
                    ${showPaymentMethod ? `
                    <tr>
                      <td style="padding: 6px 0; font-size: 13px; color: #6b7280;">Payment method</td>
                      <td style="padding: 6px 0; font-size: 13px; color: #111827; font-weight: 500; text-align: right;">${payrollData.paymentMethod.trim()}</td>
                    </tr>
                    ` : ""}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #111827; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px; text-align: center;">
                  <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af; letter-spacing: 0.5px;">Net pay</p>
                  <p style="margin: 0; font-size: 28px; font-weight: 600; color: #ffffff;">${netPayFormatted} GMD</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 0 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0;">
              <tr>
                <td style="padding: 16px 20px;">
                  <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #1e40af;">Attachment</p>
                  <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">Your payslip is attached to this email as a PDF. Please retain it for your records.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${payrollData.notes && payrollData.notes.trim() !== ""
          ? `
        <tr>
          <td style="padding: 0 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fffbeb; border-left: 4px solid #d97706; border-radius: 0 8px 8px 0;">
              <tr>
                <td style="padding: 16px 20px;">
                  <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #92400e;">Note from HR</p>
                  <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">${payrollData.notes.trim()}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        `
          : ""}
        <tr>
          <td style="padding: 20px 0; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; text-align: center;">
              For any questions regarding this payslip, please contact your HR department.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 0 0; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af; text-align: center; line-height: 1.5;">
              This is an automated message. Confidential — for the addressee only.<br>
              &copy; ${new Date().getFullYear()} HR Management System.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

    // Prepare attachment - ensure content is a proper base64 string
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
 * @param {Object} hrContact - HR contact information
 * @param {Number} count - Number of payslips processed
 * @param {Array} employeeNames - List of employee names
 * @returns {Promise<Object>} Result object with success status
 */
export const sendBulkPayslipNotification = async (
  hrContact,
  count,
  employeeNames
) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #10b981;">✓</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Bulk Payroll Processed</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">All payslips have been distributed</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Processing Complete</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          <strong>${count}</strong> payroll records have been finalized and payslips have been sent to the respective employees.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Processed Employees</h3>
        <div style="max-height: 200px; overflow-y: auto; margin-top: 15px;">
          ${employeeNames
        .map(
          (name) => `
            <div style="padding: 8px; border-bottom: 1px solid #e9ecef;">
              <span style="color: #10b981; margin-right: 8px;">✓</span>
              <span style="color: #2c3e50;">${name}</span>
            </div>
          `
        )
        .join("")}
        </div>
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <p style="color: #495057; margin: 0; font-size: 14px;">
          All employees have received their payslips via email with PDF attachments and in-app notifications.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated notification from the HR Management System.<br>
        © ${new Date().getFullYear()} HR Management System. All rights reserved.
      </p>
    </div>
  `;

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
