import { transporter } from "../config/transporter.js";

// Email template for trial expiring soon reminders
export const sendTrialExpiringEmail = async (
  company,
  subscription,
  daysLeft
) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 20px; border: 1px solid #dee2e6;">
        <h1 style="color: #2c3e50; margin: 0; font-size: 28px; font-weight: bold;">Trial Expiring Soon</h1>
        <p style="color: #6c757d; margin: 10px 0 0; font-size: 16px;">${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Trial Period Ending</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${company.companyName}</strong>,<br><br>
          Your free trial will expire on <strong>${new Date(subscription.trialEndDate).toLocaleDateString()}</strong>. 
          To continue using our HR management system, please upgrade to a paid subscription.
        </p>
      </ Web>

      <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Trial Details</h3>
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
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Trial Ends</p>
            <p style="margin: 0; font-weight: bold; color: #dc3545;">${new Date(subscription.trialEndDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Status</p>
            <p style="margin: 0; font-weight: bold; color: #ffc107;">TRIAL</p>
          </div>
        </div>
      </div>

      <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #856404; margin-top: 0; font-size: 16px;">Important Notice</h3>
        <p style="color: #856404; margin: 0; font-size: 14px;">
          If your trial expires, you will lose access to:
        </p>
        <ul style="color: #856404; margin: 10px 0; padding-left: 20px; font-size: 14px;">
          <li style="margin-bottom: 5px;">Employee management and attendance tracking</li>
          <li style="margin-bottom: 5px;">Leave management and payroll features</li>
          <li style="margin-bottom: 5px;">Reports and analytics dashboard</li>
          <li style="margin-bottom: 5px;">All premium features and data access</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || "http://localhost:8080"}/subscription" 
           style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          Upgrade Now
        </a>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="color: #6c757d; font-size: 14px; margin: 0;">
          Questions about upgrading? Contact us at 
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

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
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

// Email template for trial expired notification
export const sendTrialExpiredEmail = async (company, subscription) => {
  try {
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 20px; border: 1px solid #dee2e6;">
        <h1 style="color: #2c3e50; margin: 0; font-size: 28px; font-weight: bold;">Trial Period Ended</h1>
        <p style="color: #6c757d; margin: 10px 0 0; font-size: 16px;">Access has been suspended</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0; font-size: 22px;">Trial Expired</h2>
        <p style="color: #6c757d; font-size: 16px; line-height: 1.6;">
          Dear <strong>${company.companyName}</strong>,<br><br>
          Your free trial ended on <strong>${new Date(subscription.trialEndDate).toLocaleDateString()}</strong>. 
          Your access to the HR system has been suspended until you upgrade to a paid subscription.
        </p>
      </div>

      <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #721c24; margin-top: 0; font-size: 16px;">Access Suspended</h3>
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
        <h3 style="color: #495057; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">Expired Trial</h3>
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
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Trial Ended</p>
            <p style="margin: 0; font-weight: bold; color: #dc3545;">${new Date(subscription.trialEndDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">Status</p>
            <p style="margin: 0; font-weight: bold; color: #dc3545;">EXPIRED</p>
          </div>
        </div>
      </div>

      <div style="background: #d1ecf1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #0c5460; margin-top: 0; font-size: 16px;">Good News</h3>
        <p style="color: #0c5460; margin: 0; font-size: 14px;">
          Your data is safe and will be restored immediately upon upgrading. No information has been lost.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || "http://localhost:8080"}/subscription" 
           style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
          Upgrade Now
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

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `Trial Period Ended - Upgrade Required`,
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
