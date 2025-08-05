import prisma from "../config/prisma.config.js";
import { generateToken } from "../emails/utils.js";
import bcrypt from "bcryptjs";

export const signUpCompany = async (req, res) => {
  const {
    companyName,
    companyEmail,
    companyTin,
    companyAddress,
    companyDescription,
    HRName,
    HRPhone,
    HRAddress,
    HREmail,
    HRPassword,
    confirmHRPassword,
  } = req.body;

  try {
    const existingCompany = await prisma.company.findUnique({
      where: {
        companyEmail,
      },
    });

    const existingHR = await prisma.employee.findUnique({
      where: {
        email: HREmail,
      },
    });

    if (existingHR) {
      return res.status(400).json({ message: "HR already exists" });
    }

    if (HRPassword !== confirmHRPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (existingCompany) {
      return res.status(400).json({ message: "Company already exists" });
    }

    const company = await prisma.company.create({
      data: {
        companyName,
        companyEmail,
        companyTin,
        companyAddress,
        companyDescription,
      },
    });

    const hrDepartment = await prisma.department.create({
      data: {
        name: "HR Department",
        companyId: company.id,
      },
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(HRPassword, salt);
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    const newHR = await prisma.employee.create({
      data: {
        name: HRName,
        email: HREmail,
        password: hashedPassword,
        phone: HRPhone,
        address: HRAddress,
        role: "HR",
        position: "HR Manager",
        companyId: company.id,
        profilePic: randomAvatar,
        departmentId: hrDepartment.id,
      },
    });

    await prisma.company.update({
      where: { id: company.id },
      data: { hrId: newHR.id },
    });

    await prisma.department.update({
      where: { id: hrDepartment.id },
      data: { managerId: newHR.id },
    });

    generateToken(newHR.id, res);
    res.status(201).json({
      success: true,
      message: "Company created and HR registered successfully",
      data: { newHR },
    });
  } catch (error) {
    console.log("Error in signUpCompany", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update company attendance settings
 */
export const updateAttendanceSettings = async (req, res) => {
  const { companyId } = req.user;
  const {
    timezone,
    workStartTime,
    workEndTime,
    lateThreshold,
    checkInDeadline,
  } = req.body;

  try {
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (workStartTime && !timeRegex.test(workStartTime)) {
      return res.status(400).json({
        message:
          "Invalid work start time format. Use HH:MM format (e.g., 09:00)",
      });
    }
    if (workEndTime && !timeRegex.test(workEndTime)) {
      return res.status(400).json({
        message: "Invalid work end time format. Use HH:MM format (e.g., 17:00)",
      });
    }

    // Validate numeric fields
    if (lateThreshold && (lateThreshold < 0 || lateThreshold > 120)) {
      return res.status(400).json({
        message: "Late threshold must be between 0 and 120 minutes",
      });
    }
    if (checkInDeadline && (checkInDeadline < 0 || checkInDeadline > 120)) {
      return res.status(400).json({
        message: "Check-in deadline must be between 0 and 120 minutes",
      });
    }

    // Update company settings
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        timezone: timezone || undefined,
        workStartTime: workStartTime || undefined,
        workEndTime: workEndTime || undefined,
        lateThreshold: lateThreshold || undefined,
        checkInDeadline: checkInDeadline || undefined,
      },
      select: {
        id: true,
        companyName: true,
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
        checkInDeadline: true,
      },
    });

    // Get timezone info for response
    return res.status(200).json({
      message: "Attendance settings updated successfully",
      data: updatedCompany,
    });
  } catch (error) {
    console.error("Error updating attendance settings:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get company attendance settings
 */
export const getAttendanceSettings = async (req, res) => {
  const { companyId } = req.user;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        timezone: true,
        workStartTime: true,
        workEndTime: true,
        lateThreshold: true,
        checkInDeadline: true,
      },
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Get timezone info for response
    return res.status(200).json({
      message: "Attendance settings retrieved successfully",
      data: company,
    });
  } catch (error) {
    console.error("Error getting attendance settings:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get available timezones
 */
export const getAvailableTimezones = async (req, res) => {
  try {
    // Return UTC only since we're using universal time
    const timezones = ["UTC"];

    return res.status(200).json({
      message: "Available timezones retrieved successfully",
      data: timezones,
    });
  } catch (error) {
    console.error("Error getting timezones:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
