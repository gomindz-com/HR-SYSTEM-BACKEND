export const getDepartmentFilter = (user) => {
  if (user.role === "ADMIN") {
    return {};
  }

  if (user.role === "MANAGER") {
    if (!user.departmentId) {
      throw new Error("Manager must be assigned to a department");
    }
    return { departmentId: user.departmentId };
  }

  return { id: user.id };
};

export const adminOnly = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res
      .status(403)
      .json({ message: "This operation is restricted to administrators only" });
  }

  next();
};

export const managerOrAdmin = (req, res, next) => {
  if (!["ADMIN", "MANAGER"].includes(req.user.role)) {
    return res
      .status(403)
      .json({
        message: "This operation requires manager or administrator privileges",
      });
  }

  next();
};
