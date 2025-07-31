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

    const existingUser = await prisma.employee.findUnique({
      where: {
        email,
        companyId,
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
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
        email,
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
      to: email,
      subject: "Invitation to join company",
      html: `
            <p>You are invited to join ${company.companyName} as ${
        position || "Employee"
      }.</p>
            <p>Click the link below to accept the invitation:</p>
            <a href="${invitationUrl}">${invitationUrl}</a>
        `,
    };

    await transporter.sendMail(mailOptions);

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
      where: { email: invitation.email },
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

    if (invitation.role === "HR") {
      return res
        .status(401)
        .json({ message: "a HR already exists for this company" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    await prisma.employee.create({
      data: {
        name,
        email: invitation.email,
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
