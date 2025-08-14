import prisma from "../config/prisma.config.js";
import { transporter } from "../config/transporter.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
export const sendInvitation = async (req, res) => {
  const { email, role, position, departmentId } = req.body;
  const id = req.user.id;
  const companyId = req.user.companyId;

  try {
    if (!companyId) {
      return res
        .status(400)
        .json({ message: "your session is not associated with any company" });
    }
    if (!departmentId) {
      return res.status(400).json({ message: "departmentId is required" });
    }

    // Normalize email to handle case sensitivity and whitespace
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.employee.findUnique({
      where: {
        email: normalizedEmail,
        companyId,
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        companyId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return res
        .status(400)
        .json({ message: "Invitation already sent to this email" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(400).json({ message: "Company not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        position,
        role: role || "EMPLOYEE",
        companyId,
        invitedBy: id,
        token,
        expiresAt,
        status: "PENDING",
        createdAt: new Date(),
        departmentId,
      },
    });

    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:8080"
        : process.env.CLIENT_URL ||
          "https://hr-system-frontend-tester.vercel.app";
    const invitationUrl = `${baseUrl}/accept-invitation/${token}`;

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Invitation to join company",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            <h2 style="color: #007bff; margin-top: 0;">Company Invitation</h2>
            <p>Hello,</p>
            <p>You are invited to join <strong>${company.companyName}</strong> as <strong>${
              position || "Employee"
            }</strong>.</p>
            <p>Please click the button below to accept the invitation:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" style="background: #007bff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #6c757d; font-size: 14px;">This invitation will expire in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">Thank you,<br/>The HR System Team</p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Invitation email sent successfully:", {
        to: normalizedEmail,
        companyName: company.companyName,
        position: position || "Employee",
        timestamp: new Date().toISOString(),
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", {
        to: normalizedEmail,
        error: emailError.message,
        timestamp: new Date().toISOString(),
      });
      // Continue execution - invitation is already saved in database
    }

    res.status(200).json({
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.log("Error in sendInvitation", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptInvitation = async (req, res) => {
  const { token } = req.params;
  const { name, password, confirmPassword } = req.body;

  try {
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    if (confirmPassword !== password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const invitation = await prisma.invitation.findFirst({
      where: {
        token,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      return res.status(400).json({ message: "Invalid or expired invitation" });
    }

    const existingUser = await prisma.employee.findUnique({
      where: { email: invitation.email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const now = new Date();
    if (invitation.expiresAt < now) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "EXPIRED",
        },
      });
      return res.status(400).json({ message: "Invitation has expired" });
    }

    // Check if a user with the same role already exists for this company
    // Only restrict HR roles to one per company
    if (invitation.role === "HR") {
      const existingHR = await prisma.employee.findFirst({
        where: {
          companyId: invitation.companyId,
          role: "HR",
        },
      });

      if (existingHR) {
        return res
          .status(401)
          .json({ message: "An HR already exists for this company" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    await prisma.employee.create({
      data: {
        name,
        email: invitation.email.toLowerCase().trim(),
        password: hashedPassword,
        companyId: invitation.companyId,
        role: invitation.role,
        profilePic: randomAvatar,
        position: invitation.position,
        createdAt: new Date(),
        departmentId: invitation.departmentId,
      },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    res.status(200).json({
      message: "Account created successfully, please login to continue",
    });
  } catch (error) {
    console.log("Error in AcceptInvite controller", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
