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
          ${
            cycle.selfReviewDueDate
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

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
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

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
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

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
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

      ${review.overallRating ? `
      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Final Rating</h3>
        <div style="margin-top: 15px;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Overall Rating</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50; font-size: 24px;">${review.overallRating.toFixed(1)} / 5.0</p>
          ${review.overallRatingLabel ? `
          <p style="margin: 10px 0 5px; color: #6c757d; font-size: 14px;">Rating Label</p>
          <p style="margin: 0; font-weight: bold; color: #2c3e50;">${review.overallRatingLabel}</p>
          ` : ""}
        </div>
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

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
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

