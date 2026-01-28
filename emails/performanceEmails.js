import { transporter } from "../config/transporter.js";

// Email template for cycle activated notification
export const sendCycleActivatedEmail = async (employee, cycle) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #007bff;">📊</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Performance Review Cycle Started</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Time to complete your self-review</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Review Cycle Activated</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          A new performance review cycle has been activated. Please complete your self-review by the due date.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Review Cycle Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Cycle Name</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${cycle.name}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Start Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(cycle.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">End Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(cycle.endDate).toLocaleDateString()}</p>
          </div>
          ${cycle.selfReviewDueDate
        ? `
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Self-Review Due</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(cycle.selfReviewDueDate).toLocaleDateString()}</p>
          </div>
          `
        : ""
      }
        </div>
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #0056b3; margin-top: 0; font-size: 16px;">⏳ Next Steps</h3>
        <p style="color: #495057; margin: 0; font-size: 14px;">
          Please log in to your HR portal and complete your self-review. Your manager will review your responses after you submit.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Questions about the review process? Contact your manager or HR department.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: `Performance Review Cycle Started: ${cycle.name}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send cycle activated email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for self-review submitted notification (to manager)
export const sendSelfReviewSubmittedEmail = async (manager, employee, review) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #28a745;">✓</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Self-Review Submitted</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Ready for your review</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Action Required</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${manager.name}</strong>,<br><br>
          <strong>${employee.name}</strong> has completed their self-review and it's now ready for your review and feedback.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Employee Details</h3>
        <div style="margin-top: 15px;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Employee Name</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">${employee.name}</p>
          ${employee.position ? `
          <p style="margin: 10px 0 5px; color: #6c757d; font-size: 14px;">Position</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">${employee.position}</p>
          ` : ""}
        </div>
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 5px 0; color: #856404; font-size: 14px;"><strong>⏳ Next Step:</strong></p>
        <p style="margin: 5px 0; color: #856404; font-size: 14px;">Please review ${employee.name}'s self-assessment and provide your feedback by the manager review due date.</p>
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <p style="color: #0056b3; margin: 0; font-size: 14px;">
          <strong>Note:</strong> Log in to your HR portal to access the review and provide your assessment.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          If you have any questions, please contact the HR department.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: manager.email,
      subject: `Performance Review Ready: ${employee.name}'s Self-Review Submitted`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send self-review submitted email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for self-review ready for HR finalization (to admin, when manager review not required)
