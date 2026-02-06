import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "./emailLayout.js";

const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";

function getFrom() {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
  const fromName =
    (process.env.RESEND_FROM_NAME && process.env.RESEND_FROM_NAME.trim()) ||
    "GOMINDZ HR SYSTEM";
  return { fromEmail, fromName };
}

export const sendCycleActivatedEmail = async (employee, cycle) => {
  try {
    const lines = [
      `Cycle: ${cycle.name}`,
      `Start date: ${new Date(cycle.startDate).toLocaleDateString()}`,
      `End date: ${new Date(cycle.endDate).toLocaleDateString()}`,
    ];
    if (cycle.selfReviewDueDate) {
      lines.push(`Self-review due: ${new Date(cycle.selfReviewDueDate).toLocaleDateString()}`);
    }
    const htmlContent = renderEmailLayout({
      preheaderText: "Performance review cycle started",
      mainHeading: "Performance review cycle started",
      highlightBlock: lines.join("<br />"),
      bodyParagraphs: [
        `Dear ${employee.name},`,
        "A new performance review cycle has been activated. Please complete your self-review by the due date.",
        "Please log in to your HR portal to complete your self-review. Your manager will review your responses after you submit.",
        "Questions about the review process? Contact your manager or HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Complete self-review", href: clientUrl },
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: `Performance Review Cycle Started: ${cycle.name}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send cycle activated email:", error);
    return { success: false, error: error.message };
  }
};

export const sendSelfReviewSubmittedEmail = async (manager, employee, review) => {
  try {
    const details = [
      `Employee: ${employee.name}`,
      ...(employee.position ? [`Position: ${employee.position}`] : []),
    ].join("<br />");
    const htmlContent = renderEmailLayout({
      preheaderText: "Self-review submitted",
      mainHeading: "Self-review submitted",
      highlightBlock: details,
      bodyParagraphs: [
        `Dear ${manager.name},`,
        `<strong>${employee.name}</strong> has completed their self-review and it's now ready for your review and feedback.`,
        `Please review ${employee.name}'s self-assessment and provide your feedback by the manager review due date. Log in to your HR portal to access the review.`,
        "If you have any questions, please contact the HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: manager.email,
      subject: `Performance Review Ready: ${employee.name}'s Self-Review Submitted`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send self-review submitted email:", error);
    return { success: false, error: error.message };
  }
};

export const sendReviewReadyForHrEmail = async (admin, employee, review) => {
  try {
    const cycleName = review.cycle?.name || "Performance Review";
    const details = [
      `Employee: ${employee.name}`,
      ...(employee.position ? [`Position: ${employee.position}`] : []),
      `Cycle: ${cycleName}`,
    ].join("<br />");
    const htmlContent = renderEmailLayout({
      preheaderText: "Review ready for HR finalization",
      mainHeading: "Review ready for HR finalization",
      highlightBlock: details,
      bodyParagraphs: [
        `Dear ${admin.name},`,
        `<strong>${employee.name}</strong> has submitted their self-review for <strong>${cycleName}</strong>. Manager review is not required for this cycle, so the review is ready for HR finalization.`,
        "Please log in to the HR portal, go to Performance → Reviews to Finalize, and complete the finalization for this review.",
        "This is an automated notification. Manager review was skipped per company settings.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Finalize review", href: clientUrl },
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: admin.email,
      subject: `Performance Review Ready for Finalization: ${employee.name} – ${cycleName}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send review ready for HR email:", error);
    return { success: false, error: error.message };
  }
};

export const sendManagerReviewSubmittedEmail = async (employee, manager, review) => {
  try {
    let highlightParts = [`Manager: ${manager.name}`];
    if (review.overallRating != null) {
      highlightParts.push(`Overall rating: ${(review.overallRatingLabel || review.overallRating)} (${review.overallRating.toFixed(1)}/5.0)`);
    }
    if (review.managerComments) {
      highlightParts.push(`Manager comments: ${review.managerComments}`);
    }
    const htmlContent = renderEmailLayout({
      preheaderText: "Manager review completed",
      mainHeading: "Manager review completed",
      highlightBlock: highlightParts.join("<br />"),
      bodyParagraphs: [
        `Dear ${employee.name},`,
        `Your manager <strong>${manager.name}</strong> has completed their review of your performance.`,
        "Your performance review has been completed. The review will be finalized by HR shortly.",
        "Log in to your HR portal to view the complete review details.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Manager Review Completed - Performance Review Update",
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager review submitted email:", error);
    return { success: false, error: error.message };
  }
};

export const sendReviewFinalizedEmail = async (employee, review) => {
  try {
    const parts = [];
    if (review.averageRating != null) {
      parts.push(`Average rating: ${review.averageRating.toFixed(1)}/5.0`);
      if (review.averageRatingLabel) parts.push(`Label: ${review.averageRatingLabel}`);
    }
    if (review.managerComments) parts.push(`Manager feedback: ${review.managerComments}`);
    const highlightBlock = parts.length ? parts.join("<br />") : "Your review has been finalized by HR.";

    const htmlContent = renderEmailLayout({
      preheaderText: "Performance review finalized",
      mainHeading: "Performance review finalized",
      highlightBlock,
      bodyParagraphs: [
        `Dear ${employee.name},`,
        "Your performance review has been finalized by HR. Please review the details and acknowledge the review to complete the process.",
        "Your review has been finalized and is ready for your acknowledgment.",
        "If you have any questions or concerns about your review, please contact your manager or HR department.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "View and acknowledge review", href: clientUrl },
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: "Performance Review Finalized - Action Required",
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send review finalized email:", error);
    return { success: false, error: error.message };
  }
};

export const sendSelfReviewReminderEmail = async (employee, cycle, daysLeft) => {
  try {
    const lines = [
      `Cycle: ${cycle.name}`,
      `Self-review due: ${new Date(cycle.selfReviewDueDate).toLocaleDateString()}`,
      `Days remaining: ${daysLeft}`,
    ].join("<br />");
    const htmlContent = renderEmailLayout({
      preheaderText: `Self-review due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
      mainHeading: `${daysLeft <= 1 ? "Urgent: " : ""}Self-review due`,
      highlightBlock: lines,
      bodyParagraphs: [
        `Dear ${employee.name},`,
        `This is a reminder that your self-review for the <strong>${cycle.name}</strong> performance cycle is due soon.`,
        "Please complete your self-review before the due date to ensure your feedback is included in the performance evaluation process.",
        "Log in to your HR portal to complete your self-review.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Complete self-review", href: clientUrl },
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: employee.email,
      subject: `${daysLeft <= 1 ? "⚠️ URGENT: " : ""}Self-Review Due in ${daysLeft} Day${daysLeft !== 1 ? "s" : ""} - ${cycle.name}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send self-review reminder email:", error);
    return { success: false, error: error.message };
  }
};

export const sendManagerReviewReminderEmail = async (manager, employee, cycle, daysLeft) => {
  try {
    const lines = [
      `Employee: ${employee.name}`,
      `Cycle: ${cycle.name}`,
      `Manager review due: ${new Date(cycle.managerReviewDueDate).toLocaleDateString()}`,
      `Days remaining: ${daysLeft}`,
    ].join("<br />");
    const htmlContent = renderEmailLayout({
      preheaderText: `Manager review due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
      mainHeading: `${daysLeft <= 1 ? "Urgent: " : ""}Manager review due`,
      highlightBlock: lines,
      bodyParagraphs: [
        `Dear ${manager.name},`,
        `This is a reminder that your review of <strong>${employee.name}</strong> for the <strong>${cycle.name}</strong> performance cycle is due soon.`,
        `${employee.name} has already completed their self-review and is waiting for your feedback.`,
        "Please complete your review of " + employee.name + " before the due date. Log in to your HR portal to complete the review.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Complete manager review", href: clientUrl },
    });
    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: manager.email,
      subject: `${daysLeft <= 1 ? "⚠️ URGENT: " : ""}Manager Review Due in ${daysLeft} Day${daysLeft !== 1 ? "s" : ""} - ${employee.name}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send manager review reminder email:", error);
    return { success: false, error: error.message };
  }
};
