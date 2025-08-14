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
    ];
    const updateData = {};

    // Handle form data fields
    allowedUpdates.forEach((field) => {
      if (req.body[field]) {
        if (field === "dateOfBirth") {
          updateData[field] = new Date(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    // Handle file upload
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
    return res.status(500).json({ message: "Internal server error" });
  }
};




// some other functions