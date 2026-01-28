import { transporter } from "../config/transporter.js";

// Email template for successful payment confirmation
export const sendPaymentSuccessEmail = async (
  company,
  subscription,
  payment
) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #28a745;">✓</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Payment Successful!</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your subscription has been activated</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Thank you for your payment!</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${company.companyName}</strong>,<br><br>
          We're excited to confirm that your payment has been processed successfully and your HR system subscription is now active.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Payment Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Plan</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${subscription.plan.name}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Amount</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${payment.amount.toLocaleString()} GMD</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Payment Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(payment.paidAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Next Billing</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date(subscription.endDate).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div style="background: #e7f3ff; border-left: 4px solid #007bff; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #0056b3; margin-top: 0; font-size: 16px;">What's Next?</h3>
        <ul style="color: #495057; margin: 10px 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Access your full HR management dashboard</li>
          <li style="margin-bottom: 8px;">Add and manage your employees</li>
          <li style="margin-bottom: 8px;">Set up attendance tracking and leave management</li>
          <li style="margin-bottom: 8px;">Generate reports and analytics</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || "http://localhost:8080"}/hr-choice" 
           style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          Access Your Dashboard
        </a>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Need help? Contact our support team at 
          <a href="mailto:support@hrsystem.com" style="color: #007bff; text-decoration: none;">support@hrsystem.com</a>
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    // Determine recipient email with fallback
    const recipientEmail = company.companyEmail || company.hr?.email;

    if (!recipientEmail) {
      console.error(
        `No email address found for company ${company.companyName} (ID: ${company.id})`
      );
      return { success: false, error: "No email address found for company" };
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Payment Confirmed - ${subscription.plan.name} Plan Activated`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment success email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send payment success email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for subscription renewal reminders
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

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #ffc107;">⏰</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Subscription Expiring Soon</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">${daysUntilExpiry} day${daysUntilExpiry > 1 ? "s" : ""} remaining</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Action Required</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${company.companyName}</strong>,<br><br>
          Your current subscription will expire on <strong>${new Date(subscription.endDate).toLocaleDateString()}</strong>. 
          To continue enjoying uninterrupted access to your HR management system, please renew your subscription.
        </p>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Current Subscription</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Plan</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${subscription.plan.name}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Price Per User</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${pricePerUser.toLocaleString()} GMD/month</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Active Employees</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${employeeCount}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Total Monthly Cost</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${totalAmount.toLocaleString()} GMD</p>
          </div>
          <div style="grid-column: span 2;">
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Expires</p>
            <p style="margin: 0; font-weight: bold; color: #dc3545;">${new Date(subscription.endDate).toLocaleDateString()}</p>
          </div>
        </div>
        ${employeeCount > 0
        ? `
        <div style="background: #e7f3ff; padding: 15px; border-radius: 6px; margin-top: 15px;">
          <p style="margin: 0; color: #0056b3; font-size: 14px; text-align: center;">
            <strong>Calculation:</strong> ${pricePerUser} GMD × ${employeeCount} employees = ${totalAmount.toLocaleString()} GMD/month
          </p>
        </div>
        `
        : ""
      }
      </div>

      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #856404; margin-top: 0; font-size: 16px;">⚠️ Important Notice</h3>
        <p style="color: #856404; margin: 0; font-size: 14px;">
          If your subscription expires, you will lose access to:
        </p>
        <ul style="color: #856404; margin: 10px 0; padding-left: 20px; font-size: 14px;">
          <li style="margin-bottom: 5px;">Employee management and attendance tracking</li>
          <li style="margin-bottom: 5px;">Leave management and payroll features</li>
          <li style="margin-bottom: 5px;">Reports and analytics dashboard</li>
          <li style="margin-bottom: 5px;">All premium features and data access</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.BACKEND_URL || "http://localhost:5000"}/api/subscription/renewal-payment?direct=true" 
           style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; margin-right: 10px;">
          Renew Now (Direct Payment)
        </a>
        <a href="${process.env.CLIENT_URL || "http://localhost:8080"}/subscription" 
           style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          View Subscription Dashboard
        </a>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Questions about your subscription? Contact us at 
          <a href="mailto:support@hrsystem.com" style="color: #007bff; text-decoration: none;">support@hrsystem.com</a>
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    // Determine recipient email with fallback
    const recipientEmail = company.companyEmail || company.hr?.email;

    if (!recipientEmail) {
      console.error(
        `No email address found for company ${company.companyName} (ID: ${company.id})`
      );
      return { success: false, error: "No email address found for company" };
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Urgent: Subscription Expires in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? "s" : ""} - Action Required`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Renewal reminder email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send renewal reminder email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for subscription expiration notification
export const sendSubscriptionExpiredEmail = async (company, subscription) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #dc3545;">⚠️</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Subscription Expired</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Access has been suspended</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Immediate Action Required</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${company.companyName}</strong>,<br><br>
          Your HR system subscription expired on <strong>${new Date(subscription.endDate).toLocaleDateString()}</strong>. 
          Your access to the system has been suspended until payment is received.
        </p>
      </div>

      <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #721c24; margin-top: 0; font-size: 16px;">🚫 Access Suspended</h3>
        <p style="color: #721c24; margin: 0; font-size: 14px;">
          The following features are currently unavailable:
        </p>
        <ul style="color: #721c24; margin: 10px 0; padding-left: 20px; font-size: 14px;">
          <li style="margin-bottom: 5px;">Employee management and data access</li>
          <li style="margin-bottom: 5px;">Attendance tracking and leave management</li>
          <li style="margin-bottom: 5px;">Payroll processing and reports</li>
          <li style="margin-bottom: 5px;">All premium features and analytics</li>
        </ul>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Expired Subscription</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Plan</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${subscription.plan.name}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Monthly Cost</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${subscription.plan.price.toLocaleString()} GMD</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Expired On</p>
            <p style="margin: 0; font-weight: bold; color: #dc3545;">${new Date(subscription.endDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Status</p>
            <p style="margin: 0; font-weight: bold; color: #dc3545;">EXPIRED</p>
          </div>
        </div>
      </div>

      <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
        <h3 style="color: #0c5460; margin-top: 0; font-size: 16px;">💡 Good News</h3>
        <p style="color: #0c5460; margin: 0; font-size: 14px;">
          Your data is safe and will be restored immediately upon payment. No information has been lost.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || "http://localhost:8080"}/subscription" 
           style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          Reactivate Subscription
        </a>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Need immediate assistance? Contact our support team at 
          <a href="mailto:support@hrsystem.com" style="color: #007bff; text-decoration: none;">support@hrsystem.com</a>
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    // Determine recipient email with fallback
    const recipientEmail = company.companyEmail || company.hr?.email;

    if (!recipientEmail) {
      console.error(
        `No email address found for company ${company.companyName} (ID: ${company.id})`
      );
      return { success: false, error: "No email address found for company" };
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `URGENT: Subscription Expired - Access Suspended`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Subscription expired email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send subscription expired email:", error);
    return { success: false, error: error.message };
  }
};

// Email template for payment failure notification
export const sendPaymentFailureEmail = async (
  company,
  subscription,
  errorMessage
) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
        <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 30px; color: #dc3545;">❌</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Payment Failed</h1>
        <p style="color: white; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Please update your payment method</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Payment Issue</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${company.companyName}</strong>,<br><br>
          We were unable to process your payment for the <strong>${subscription.plan.name}</strong> plan. 
          Please update your payment information to continue using the HR system.
        </p>
      </div>

      <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #721c24; margin-top: 0; font-size: 16px;">⚠️ Action Required</h3>
        <p style="color: #721c24; margin: 0; font-size: 14px;">
          ${errorMessage || "Your payment could not be processed. This may be due to:"}
        </p>
        <ul style="color: #721c24; margin: 10px 0; padding-left: 20px; font-size: 14px;">
          <li style="margin-bottom: 5px;">Insufficient funds in your account</li>
          <li style="margin-bottom: 5px;">Expired or invalid payment method</li>
          <li style="margin-bottom: 5px;">Bank security restrictions</li>
          <li style="margin-bottom: 5px;">Technical processing error</li>
        </ul>
      </div>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Subscription Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Plan</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${subscription.plan.name}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Amount</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${subscription.plan.price.toLocaleString()} GMD</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Status</p>
            <p style="margin: 0; font-weight: bold; color: #dc3545;">PAYMENT FAILED</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Date</p>
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || "http://localhost:8080"}/subscription" 
           style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          Update Payment Method
        </a>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Need help with payment? Contact our support team at 
          <a href="mailto:support@hrsystem.com" style="color: #007bff; text-decoration: none;">support@hrsystem.com</a>
        </p>
      </div>

      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
      <p style="color: #6c757d; font-size: 12px; text-align: center; margin: 0;">
        This is an automated message. Please do not reply to this email.<br>
        © 2024 HR Management System. All rights reserved.
      </p>
    </div>
  `;

    // Determine recipient email with fallback
    const recipientEmail = company.companyEmail || company.hr?.email;

    if (!recipientEmail) {
      console.error(
        `No email address found for company ${company.companyName} (ID: ${company.id})`
      );
      return { success: false, error: "No email address found for company" };
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "support@datafin.info";
    const fromName =
      (process.env.RESEND_FROM_NAME &&
        process.env.RESEND_FROM_NAME.trim()) ||
      "GOMINDZ HR SYSTEM";

    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: `Payment Failed - Action Required for ${subscription.plan.name} Plan`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment failure email sent to ${company.companyName}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send payment failure email:", error);
    return { success: false, error: error.message };
  }
};
