import { transporter } from "../config/transporter.js";
import { renderEmailLayout } from "./emailLayout.js";

const clientUrl = process.env.CLIENT_URL || "http://localhost:8080";
const renewalPaymentUrl =
  process.env.BACKEND_URL || "http://localhost:5000";
const subscriptionUrl = `${clientUrl}/subscription`;

function getRecipientEmail(company) {
  return company.companyEmail || company.hr?.email;
}

function getFrom() {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "support@gomindz.gm";
  const fromName =
    (process.env.RESEND_FROM_NAME && process.env.RESEND_FROM_NAME.trim()) ||
    "GOMINDZ HR SYSTEM";
  return { fromEmail, fromName };
}

export const sendPaymentSuccessEmail = async (
  company,
  subscription,
  payment
) => {
  try {
    const highlightBlock = [
      `Plan: ${subscription.plan.name}`,
      `Amount: ${payment.amount.toLocaleString()} GMD`,
      `Payment date: ${new Date(payment.paidAt).toLocaleDateString()}`,
      `Next billing: ${new Date(subscription.endDate).toLocaleDateString()}`,
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: "Payment successful",
      mainHeading: "Payment successful",
      highlightBlock,
      bodyParagraphs: [
        `Dear <strong>${company.companyName}</strong>,`,
        "We're excited to confirm that your payment has been processed successfully and your HR system subscription is now active.",
        "You can access your full HR management dashboard, add and manage employees, set up attendance and leave, and generate reports.",
        "Need help? Contact support.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Access your dashboard", href: `${clientUrl}/hr-choice` },
    });

    const recipientEmail = getRecipientEmail(company);
    if (!recipientEmail) {
      console.error(`No email address found for company ${company.companyName} (ID: ${company.id})`);
      return { success: false, error: "No email address found for company" };
    }

    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Payment Confirmed - ${subscription.plan.name} Plan Activated`,
      html: htmlContent,
    });
    console.log(`✅ Payment success email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send payment success email:", error);
    return { success: false, error: error.message };
  }
};

export const sendRenewalReminderEmail = async (
  company,
  subscription,
  pricingData = {}
) => {
  try {
    const daysUntilExpiry = Math.ceil(
      (new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    const {
      employeeCount = 0,
      pricePerUser = subscription.plan.price,
      totalAmount = subscription.plan.price,
    } = pricingData;

    const highlightLines = [
      `Plan: ${subscription.plan.name}`,
      `Price per user: ${pricePerUser.toLocaleString()} GMD/month`,
      `Active employees: ${employeeCount}`,
      `Total monthly cost: ${totalAmount.toLocaleString()} GMD`,
      `Expires: ${new Date(subscription.endDate).toLocaleDateString()}`,
    ];
    if (employeeCount > 0) {
      highlightLines.push(`Calculation: ${pricePerUser} GMD × ${employeeCount} employees = ${totalAmount.toLocaleString()} GMD/month`);
    }
    const highlightBlock = highlightLines.join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: `Subscription expiring in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? "s" : ""}`,
      mainHeading: "Subscription expiring soon",
      highlightBlock,
      bodyParagraphs: [
        `Dear <strong>${company.companyName}</strong>,`,
        `Your current subscription will expire on <strong>${new Date(subscription.endDate).toLocaleDateString()}</strong>. To continue enjoying uninterrupted access, please renew.`,
        "If your subscription expires, you will lose access to employee management, attendance, leave, payroll, reports, and premium features.",
        "Questions? Contact support.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Renew now", href: `${renewalPaymentUrl}/api/subscription/renewal-payment?direct=true` },
    });

    const recipientEmail = getRecipientEmail(company);
    if (!recipientEmail) {
      console.error(`No email address found for company ${company.companyName} (ID: ${company.id})`);
      return { success: false, error: "No email address found for company" };
    }

    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Urgent: Subscription Expires in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? "s" : ""} - Action Required`,
      html: htmlContent,
    });
    console.log(`✅ Renewal reminder email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send renewal reminder email:", error);
    return { success: false, error: error.message };
  }
};

export const sendSubscriptionExpiredEmail = async (company, subscription) => {
  try {
    const endStr = new Date(subscription.endDate).toLocaleDateString();
    const highlightBlock = [
      `Plan: ${subscription.plan.name}`,
      `Monthly cost: ${subscription.plan.price.toLocaleString()} GMD`,
      `Expired on: ${endStr}`,
      "Status: EXPIRED",
    ].join("<br />");

    const htmlContent = renderEmailLayout({
      preheaderText: "Subscription expired",
      mainHeading: "Subscription expired",
      highlightBlock,
      bodyParagraphs: [
        `Dear <strong>${company.companyName}</strong>,`,
        `Your HR system subscription expired on <strong>${endStr}</strong>. Your access has been suspended until payment is received.`,
        "The following are currently unavailable: employee management, attendance, leave, payroll, reports, and premium features. Your data is safe and will be restored when you reactivate.",
        "Need assistance? Contact support.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Reactivate subscription", href: subscriptionUrl },
    });

    const recipientEmail = getRecipientEmail(company);
    if (!recipientEmail) {
      console.error(`No email address found for company ${company.companyName} (ID: ${company.id})`);
      return { success: false, error: "No email address found for company" };
    }

    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: "URGENT: Subscription Expired - Access Suspended",
      html: htmlContent,
    });
    console.log(`✅ Subscription expired email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send subscription expired email:", error);
    return { success: false, error: error.message };
  }
};

export const sendPaymentFailureEmail = async (
  company,
  subscription,
  errorMessage
) => {
  try {
    const highlightBlock = [
      `Plan: ${subscription.plan.name}`,
      `Amount: ${subscription.plan.price.toLocaleString()} GMD`,
      "Status: PAYMENT FAILED",
      `Date: ${new Date().toLocaleDateString()}`,
    ].join("<br />");

    const reasonText =
      errorMessage ||
      "Your payment could not be processed. This may be due to: insufficient funds, expired or invalid payment method, bank restrictions, or a technical error.";

    const htmlContent = renderEmailLayout({
      preheaderText: "Payment failed",
      mainHeading: "Payment failed",
      highlightBlock,
      bodyParagraphs: [
        `Dear <strong>${company.companyName}</strong>,`,
        `We were unable to process your payment for the <strong>${subscription.plan.name}</strong> plan. Please update your payment information to continue using the HR system.`,
        reasonText,
        "Need help with payment? Contact support.",
        `© ${new Date().getFullYear()} HR Management System.`,
      ],
      cta: { text: "Update payment method", href: subscriptionUrl },
    });

    const recipientEmail = getRecipientEmail(company);
    if (!recipientEmail) {
      console.error(`No email address found for company ${company.companyName} (ID: ${company.id})`);
      return { success: false, error: "No email address found for company" };
    }

    const { fromEmail, fromName } = getFrom();
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Payment Failed - Action Required for ${subscription.plan.name} Plan`,
      html: htmlContent,
    });
    console.log(`✅ Payment failure email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send payment failure email:", error);
    return { success: false, error: error.message };
  }
};
