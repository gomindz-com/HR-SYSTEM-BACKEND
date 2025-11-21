import prisma from "../config/prisma.config.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../emails/utils.js";
import crypto from "crypto";
import { forgotPasswordEmail } from "../emails/forgotPasswordEmail.js";
import { sendVerificationEmail } from "../emails/verificationEmail.js";
import {
  createActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  ICON_TYPES,
} from "../lib/activity-utils.js";

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Normalize email to handle case sensitivity and whitespace
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.employee.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        position: true,
        profilePic: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        emergencyContact: true,
        status: true,
        role: true,
        departmentId: true,
        companyId: true,
        password: true, // We need this for password comparison
        emailVerified: true, // Need this to check verification
        createdAt: true,
        deleted: true,
        department: {
          select: {
            name: true,
          },
        },
        company: {
          select: {
            companyName: true,
            companyAddress: true,
            companyDescription: true,
            companyTin: true,
            hasLifetimeAccess: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.deleted) {
      return res
        .status(401)
        .json({ message: "your account has been deleted, contact hr manager" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if email is verified (skip for SUPER_ADMIN)
    if (!user.emailVerified && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Please verify your email before logging in",
        needsVerification: true,
      });
    }

    // Generate token and return it in response body
    const token = generateToken(user.id, res);

    // Exclude sensitive fields like password
    const { password: _password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token: token, // Return token in response
      },
    });
  } catch (error) {
    console.log("Error in login", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Normalize email to handle case sensitivity and whitespace
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.employee.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // simulate processing delay
      return res.status(200).json({
        message: "Reset link has been sent to your email", // same response
      });
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
        ? "http://localhost:8080"
        : process.env.CLIENT_URL;
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    await forgotPasswordEmail(normalizedEmail, resetUrl);

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

    // Create activity for password reset (skip if no companyId for SUPER_ADMIN)
    if (user.companyId) {
      await createActivity({
        companyId: user.companyId,
        type: ACTIVITY_TYPES.PASSWORD_CHANGE,
        title: "Password Reset",
        description: `${user.name} reset their password`,
        priority: PRIORITY_LEVELS.NORMAL,
        icon: ICON_TYPES.EMPLOYEE,
      });
    }

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
        phone: true,
        address: true,
        dateOfBirth: true,
        emergencyContact: true,
        status: true,
        role: true,
        departmentId: true,
        companyId: true,
        createdAt: true,
        department: {
          select: {
            name: true,
          },
        },
        company: {
          select: {
            companyName: true,
            companyAddress: true,
            companyDescription: true,
            companyTin: true,
            hasLifetimeAccess: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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

export const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const employee = await prisma.employee.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(),
        },
      },
    });

    if (!employee) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    const authToken = generateToken(employee.id, res);

    return res.json({
      success: true,
      message: "Email verified successfully",
      token: authToken,
    });
  } catch (error) {
    console.log("Error in verifyEmail", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const employee = await prisma.employee.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        emailVerificationToken: true,
        emailVerificationExpires: true,
      },
    });

    // Don't reveal if user exists or not (security best practice)
    if (!employee) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing
      return res.status(200).json({
        message:
          "If an account with that email exists and is unverified, a verification email has been sent.",
      });
    }

    // Check if already verified
    if (employee.emailVerified) {
      return res.status(400).json({
        message: "This email is already verified. You can log in now.",
      });
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail(
        employee.email,
        verificationToken,
        employee.name
      );
      console.log(`✅ Resent verification email to: ${employee.email}`);
    } catch (emailError) {
      console.error("❌ Failed to resend verification email:", emailError);
      return res.status(500).json({
        message: "Failed to send verification email. Please try again later.",
      });
    }

    return res.status(200).json({
      message:
        "Verification email sent! Please check your inbox and spam folder.",
    });
  } catch (error) {
    console.error("Error in resendVerificationEmail:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
