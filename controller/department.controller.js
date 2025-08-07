import prisma from "../config/prisma.config.js";

// List departments for a company
export const listDepartments = async (req, res) => {
  const { companyId } = req.user;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    const departments = await prisma.department.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    });
    res
      .status(200)
      .json({ message: "Departments fetched successfully", data: departments });
  } catch (error) {
    console.error("Error listing departments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Add a department for a company
export const addDepartment = async (req, res) => {
  const { id, companyId } = req.user;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  if (!id) {
    return res.status(401).json({ message: "you are not authenticated" });
  }


  if(req.user.role !== "HR") {
    return res.status(401).json({ message: "you are not authorized" });
  }

  try {
    // Check for duplicate department name in the same company
    const existing = await prisma.department.findFirst({
      where: { name, companyId },
    });
    if (existing) {
      return res.status(400).json({ message: "Department already exists" });
    }
    const department = await prisma.department.create({
      data: { name, companyId, managerId: id },
    });
    res.status(201).json({
      message: "Department created successfully",
      data: department,
    });
  } catch (error) {
    console.error("Error adding department:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