export const sendReviewReadyForHrEmail = async (admin, employee, review) => {
  try {
    const cycleName = review.cycle?.name || "Performance Review";
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #6f42c1;">📋</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Review Ready for HR Finalization</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Self-review submitted, awaiting HR action</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Action Required</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${admin.name}</strong>,<br><br>
          <strong>${employee.name}</strong> has submitted their self-review for <strong>${cycleName}</strong>. 
          Manager review is not required for this cycle, so the review is ready for HR finalization.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Employee Details</h3>
        <div style="margin-top: 15px;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Employee Name</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">${employee.name}</p>
          ${employee.position ? `
          <p style="margin: 10px 0 5px; color: #6c757d; font-size: 14px;">Position</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">${employee.position}</p>
          ` : ""}
        </div>
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 5px 0; color: #856404; font-size: 14px;"><strong>⏳ Next Step:</strong></p>
        <p style="margin: 5px 0; color: #856404; font-size: 14px;">Please log in to the HR portal, go to Performance → Reviews to Finalize, and complete the finalization for this review.</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          This is an automated notification. Manager review was skipped per company settings.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: admin.email,
      subject: `Performance Review Ready for Finalization: ${employee.name} – ${cycleName}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send review ready for HR email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for manager review submitted notification (to employee)
export const sendManagerReviewSubmittedEmail = async (employee, manager, review) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #17a2b8;">📝</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Manager Review Completed</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your manager has submitted their review</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Review Update</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          Your manager <strong>${manager.name}</strong> has completed their review of your performance. 
          ${review.overallRating ? `Your overall rating is <strong>${review.overallRatingLabel || review.overallRating}</strong>.` : ""}
        </p>
      </div>

      ${review.overallRating ? `
      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Overall Rating</h3>
        <div style="margin-top: 15px;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Rating</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 24px;">${review.overallRating.toFixed(1)} / 5.0</p>
          ${review.overallRatingLabel ? `
          <p style="margin: 10px 0 5px; color: #6c757d; font-size: 14px;">Label</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">${review.overallRatingLabel}</p>
          ` : ""}
        </div>
      </div>
      ` : ""}

      ${review.managerComments ? `
      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #0056b3; margin-top: 0; font-size: 16px;">Manager Comments</h3>
        <p style="color: #495057; margin: 0; font-size: 14px; line-height: 1.6;">${review.managerComments}</p>
      </div>
      ` : ""}

      <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="margin: 5px 0; color: #155724; font-size: 14px;"><strong>✓ Review Status:</strong></p>
        <p style="margin: 5px 0; color: #155724; font-size: 14px;">Your performance review has been completed. The review will be finalized by HR shortly.</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Log in to your HR portal to view the complete review details.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Manager Review Completed - Performance Review Update",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager review submitted email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for review finalized notification (to employee)
export const sendReviewFinalizedEmail = async (employee, review) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #6f42c1;">✅</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Performance Review Finalized</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Please acknowledge your review</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Review Finalized</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          Your performance review has been finalized by HR. Please review the details and acknowledge the review to complete the process.
        </p>
      </div>

      ${review.averageRating ? `
      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Final Rating</h3>
        <div style="margin-top: 15px;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Average Rating</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 24px;">${review.averageRating.toFixed(1)} / 5.0</p>
          ${review.averageRatingLabel ? `
          <p style="margin: 10px 0 5px; color: #6c757d; font-size: 14px;">Rating Label</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">${review.averageRatingLabel}</p>
          ` : ""}
        </div>
        ${(review.employeeRating !== null || review.overallRating !== null || review.hrRating !== null) ? `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 12px; font-weight: bold;">Rating Breakdown</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px;">
            ${review.employeeRating !== null ? `
            <div>
              <p style="margin: 0; color: #6c757d; font-size: 11px;">Employee</p>
              <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 14px;">${review.employeeRating.toFixed(1)}</p>
            </div>
            ` : ""}
            ${review.overallRating !== null ? `
            <div>
              <p style="margin: 0; color: #6c757d; font-size: 11px;">Manager</p>
              <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 14px;">${review.overallRating.toFixed(1)}</p>
            </div>
            ` : ""}
            ${review.hrRating !== null ? `
            <div>
              <p style="margin: 0; color: #6c757d; font-size: 11px;">HR</p>
              <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 14px;">${review.hrRating.toFixed(1)}</p>
            </div>
            ` : ""}
          </div>
        </div>
        ` : ""}
      </div>
      ` : ""}

      ${review.managerComments ? `
      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #0056b3; margin-top: 0; font-size: 16px;">Manager Feedback</h3>
        <p style="color: #495057; margin: 0; font-size: 14px; line-height: 1.6;">${review.managerComments}</p>
      </div>
      ` : ""}

      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 5px 0; color: #856404; font-size: 14px;"><strong>⏳ Action Required:</strong></p>
        <p style="margin: 5px 0; color: #856404; font-size: 14px;">Please log in to your HR portal to review and acknowledge your performance review.</p>
      </div>

      <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="margin: 5px 0; color: #155724; font-size: 14px;"><strong>✓ Review Status:</strong></p>
        <p style="margin: 5px 0; color: #155724; font-size: 14px;">Your review has been finalized and is ready for your acknowledgment.</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          If you have any questions or concerns about your review, please contact your manager or HR department.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Performance Review Finalized - Action Required",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send review finalized email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for self-review reminder
export const sendSelfReviewReminderEmail = async (employee, cycle, daysLeft) => {
  try {
    const urgencyColor = daysLeft <= 1 ? "#dc3545" : daysLeft <= 3 ? "#ffc107" : "#007bff";
    const urgencyText = daysLeft <= 1 ? "URGENT" : daysLeft <= 3 ? "Reminder" : "Friendly Reminder";

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px;">⏰</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">${urgencyText}: Self-Review Due</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Self-Review Reminder</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          This is a reminder that your self-review for the <strong>${cycle.name}</strong> performance cycle is due soon.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Review Details</h3>
        <div style="margin-top: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #6c757d;">Cycle Name:</span>
            <strong style="color: #2c3e50;">${cycle.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #6c757d;">Self-Review Due Date:</span>
            <strong style="color: #2c3e50;">${new Date(cycle.selfReviewDueDate).toLocaleDateString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6c757d;">Days Remaining:</span>
            <strong style="color: ${urgencyColor};">${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong>
          </div>
        </div>
      </div>

      <div style="background: ${daysLeft <= 1 ? "#f8d7da" : "#fff3cd"}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${daysLeft <= 1 ? "#dc3545" : "#ffc107"};">
        <p style="margin: 5px 0; color: ${daysLeft <= 1 ? "#721c24" : "#856404"}; font-size: 14px;">
          <strong>${daysLeft <= 1 ? "⚠️ Urgent Action Required:" : "⏳ Action Required:"}</strong>
        </p>
        <p style="margin: 5px 0; color: ${daysLeft <= 1 ? "#721c24" : "#856404"}; font-size: 14px;">
          Please complete your self-review before the due date to ensure your feedback is included in the performance evaluation process.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Log in to your HR portal to complete your self-review.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated reminder. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: `${daysLeft <= 1 ? "⚠️ URGENT: " : ""}Self-Review Due in ${daysLeft} Day${daysLeft !== 1 ? "s" : ""} - ${cycle.name}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send self-review reminder email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for manager review reminder
export const sendManagerReviewReminderEmail = async (manager, employee, cycle, daysLeft) => {
  try {
    const urgencyColor = daysLeft <= 1 ? "#dc3545" : daysLeft <= 3 ? "#ffc107" : "#17a2b8";
    const urgencyText = daysLeft <= 1 ? "URGENT" : daysLeft <= 3 ? "Reminder" : "Friendly Reminder";

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px;">📋</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">${urgencyText}: Manager Review Due</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Manager Review Reminder</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${manager.name}</strong>,<br><br>
          This is a reminder that your review of <strong>${employee.name}</strong> for the <strong>${cycle.name}</strong> performance cycle is due soon.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Review Details</h3>
        <div style="margin-top: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #6c757d;">Employee:</span>
            <strong style="color: #2c3e50;">${employee.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #6c757d;">Cycle Name:</span>
            <strong style="color: #2c3e50;">${cycle.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #6c757d;">Manager Review Due Date:</span>
            <strong style="color: #2c3e50;">${new Date(cycle.managerReviewDueDate).toLocaleDateString()}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6c757d;">Days Remaining:</span>
            <strong style="color: ${urgencyColor};">${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong>
          </div>
        </div>
      </div>

      <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="margin: 5px 0; color: #155724; font-size: 14px;"><strong>✓ Note:</strong></p>
        <p style="margin: 5px 0; color: #155724; font-size: 14px;">
          ${employee.name} has already completed their self-review and is waiting for your feedback.
        </p>
      </div>

      <div style="background: ${daysLeft <= 1 ? "#f8d7da" : "#fff3cd"}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${daysLeft <= 1 ? "#dc3545" : "#ffc107"};">
        <p style="margin: 5px 0; color: ${daysLeft <= 1 ? "#721c24" : "#856404"}; font-size: 14px;">
          <strong>${daysLeft <= 1 ? "⚠️ Urgent Action Required:" : "⏳ Action Required:"}</strong>
        </p>
        <p style="margin: 5px 0; color: ${daysLeft <= 1 ? "#721c24" : "#856404"}; font-size: 14px;">
          Please complete your review of ${employee.name} before the due date.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Log in to your HR portal to complete the review.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated reminder. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: manager.email,
      subject: `${daysLeft <= 1 ? "⚠️ URGENT: " : ""}Manager Review Due in ${daysLeft} Day${daysLeft !== 1 ? "s" : ""} - ${employee.name}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager review reminder email:", error);
    return { success: false, error: error.message };
  }
};

