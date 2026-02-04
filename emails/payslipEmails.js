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

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #2563eb;">💰</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Your Payslip is Ready</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Payment processed successfully</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Dear ${employee.name},</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Your payslip for <strong>${period}</strong> has been processed and is now ready for your review.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Payment Summary</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Pay Period</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${period}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Status</p>
            <p style="margin: 0; font-weight: bold; color: #10b981;">${payrollData.status}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Payment Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${formatDate(payrollData.finalizedAt || new Date())}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Payment Method</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${payrollData.paymentMethod || "Bank Transfer"}</p>
          </div>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <p style="margin: 0; color: white; font-size: 14px; opacity: 0.9; margin-bottom: 10px;">NET PAY</p>
        <h2 style="margin: 0; color: white; font-size: 36px; font-weight: bold;">${netPayFormatted} gmd</h2>
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #2563eb; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #1e40af; margin-top: 0; font-size: 16px;">📎 Payslip Attached</h3>
        <p style="color: #495057; margin: 0; font-size: 14px;">
          Your detailed payslip is attached to this email as a PDF document. Please download and keep it for your records.
        </p>
      </div>

      ${payrollData.notes
        ? `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #856404; margin-top: 0; font-size: 16px;">📝 Note from HR</h3>
        <p style="color: #856404; margin: 0; font-size: 14px;">${payrollData.notes}</p>
      </div>
      `
        : ""
      }

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          If you have any questions about your payslip, please contact the HR department.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        This document is confidential and intended for the named recipient only.<br>
        © ${new Date().getFullYear()} HR Management System. All rights reserved.
      </p>
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
