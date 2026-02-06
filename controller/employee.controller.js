import prisma from "../config/prisma.config.js";
import {
  createActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  ICON_TYPES,
} from "../lib/activity-utils.js";
import { getDepartmentFilter } from "../utils/access-control.utils.js";

const assignDepartmentManager = async (employeeId, departmentId, companyId) => {
  if (!departmentId) return;

  try {
    const department = await prisma.department.findFirst({
      where: { id: departmentId, companyId },
      include: {
        manager: { select: { id: true, role: true } },
      },
    });

    if (!department) return;

    const shouldUpdateManager =
      !department.managerId ||
      (department.manager && department.manager.role === "ADMIN");

    if (shouldUpdateManager) {
      await prisma.department.update({
        where: { id: departmentId },
        data: { managerId: employeeId },
      });
    }
  } catch (error) {
    console.error("Error assigning department manager:", error);
  }
};

const removeDepartmentManager = async (employeeId, companyId) => {
  try {
    const departments = await prisma.department.findMany({
      where: { managerId: employeeId, companyId },
    });

    for (const dept of departments) {
      await prisma.department.update({
        where: { id: dept.id },
        data: { managerId: null },
      });
    }
  } catch (error) {
    console.error("Error removing department manager:", error);
  }
};

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
  const where = { companyId, deleted: false, ...getDepartmentFilter(req.user) };

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
        employeeWorkDaysConfigs: {
          take: 1, // Only get the first one (should be unique anyway)
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

  // RBAC: Only ADMIN can update employees
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Only administrators can update employee information",
    });
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
    "shiftType",
    "biometricUserId",
  ];

  // RBAC: Only ADMIN can update shiftType
  if (req.body.shiftType && req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Only administrators can update employee shift type",
    });
  }

  const updateData = {};

  allowedUpdates.forEach((field) => {
    const value = req.body[field];
    if (value === undefined) return;

    if (field === "departmentId" && (value === "" || value === null)) {
      updateData[field] = null;
      return;
    }

    if (field === "biometricUserId") {
      updateData[field] = value === "" || value === null ? null : value;
      return;
    }

    if (value) {
      updateData[field] = value;
    }
  });

  try {
    const roleChanged = updateData.role !== undefined && updateData.role !== employee.role;
    const departmentChanged = updateData.departmentId !== undefined && 
      updateData.departmentId !== employee.departmentId;
    const wasManager = employee.role === "MANAGER";
    const oldDepartmentId = employee.departmentId;

    const updatedEmployee = await prisma.employee.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    const finalDepartmentId = updateData.departmentId !== undefined 
      ? updateData.departmentId 
      : updatedEmployee.departmentId;
    const finalRole = updateData.role !== undefined 
      ? updateData.role 
      : updatedEmployee.role;

    if (wasManager && (roleChanged && finalRole !== "MANAGER" || departmentChanged)) {
      await removeDepartmentManager(employee.id, companyId);
    }

    if (finalRole === "MANAGER" && finalDepartmentId) {
      await assignDepartmentManager(updatedEmployee.id, finalDepartmentId, companyId);
    }

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
    const employee = await prisma.employee.findFirst({
      where: { id: parseInt(id), companyId },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.role === "MANAGER") {
      await removeDepartmentManager(employee.id, companyId);
    }

    await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { deleted: true },
    });

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
  const where = { companyId, deleted: true, ...getDepartmentFilter(req.user) };

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

  const employeeIdNum = parseInt(id);
  const isOwnProfile = userId === employeeIdNum;

  // RBAC: ADMIN/FINANCE can update any profile; STAFF can update only their own (and only biometricUserId)
  if (req.user.role !== "ADMIN" && req.user.role !== "FINANCE") {
    if (!(req.user.role === "STAFF" && isOwnProfile)) {
      return res.status(403).json({
        message: "Only administrators and finance can update employee profiles, or staff can update their own biometric ID",
      });
    }
  }

  // Check if the employee exists and belongs to the company
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeIdNum,
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
    "shiftType",
    "biometricUserId",
  ];

  const updateData = {};

  // STAFF updating own profile: only allow biometricUserId
  const fieldsToApply = (req.user.role === "STAFF" && isOwnProfile)
    ? ["biometricUserId"]
    : allowedUpdates;

  fieldsToApply.forEach((field) => {
    const value = req.body[field];

    if (value === undefined) return;

    if (field === "departmentId" && (value === "" || value === null)) {
      updateData[field] = null;
      return;
    }

    if (field === "biometricUserId") {
      updateData[field] = value === "" || value === null ? null : String(value).trim();
      return;
    }

    if (value === "" || value === null) return;

    updateData[field] = value;
  });

  // RBAC: Only ADMIN can update shiftType
  if (updateData.shiftType && req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Only administrators can update employee shift type",
    });
  }

  // Convert numeric fields properly
  if (updateData.departmentId) {
    updateData.departmentId = parseInt(updateData.departmentId);
  }

  if (updateData.salary !== undefined) {
    updateData.salary = parseFloat(updateData.salary);
  }

  if (updateData.sumBonuses !== undefined) {
    updateData.sumBonuses = parseFloat(updateData.sumBonuses);
  }

  try {
    const roleChanged = updateData.role !== undefined && updateData.role !== employee.role;
    const departmentChanged = updateData.departmentId !== undefined && 
      updateData.departmentId !== employee.departmentId;
    const wasManager = employee.role === "MANAGER";
    const oldDepartmentId = employee.departmentId;

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

    const finalDepartmentId = updateData.departmentId !== undefined 
      ? updateData.departmentId 
      : updatedEmployee.departmentId;
    const finalRole = updateData.role !== undefined 
      ? updateData.role 
      : updatedEmployee.role;

    if (wasManager && (roleChanged && finalRole !== "MANAGER" || departmentChanged)) {
      await removeDepartmentManager(employee.id, companyId);
    }

    if (finalRole === "MANAGER" && finalDepartmentId) {
      await assignDepartmentManager(updatedEmployee.id, finalDepartmentId, companyId);
    }

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
    console.error("Error updating employee profile:", error);
    console.error("Update data that caused error:", updateData);
    return res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
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

/**
 * Get employee workday configuration
 * Returns employee-specific config or company default
 */
export const getEmployeeWorkdayConfig = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  // RBAC: Employees can only view their own, admins can view any
  if (req.user.role !== "ADMIN" && req.user.id !== parseInt(id)) {
    return res.status(403).json({
      message: "You can only view your own workday configuration",
    });
  }

  if (!id || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  try {
    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(id),
        companyId,
      },
      select: { id: true, name: true },
    });

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found or doesn't belong to this company",
      });
    }

    // Check if employee has custom workday config
    const employeeConfig = await prisma.employeeWorkDaysConfig.findFirst({
      where: { employeeId: parseInt(id) },
    });

    if (employeeConfig) {
      // Employee has custom config
      return res.status(200).json({
        data: {
          workdayConfig: {
            monday: employeeConfig.monday,
            tuesday: employeeConfig.tuesday,
            wednesday: employeeConfig.wednesday,
            thursday: employeeConfig.thursday,
            friday: employeeConfig.friday,
            saturday: employeeConfig.saturday,
            sunday: employeeConfig.sunday,
          },
          isCustom: true,
          customConfigId: employeeConfig.id,
        },
      });
    }

    // Employee uses company default - get company config
    const companyConfig = await prisma.workdayDaysConfig.findFirst({
      where: { companyId },
    });

    if (companyConfig) {
      return res.status(200).json({
        data: {
          workdayConfig: {
            monday: companyConfig.monday,
            tuesday: companyConfig.tuesday,
            wednesday: companyConfig.wednesday,
            thursday: companyConfig.thursday,
            friday: companyConfig.friday,
            saturday: companyConfig.saturday,
            sunday: companyConfig.sunday,
          },
          isCustom: false,
          customConfigId: null,
        },
      });
    }

    // Final fallback - default workdays (Mon-Fri)
    return res.status(200).json({
      data: {
        workdayConfig: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
        },
        isCustom: false,
        customConfigId: null,
      },
    });
  } catch (error) {
    console.error("Error fetching employee workday config:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update employee workday configuration
 * Only admins can update workday configs
 */
export const updateEmployeeWorkdayConfig = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  // RBAC: Only ADMIN can update workday configs
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Only administrators can update workday configuration",
    });
  }

  if (!id || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } =
    req.body;

  // Validate at least one workday is selected
  const workdays = [
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,
  ];
  const hasWorkday = workdays.some((day) => day === true);

  if (!hasWorkday) {
    return res.status(400).json({
      message: "At least one workday must be selected",
    });
  }

  try {
    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(id),
        companyId,
      },
      select: { id: true, name: true },
    });

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found or doesn't belong to this company",
      });
    }

    // Upsert employee workday config
    // First check if config exists
    const existingConfig = await prisma.employeeWorkDaysConfig.findFirst({
      where: { employeeId: parseInt(id) },
    });

    const workdayConfig = existingConfig
      ? await prisma.employeeWorkDaysConfig.update({
          where: { id: existingConfig.id },
          data: {
            monday: monday ?? true,
            tuesday: tuesday ?? true,
            wednesday: wednesday ?? true,
            thursday: thursday ?? true,
            friday: friday ?? true,
            saturday: saturday ?? false,
            sunday: sunday ?? false,
          },
        })
      : await prisma.employeeWorkDaysConfig.create({
          data: {
            employeeId: parseInt(id),
            monday: monday ?? true,
            tuesday: tuesday ?? true,
            wednesday: wednesday ?? true,
            thursday: thursday ?? true,
            friday: friday ?? true,
            saturday: saturday ?? false,
            sunday: sunday ?? false,
          },
        });

    // Create activity log
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.EMPLOYEE_UPDATED,
      title: "Employee Workday Configuration Updated",
      description: `Workday configuration updated for ${employee.name}`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.EMPLOYEE,
    });

    return res.status(200).json({
      message: "Employee workday configuration updated successfully",
      data: {
        workdayConfig: {
          monday: workdayConfig.monday,
          tuesday: workdayConfig.tuesday,
          wednesday: workdayConfig.wednesday,
          thursday: workdayConfig.thursday,
          friday: workdayConfig.friday,
          saturday: workdayConfig.saturday,
          sunday: workdayConfig.sunday,
        },
        isCustom: true,
        customConfigId: workdayConfig.id,
      },
    });
  } catch (error) {
    console.error("Error updating employee workday config:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Delete employee workday configuration (revert to company default)
 */
export const deleteEmployeeWorkdayConfig = async (req, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;

  // RBAC: Only ADMIN can delete workday configs
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      message: "Only administrators can delete workday configuration",
    });
  }

  if (!id || !companyId) {
    return res
      .status(400)
      .json({ message: "Employee ID and Company ID are required" });
  }

  try {
    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(id),
        companyId,
      },
      select: { id: true, name: true },
    });

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found or doesn't belong to this company",
      });
    }

    // Check if custom config exists
    const existingConfig = await prisma.employeeWorkDaysConfig.findFirst({
      where: { employeeId: parseInt(id) },
    });

    if (!existingConfig) {
      return res.status(404).json({
        message: "Employee does not have a custom workday configuration",
      });
    }

    // Delete custom config (will fallback to company default)
    // Use the id from existingConfig to delete (id is unique)
    await prisma.employeeWorkDaysConfig.delete({
      where: { id: existingConfig.id },
    });

    // Get company config to return in response
    const companyConfig = await prisma.workdayDaysConfig.findFirst({
      where: { companyId },
    });

    // Create activity log
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.EMPLOYEE_UPDATED,
      title: "Employee Workday Configuration Reset",
      description: `Workday configuration reset to company default for ${employee.name}`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.EMPLOYEE,
    });

    // Return company config or default
    const workdayConfig = companyConfig
      ? {
          monday: companyConfig.monday,
          tuesday: companyConfig.tuesday,
          wednesday: companyConfig.wednesday,
          thursday: companyConfig.thursday,
          friday: companyConfig.friday,
          saturday: companyConfig.saturday,
          sunday: companyConfig.sunday,
        }
      : {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
        };

    return res.status(200).json({
      message: "Employee workday configuration deleted. Using company default.",
      data: {
        workdayConfig,
        isCustom: false,
        customConfigId: null,
      },
    });
  } catch (error) {
    console.error("Error deleting employee workday config:", error);
    return res.status(500).json({ message: error.message });
  }
};
