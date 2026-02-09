import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "../emails/emailLayout.js";

// ================================
// EMAIL TEMPLATE UTILITIES
// ================================

const sendBenefitEmail = async (employee, benefit, action) => {
  try {
    const actionMessages = {
      created: {
        subject: "New Benefit Assigned",
        title: "Benefit assigned",
        message: "A new benefit has been assigned to you.",
      },
      updated: {
        subject: "Benefit Updated",
        title: "Benefit updated",
        message: "Your benefit has been updated.",
      },
      activated: {
        subject: "Benefit Activated",
        title: "Benefit activated",
        message: "Your benefit has been activated.",
      },
      deactivated: {
        subject: "Benefit Deactivated",
        title: "Benefit deactivated",
        message: "Your benefit has been deactivated.",
      },
    };

    const actionInfo = actionMessages[action] || actionMessages.updated;

    const highlightBlock = [
      `Type: ${benefit.benefitType}`,
      `Amount: GMD ${benefit.amount}`,
      `Status: ${benefit.isActive ? "Active" : "Inactive"}`,
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: actionInfo.subject,
      mainHeading: actionInfo.title,
      highlightBlock,
      bodyParagraphs: [
        `Dear ${employee.name},`,
        actionInfo.message,
        "If you have any questions about this benefit, please contact the HR department.",
        "Best regards, HR Team",
      ],
    });

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: actionInfo.subject,
      html: htmlContent,
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
    const changeAmount = (newSalary - oldSalary).toFixed(2);
    const adjustmentLabel =
      adjustmentType === "percentage"
        ? `${adjustmentValue}%`
        : `GMD ${adjustmentValue}`;

    const highlightBlock = [
      `Previous salary: GMD ${oldSalary}`,
      `New salary: GMD ${newSalary}`,
      `Adjustment type: ${adjustmentType === "percentage" ? "Percentage" : "Fixed amount"}`,
      `Adjustment value: ${adjustmentLabel}`,
      `Change amount: GMD ${changeAmount}`,
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: "Salary update notification",
      mainHeading: "Salary update",
      highlightBlock,
      bodyParagraphs: [
        `Dear ${employee.name},`,
        "Your salary has been updated. Please review the details above.",
        "If you have any questions about this salary adjustment, please contact the HR department.",
        "Best regards, HR Team",
      ],
    });

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Salary Update Notification",
      html: htmlContent,
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
    const previous = oldBonus || 0;
    const changeAmount = (newBonus - previous).toFixed(2);

    const highlightBlock = [
      `Previous bonus: GMD ${previous}`,
      `New bonus: GMD ${newBonus}`,
      `Change amount: GMD ${changeAmount}`,
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: "Bonus update notification",
      mainHeading: "Bonus update",
      highlightBlock,
      bodyParagraphs: [
        `Dear ${employee.name},`,
        "Your bonus has been updated. Please review the details above.",
        "This bonus will be included in your next payroll calculation.",
        "If you have any questions about this bonus update, please contact the HR department.",
        "Best regards, HR Team",
      ],
    });

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Bonus Update Notification",
      html: htmlContent,
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
