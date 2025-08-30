import prisma from "../config/prisma.config.js";

export const getCurrentShift = async (req, res) => {
  const id = req.user.id;

  if (!id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: id },
      select: {
        shiftType: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.status(200).json({
      message: "Current shift retrieved successfully",
      data: { shiftType: employee.shiftType },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const setMorningShift = async (req, res) => {
  const id = req.user.id;

  if (!id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: id },
      select: {
        shiftType: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.shiftType === "MORNING_SHIFT") {
      return res.status(400).json({ message: "Morning shift already enabled" });
    }

    await prisma.employee.update({
      where: { id: id },
      data: {
        shiftType: "MORNING_SHIFT",
      },
    });
    return res.status(200).json({ message: "Morning shift set successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const setAfternoonShift = async (req, res) => {
  const id = req.user.id;

  if (!id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: id },
      select: {
        shiftType: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.shiftType === "AFTERNOON_SHIFT") {
      return res
        .status(400)
        .json({ message: "Afternoon shift already enabled" });
    }

    await prisma.employee.update({
      where: { id: id },
      data: {
        shiftType: "AFTERNOON_SHIFT",
      },
    });
    return res
      .status(200)
      .json({ message: "Afternoon shift set successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
