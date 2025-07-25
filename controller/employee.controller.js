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
  const { name, email, departmentId, status, role } = req.query;

  // Build where clause
  const where = { companyId };
  if (name) where.name = { contains: name }; // Removed mode
  if (email) where.email = { contains: email }; // Removed mode
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
    console.error("Error fetching employees", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};




export const myAttendance = async (req, res) => {}