import { transporter } from "../config/transporter.js";

// Email template for leave request submitted confirmation
export const sendLeaveRequestSubmittedEmail = async (
  employee,
  leaveRequest
) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #007bff;">📋</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Leave Request Submitted</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your request is pending review</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Request Confirmed</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          Your leave request has been successfully submitted and is now pending manager approval.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Leave Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Leave Type</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.leaveType}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Duration</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.days} day(s)</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Start Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">End Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
          </div>
        </div>
        ${
          leaveRequest.comments
            ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Your Comments</p>
          <p style="margin: 0; color: #2c3e50; font-size: 14px;">${leaveRequest.comments}</p>
        </div>
        `
            : ""
        }
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #0056b3; margin-top: 0; font-size: 16px;">⏳ Next Steps</h3>
        <p style="color: #495057; margin: 0; font-size: 14px;">
          Your manager will review your request. You will receive an email notification once a decision has been made.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Questions about your leave request? Contact your manager or HR department.
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
      subject: "Leave Request Submitted - Pending Review",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Leave request submitted email sent to ${employee.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send leave request submitted email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for manager approval
export const sendManagerApprovalEmail = async (employee, leaveRequest) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #28a745;">✓</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Leave Request Approved by Manager</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Pending HR final approval</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Good News!</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          Your manager has <strong>approved</strong> your leave request.
        </p>
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 5px 0; color: #856404; font-size: 14px;"><strong>⏳ Next Step:</strong></p>
        <p style="margin: 5px 0; color: #856404; font-size: 14px;">Your request is now pending <strong>HR approval</strong> for final confirmation.</p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Leave Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Leave Type</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.leaveType}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Duration</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.days} day(s)</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Start Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">End Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
          </div>
        </div>
        ${
          leaveRequest.comments
            ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Your Comments</p>
          <p style="margin: 0; color: #2c3e50; font-size: 14px;">${leaveRequest.comments}</p>
        </div>
        `
            : ""
        }
      </div>

      <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
        You will receive another notification once HR reviews your request.
      </p>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          If you have any questions, please contact your supervisor or HR department.
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
      subject: "Leave Request Approved by Manager - Pending HR Review",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Manager approval email sent to ${employee.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager approval email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for manager rejection
export const sendManagerRejectionEmail = async (
  employee,
  leaveRequest,
  rejectReason
) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #e74c3c 0%, #c82333 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #e74c3c;">✗</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Leave Request Rejected by Manager</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">HR may review this decision</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Request Status Update</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          Your manager has <strong>rejected</strong> your leave request.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Leave Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Leave Type</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.leaveType}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Duration</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.days} day(s)</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Start Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">End Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
          </div>
        </div>
        ${
          leaveRequest.comments
            ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Your Comments</p>
          <p style="margin: 0; color: #2c3e50; font-size: 14px;">${leaveRequest.comments}</p>
        </div>
        `
            : ""
        }
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="margin-top: 0; color: #856404; font-size: 16px;">Manager's Rejection Reason:</h3>
        <p style="margin: 5px 0; color: #856404; font-size: 14px;"><strong>${rejectReason}</strong></p>
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <p style="color: #0056b3; margin: 0; font-size: 14px;">
          <strong>Note:</strong> HR may review this decision. You will be notified if there are any updates.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          If you have questions about this decision, please contact your manager or HR department.
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
      subject: "Leave Request Rejected by Manager",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Manager rejection email sent to ${employee.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager rejection email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for HR approval
export const sendHRApprovalEmail = async (
  employee,
  leaveRequest,
  wasManagerApproved,
  wasManagerRejected
) => {
  try {
    let approvalContext = "";
    if (wasManagerApproved) {
      approvalContext =
        "Your manager approved your request, and HR has now given final approval.";
    } else if (wasManagerRejected) {
      approvalContext =
        "Although your manager rejected your request, HR has reviewed and approved it.";
    } else {
      approvalContext = "HR has approved your leave request.";
    }

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #28a745;">✅</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Leave Request Fully Approved!</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your leave is now confirmed</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Final Approval Confirmed</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          ${approvalContext} Your leave is now <strong>fully approved and confirmed</strong>.
        </p>
      </div>

      <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="margin: 5px 0; color: #155724; font-size: 14px;"><strong>✓ Manager Approved</strong></p>
        <p style="margin: 5px 0; color: #155724; font-size: 14px;"><strong>✓ HR Approved</strong></p>
        <p style="margin: 5px 0; color: #155724; font-size: 14px;">Your leave balance has been updated.</p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Leave Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Leave Type</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.leaveType}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Duration</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.days} day(s)</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Start Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">End Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
          </div>
        </div>
        ${
          leaveRequest.comments
            ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Your Comments</p>
          <p style="margin: 0; color: #2c3e50; font-size: 14px;">${leaveRequest.comments}</p>
        </div>
        `
            : ""
        }
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #0056b3; margin-top: 0; font-size: 16px;">📋 Important Reminder</h3>
        <p style="color: #495057; margin: 0; font-size: 14px;">
          Please ensure all your work is properly handed over before your leave period begins.
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          If you have any questions, please contact your supervisor or HR department.
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    const subject = wasManagerRejected
      ? "Leave Request Approved by HR (Override)"
      : "Leave Request Fully Approved by HR";

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
      to: employee.email,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ HR approval email sent to ${employee.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send HR approval email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for HR rejection
export const sendHRRejectionEmail = async (
  employee,
  leaveRequest,
  hrRejectReason,
  wasManagerApproved
) => {
  try {
    let rejectionContext = "";
    if (wasManagerApproved) {
      rejectionContext =
        "Although your manager approved your request, HR has reviewed and rejected it after final consideration.";
    } else {
      rejectionContext = "HR has reviewed your leave request and rejected it.";
    }

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #dc3545;">✗</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Leave Request Rejected by HR</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Final decision</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Request Status Update</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${employee.name}</strong>,<br><br>
          ${rejectionContext}
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Leave Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Leave Type</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.leaveType}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Duration</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${leaveRequest.days} day(s)</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Start Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">End Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
          </div>
        </div>
        ${
          leaveRequest.comments
            ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Your Comments</p>
          <p style="margin: 0; color: #2c3e50; font-size: 14px;">${leaveRequest.comments}</p>
        </div>
        `
            : ""
        }
      </div>

      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <h3 style="margin-top: 0; color: #856404; font-size: 16px;">HR Rejection Reason:</h3>
        <p style="margin: 5px 0; color: #856404; font-size: 14px;"><strong>${hrRejectReason}</strong></p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          If you have questions about this decision, please contact the HR department.
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
      subject: "Leave Request Rejected by HR",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ HR rejection email sent to ${employee.email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send HR rejection email:", error);
    return { success: false, error: error.message };
  }
};
