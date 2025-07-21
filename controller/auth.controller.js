import prisma from "../config/prisma.config.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../emails/utils.js";
import crypto from "crypto";
import { transporter } from "../config/transporter.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.employee.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    generateToken(user.id, res);

    // Exclude sensitive fields like password
    const { password: _password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
      },
    });
  } catch (error) {
    console.log("Error in login", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    const user = await prisma.employee.findUnique({
      where: { email },
    });

    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // simulate processing delay
      return res.status(200).json({
        message: "Reset link has been sent to your email", // same response
      });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await prisma.employee.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:5173"
        : process.env.CLIENT_URL || "https://hr-management-system.vercel.app";
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `
        <p>Hello,</p>
        <p>You are receiving this email because you (or someone else) have requested a password reset for your account.</p>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Thank you!</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Reset link has been sent to your email",
    });
  } catch (error) {
    console.log("Error in forgotPassword", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  if (!newPassword) {
    return res.status(400).json({ message: "New password is required" });
  }
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.employee.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.employee.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    console.log("Error in resetPassword", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  const { id } = req.user;

  try {
    const user = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        position: true,
        profilePic: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
        company: {
          select: {
            companyName: true,
            companyAddress: true,
            companyDescription: true,
            companyTin: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "User is authenticated",
      data: {
        user,
      },
    });
  } catch (error) {
    console.log("Error in checkAuth", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
