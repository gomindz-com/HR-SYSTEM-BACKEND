import prisma from "../config/prisma.config.js";
import {
  createActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  ICON_TYPES,
} from "../lib/activity-utils.js";
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
  const {
    name,
    email,
    departmentId,
    status,
    role,
    position,
    search,
    minSalary,
    maxSalary,
  } = req.query;

  // Build where clause
  const where = { companyId, deleted: false };

  // Handle search across multiple fields (name, email, position, employeeId)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { position: { contains: search, mode: "insensitive" } },
      { employeeId: { contains: search, mode: "insensitive" } },
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

  // Salary range filtering
  if (minSalary !== undefined || maxSalary !== undefined) {
    where.salary = {};
    if (minSalary !== undefined) {
      where.salary.gte = parseFloat(minSalary);
    }
    if (maxSalary !== undefined) {
      where.salary.lte = parseFloat(maxSalary);
    }
  }

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

  // Check if the employee exists and belongs to the company
  const employee = await prisma.employee.findFirst({
    where: {
      id: parseInt(id),
      companyId,
    },
  });

  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
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

    // Create activity for employee update
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.EMPLOYEE_UPDATED,
      title: "Employee Updated",
      description: `${employee.name}'s information was updated by admin`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.EMPLOYEE,
    });

    return res.status(200).json({
      message: "info updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Error updating employee", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteEmployee = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  if (!id || !companyId) {
    return res

      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  try {
    const employee = await prisma.employee.update({
      where: {
        id: parseInt(id),
        companyId,
      },
      data: {
        deleted: true,
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Create activity for employee deletion
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.EMPLOYEE_DELETED,
      title: "Employee Deleted",
      description: `${employee.name} was removed from the company`,
      priority: PRIORITY_LEVELS.HIGH,
      icon: ICON_TYPES.EMPLOYEE,
    });

    return res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const listArchivedEmployees = async (req, res) => {
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

  // Build where clause - only deleted employees
  const where = { companyId, deleted: true };

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
      console.error("Error fetching archived employees:", error.message);
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const reinstateEmployee = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  if (!id || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  try {
    const employee = await prisma.employee.update({
      where: {
        id: parseInt(id),
        companyId,
      },
      data: {
        deleted: false,
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res
      .status(200)
      .json({ message: "Employee reinstated successfully" });
  } catch (error) {
    console.error("Error reinstating employee", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateEmployeeProfile = async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Employee ID is required" });
  }

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if the employee exists and belongs to the company
  const employee = await prisma.employee.findFirst({
    where: {
      id: parseInt(id),
      companyId,
    },
  });

  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  const allowedUpdates = [
    "employeeId",
    "name",
    "email",
    "phone",
    "position",
    "departmentId",
    "address",
    "salary",
    "sumBonuses",
    "role",
    "status",
  ];

  const updateData = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  // Convert departmentId to integer if provided
  if (updateData.departmentId) {
    updateData.departmentId = parseInt(updateData.departmentId);
  }

  try {
    const updatedEmployee = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create activity for employee profile update
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.EMPLOYEE_UPDATED,
      title: "Employee Profile Updated",
      description: `${employee.name}'s profile was updated by admin`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.EMPLOYEE,
    });

    return res.status(200).json({
      message: "Employee profile updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Error updating employee profile", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const toggleEmployeeStatus = async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Employee ID is required" });
  }

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Get the current employee
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(id),
        companyId,
      },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Toggle status: ACTIVE <-> INACTIVE
    const newStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    // Update the employee status
    const updatedEmployee = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { status: newStatus },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create activity for status change
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.EMPLOYEE_UPDATED,
      title: "Employee Status Toggled",
      description: `${employee.name} was marked as ${newStatus.toLowerCase()}`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.EMPLOYEE,
    });

    return res.status(200).json({
      message: `Employee marked as ${newStatus.toLowerCase()}`,
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Error toggling employee status", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
