import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "./emailLayout.js";

const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";
const subscriptionUrl = `${clientUrl}/subscription`;

export const sendTrialExpiringEmail = async (
  company,
  subscription,
  daysLeft
) => {
  try {
    const trialEndStr = new Date(subscription.trialEndDate).toLocaleDateString();
    const highlightBlock = [
      `Plan: ${subscription.plan.name}`,
      `Monthly cost: ${subscription.plan.price.toLocaleString()} GMD`,
      `Trial ends: ${trialEndStr}`,
      "Status: TRIAL",
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: `Trial expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
      mainHeading: "Trial expiring soon",
      highlightBlock,
      bodyParagraphs: [
        `Dear <strong>${company.companyName}</strong>,`,
        `Your free trial will expire on <strong>${trialEndStr}</strong>. To continue using our HR management system, please upgrade to a paid subscription.`,
        `You have <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining</strong>. If your trial expires, you will lose access to employee management, attendance, leave, payroll, reports, and premium features.`,
        "Questions about upgrading? Contact support.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Upgrade now", href: subscriptionUrl },
    });

    const recipientEmail = company.companyEmail || company.hr?.email;

    if (!recipientEmail) {
      console.error(
        `No email address found for company ${company.companyName} (ID: ${company.id})`
      );
      return { success: false, error: "No email address found for company" };
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Trial Expiring in ${daysLeft} Day${daysLeft > 1 ? "s" : ""} - Upgrade Required`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Trial expiring email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send trial expiring email:", error);
    return { success: false, error: error.message };
  }
};

export const sendTrialExpiredEmail = async (company, subscription) => {
  try {
    const trialEndStr = new Date(subscription.trialEndDate).toLocaleDateString();
    const highlightBlock = [
      `Plan: ${subscription.plan.name}`,
      `Monthly cost: ${subscription.plan.price.toLocaleString()} GMD`,
      `Trial ended: ${trialEndStr}`,
      "Status: EXPIRED",
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: "Trial period ended",
      mainHeading: "Trial period ended",
      highlightBlock,
      bodyParagraphs: [
        `Dear <strong>${company.companyName}</strong>,`,
        `Your free trial ended on <strong>${trialEndStr}</strong>. Your access to the HR system has been suspended until you upgrade to a paid subscription.`,
        "The following are currently unavailable: employee management, attendance, leave, payroll, reports, and premium features. Your data is safe and will be restored when you upgrade.",
        "Need assistance? Contact support.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Upgrade now", href: subscriptionUrl },
    });

    const recipientEmail = company.companyEmail || company.hr?.email;

    if (!recipientEmail) {
      console.error(
        `No email address found for company ${company.companyName} (ID: ${company.id})`
      );
      return { success: false, error: "No email address found for company" };
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: "Trial Period Ended - Upgrade Required",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Trial expired email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send trial expired email:", error);
    return { success: false, error: error.message };
  }
};
