import { transporter } from "../config/transporter.js";

// ================================
// EMAIL TEMPLATE UTILITIES
// ================================

const sendBenefitEmail = async (employee, benefit, action) => {
  try {
    const actionMessages = {
      created: {
        subject: "New Benefit Assigned",
        title: "Benefit Assigned",
        message: `A new benefit has been assigned to you.`,
      },
      updated: {
        subject: "Benefit Updated",
        title: "Benefit Updated",
        message: `Your benefit has been updated.`,
      },
      activated: {
        subject: "Benefit Activated",
        title: "Benefit Activated",
        message: `Your benefit has been activated.`,
      },
      deactivated: {
        subject: "Benefit Deactivated",
        title: "Benefit Deactivated",
        message: `Your benefit has been deactivated.`,
      },
    };

    const actionInfo = actionMessages[action] || actionMessages.updated;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: actionInfo.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            <h2 style="color: #007bff; margin-top: 0;">${actionInfo.title}</h2>
            <p>Dear ${employee.name},</p>
            <p>${actionInfo.message}</p>
            
            <div style="background: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #dee2e6;">
              <h3 style="color: #495057; margin-top: 0;">Benefit Details:</h3>
              <p><strong>Type:</strong> ${benefit.benefitType}</p>
              <p><strong>Amount:</strong> GMD ${benefit.amount}</p>
              <p><strong>Status:</strong> ${benefit.isActive ? "Active" : "Inactive"}</p>
            </div>
            
            <p>If you have any questions about this benefit, please contact the HR department.</p>
            <p>Best regards,<br>HR Team</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(emailContent);
    console.log(
      `Benefit ${action} email sent successfully to ${employee.email}`
    );
  } catch (error) {
    console.error(
      `Failed to send benefit ${action} email to ${employee.email}:`,
      error
    );
    // Don't throw error - email failure shouldn't break the main operation
  }
};

const sendSalaryUpdateEmail = async (
  employee,
  oldSalary,
  newSalary,
  adjustmentType,
  adjustmentValue
) => {
  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Salary Update Notification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h2 style="color: #28a745; margin-top: 0;">Salary Update</h2>
            <p>Dear ${employee.name},</p>
            <p>Your salary has been updated. Please review the details below:</p>
            
            <div style="background: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #dee2e6;">
              <h3 style="color: #495057; margin-top: 0;">Salary Details:</h3>
              <p><strong>Previous Salary:</strong> GMD ${oldSalary}</p>
              <p><strong>New Salary:</strong> GMD ${newSalary}</p>
              <p><strong>Adjustment Type:</strong> ${adjustmentType === "percentage" ? "Percentage" : "Fixed Amount"}</p>
              <p><strong>Adjustment Value:</strong> ${adjustmentType === "percentage" ? `${adjustmentValue}%` : `GMD ${adjustmentValue}`}</p>
              <p><strong>Change Amount:</strong> GMD ${(newSalary - oldSalary).toFixed(2)}</p>
            </div>
            
            <p>If you have any questions about this salary adjustment, please contact the HR department.</p>
            <p>Best regards,<br>HR Team</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(emailContent);
    console.log(`Salary update email sent successfully to ${employee.email}`);
  } catch (error) {
    console.error(
      `Failed to send salary update email to ${employee.email}:`,
      error
    );
  }
};

const sendBonusUpdateEmail = async (employee, oldBonus, newBonus) => {
  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Bonus Update Notification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8;">
            <h2 style="color: #17a2b8; margin-top: 0;">Bonus Update</h2>
            <p>Dear ${employee.name},</p>
            <p>Your bonus has been updated. Please review the details below:</p>
            
            <div style="background: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #dee2e6;">
              <h3 style="color: #495057; margin-top: 0;">Bonus Details:</h3>
              <p><strong>Previous Bonus:</strong> GMD ${oldBonus || 0}</p>
              <p><strong>New Bonus:</strong> GMD ${newBonus}</p>
              <p><strong>Change Amount:</strong> GMD ${(newBonus - (oldBonus || 0)).toFixed(2)}</p>
            </div>
            
            <p>This bonus will be included in your next payroll calculation.</p>
            <p>If you have any questions about this bonus update, please contact the HR department.</p>
            <p>Best regards,<br>HR Team</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(emailContent);
    console.log(`Bonus update email sent successfully to ${employee.email}`);
  } catch (error) {
    console.error(
      `Failed to send bonus update email to ${employee.email}:`,
      error
    );
  }
};

export {
  sendBenefitEmail,
  sendSalaryUpdateEmail,
  sendBonusUpdateEmail,
};
