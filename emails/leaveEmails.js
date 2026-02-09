import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "./emailLayout.js";

function getFrom() {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
  const fromName =
    (process.env.RESEND_FROM_NAME && process.env.RESEND_FROM_NAME.trim()) ||
    "GOMINDZ HR SYSTEM";
  return { fromEmail, fromName };
}

function leaveDetailsBlock(leaveRequest) {
  const lines = [
    `Leave type: ${leaveRequest.leaveType}`,
    `Duration: ${leaveRequest.days} day(s)`,
    `Start date: ${new Date(leaveRequest.startDate).toLocaleDateString()}`,
    `End date: ${new Date(leaveRequest.endDate).toLocaleDateString()}`,
  ];
  if (leaveRequest.comments) {
    lines.push(`Comments: ${leaveRequest.comments}`);
  }
  return lines.join("<br />");
}

export const sendLeaveRequestSubmittedEmail = async (employee, leaveRequest) => {
  try {
    const htmlContent = renderEmailLayout({
      preheaderText: "Leave request submitted - pending review",
      mainHeading: "Leave request submitted",
      highlightBlock: leaveDetailsBlock(leaveRequest),
      bodyParagraphs: [
        `Dear ${employee.name},`,
        "Your leave request has been successfully submitted and is now pending manager approval.",
        "Your manager will review your request. You will receive an email notification once a decision has been made.",
        "Questions about your leave request? Contact your manager or HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Leave Request Submitted - Pending Review",
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send leave request submitted email:", error);
    return { success: false, error: error.message };
  }
};

export const sendManagerApprovalEmail = async (employee, leaveRequest) => {
  try {
    const htmlContent = renderEmailLayout({
      preheaderText: "Leave request approved by manager - pending HR review",
      mainHeading: "Leave request approved by manager",
      highlightBlock: leaveDetailsBlock(leaveRequest),
      bodyParagraphs: [
        `Dear ${employee.name},`,
        "Your manager has approved your leave request.",
        "Your request is now pending HR approval for final confirmation. You will receive another notification once HR reviews your request.",
        "If you have any questions, please contact your supervisor or HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Leave Request Approved by Manager - Pending HR Review",
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager approval email:", error);
    return { success: false, error: error.message };
  }
};

export const sendManagerRejectionEmail = async (
  employee,
  leaveRequest,
  rejectReason
) => {
  try {
    const highlight = leaveDetailsBlock(leaveRequest) + (rejectReason ? `<br /><br /><strong>Manager's reason:</strong> ${rejectReason}` : "");
    const htmlContent = renderEmailLayout({
      preheaderText: "Leave request rejected by manager",
      mainHeading: "Leave request rejected by manager",
      highlightBlock: highlight,
      bodyParagraphs: [
        `Dear ${employee.name},`,
        "Your manager has rejected your leave request.",
        "HR may review this decision. You will be notified if there are any updates.",
        "If you have questions about this decision, please contact your manager or HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Leave Request Rejected by Manager",
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager rejection email:", error);
    return { success: false, error: error.message };
  }
};

export const sendHRApprovalEmail = async (
  employee,
  leaveRequest,
  wasManagerApproved,
  wasManagerRejected
) => {
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

  try {
    const htmlContent = renderEmailLayout({
      preheaderText: "Leave request fully approved",
      mainHeading: "Leave request fully approved",
      highlightBlock: leaveDetailsBlock(leaveRequest),
      bodyParagraphs: [
        `Dear ${employee.name},`,
        `${approvalContext} Your leave is now fully approved and confirmed. Your leave balance has been updated.`,
        "Please ensure all your work is properly handed over before your leave period begins.",
        "If you have any questions, please contact your supervisor or HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
    });
    const { fromEmail, fromName } = getFrom();
    const subject = wasManagerRejected
      ? "Leave Request Approved by HR (Override)"
      : "Leave Request Fully Approved by HR";
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send HR approval email:", error);
    return { success: false, error: error.message };
  }
};

export const sendHRRejectionEmail = async (
  employee,
  leaveRequest,
  hrRejectReason,
  wasManagerApproved
) => {
  let rejectionContext = "";
  if (wasManagerApproved) {
    rejectionContext =
      "Although your manager approved your request, HR has reviewed and rejected it after final consideration.";
  } else {
    rejectionContext = "HR has reviewed your leave request and rejected it.";
  }

  try {
    const highlight = leaveDetailsBlock(leaveRequest) + (hrRejectReason ? `<br /><br /><strong>HR reason:</strong> ${hrRejectReason}` : "");
    const htmlContent = renderEmailLayout({
      preheaderText: "Leave request rejected by HR",
      mainHeading: "Leave request rejected by HR",
      highlightBlock: highlight,
      bodyParagraphs: [
        `Dear ${employee.name},`,
        rejectionContext,
        "If you have questions about this decision, please contact the HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Leave Request Rejected by HR",
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send HR rejection email:", error);
    return { success: false, error: error.message };
  }
};
