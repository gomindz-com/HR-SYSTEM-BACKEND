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
        companyId: company.id,
        profilePic: randomAvatar,
      },
    });

    await prisma.company.update({
      where: { id: company.id },
      data: { hrId: newHR.id },
    });

    generateToken(newHR.id, res);
    res.status(201).json({
      success: true,
      message: "Company created and HR registered successfully",
      company,
    });
  } catch (error) {
    console.log("Error in signUpCompany", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
