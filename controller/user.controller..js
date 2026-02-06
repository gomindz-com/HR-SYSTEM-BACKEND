import express from "express";
import prisma from "../config/prisma.config.js";

export const updateUserProfile = async (req, res) => {
  const { id } = req.user;
  const { companyId } = req.user;

  if (!id) {
    return res.status(401).json({
      message: "Your session has expired. Please logout and login again.",
    });
  }

  try {
    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "address",
      "dateOfBirth",
      "emergencyContact",
      "biometricUserId",
    ];
    const updateData = {};

    // Handle form data fields
    allowedUpdates.forEach((field) => {
      if (field === "biometricUserId") {
        if (req.body[field] === undefined) return;
        const value = req.body[field];
        updateData[field] = value === "" || value === null ? null : String(value).trim();
        return;
      }
      if (req.body[field]) {
        if (field === "dateOfBirth") {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    // Handle file upload using multer cloudinary config.
    if (req.file) {
      updateData.profilePic = req.file.path;
    }

    const updatedUser = await prisma.employee.update({
      where: { id, companyId },
      data: updateData,
    });

    if (!updatedUser) {
      return res
        .status(404)
        .json({ message: "User not found or unauthorized" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    console.error("Update data that caused error:", updateData);
    return res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};




