import prisma from "../config/prisma.config.js";

export const listEmployees = async (req, res) => {
  const companyId = req.user.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "Company ID is required" });
  }

  // Pagination params
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  // Filtering params
  const { name, email, departmentId, status, role, position, search } =
    req.query;

  // Build where clause
  const where = { companyId };

  // Handle search across multiple fields (name, email, position)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { position: { contains: search, mode: "insensitive" } },
    ];
  } else {
    // Individual field filters
    if (name) where.name = { contains: name, mode: "insensitive" };
    if (email) where.email = { contains: email, mode: "insensitive" };
    if (position) where.position = { contains: position, mode: "insensitive" };
  }

  if (departmentId) where.departmentId = parseInt(departmentId);
  if (status) where.status = status;
  if (role) where.role = role;

  try {
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
        include: {
          department: { select: { id: true, name: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);
    return res.status(200).json({
      data: {
        employees,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    // Only log critical errors, not connection issues
    if (error.code === "P1001" || error.code === "P1002") {
      // Database connection errors - don't spam the console
      console.log("Database connection issue - retrying...");
    } else {
      console.error("Error fetching employees:", error.message);
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getEmployeeDetails = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  if (!id || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  try {
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(id),
        companyId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        company: {
          select: {
            id: true,
            companyName: true,
            companyEmail: true,
          },
        },
        attendances: {
          take: 5,
          orderBy: { date: "desc" },
          select: {
            id: true,
            date: true,
            timeIn: true,
            timeOut: true,
            status: true,
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.status(200).json({
      data: employee,
    });
  } catch (error) {
    console.error("Error fetching employee details", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateEmployee = async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Employee ID is required" });
  }

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (companyId !== id) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const allowedUpdates = [
    "role",
    "department",
    "status",
    "position",
    "departmentId",
  ];

  const updateData = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field]) {
      updateData[field] = req.body[field];
    }
  });

  try {
    const updatedEmployee = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return res
      .status(200)
      .json({
        message: "Employee updated successfully",
        data: updatedEmployee,
      });
  } catch (error) {
    console.error("Error updating employee", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
