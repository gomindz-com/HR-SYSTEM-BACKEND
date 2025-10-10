import prisma from "../config/prisma.config.js";
import { getRecentActivities } from "../lib/activity-utils.js";

export const getDashboardMetrics = async (req, res) => {
  const id = req.user.id;
  const companyId = req.user.companyId;

  if (!id || !companyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Fix: Create proper date range for today
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );

  try {
    const [totalEmployees, totalAttendance, pendingLeaves] = await Promise.all([
      prisma.employee.count({ where: { companyId } }),
      prisma.attendance.count({
        where: {
          companyId,
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
          status: { not: "ABSENT" },
        },
      }),
      prisma.leaveRequest.count({ where: { companyId, status: "PENDING" } }),
    ]);

    const attendanceRate = Math.round((totalAttendance / totalEmployees) * 100);

    const metrics = {
      totalEmployees,
      pendingLeaves,
      attendanceRate,
    };

    res.status(200).json({ success: true, metrics });
  } catch (error) {
    console.error("❌ Error in getDashboardMetrics:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getWeeklyAttendanceOverview = async (req, res) => {
  const companyId = req.user.companyId;

  if (!companyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Get the start of the current week (Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(
      today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    );
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get attendance data for each day of the week
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const attendanceData = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + 1);

      const [onTime, absent, late, early] = await Promise.all([
        prisma.attendance.count({
          where: {
            companyId,
            date: {
              gte: currentDate,
              lt: nextDate,
            },
            status: "ON_TIME",
          },
        }),
        prisma.attendance.count({
          where: {
            companyId,
            date: {
              gte: currentDate,
              lt: nextDate,
            },
            status: "ABSENT",
          },
        }),
        prisma.attendance.count({
          where: {
            companyId,
            date: {
              gte: currentDate,
              lt: nextDate,
            },
            status: "LATE",
          },
        }),
        prisma.attendance.count({
          where: {
            companyId,
            date: {
              gte: currentDate,
              lt: nextDate,
            },
            status: "EARLY",
          },
        }),
      ]);

      attendanceData.push({
        day: weekDays[i],
        onTime,
        absent,
        late,
        early,
      });
    }

    res.status(200).json({ success: true, data: attendanceData });
  } catch (error) {
    console.error("❌ Error in getWeeklyAttendanceOverview:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getDepartmentDistribution = async (req, res) => {
  const companyId = req.user.companyId;

  if (!companyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Get employee count by department using proper Prisma aggregation
    const departmentData = await prisma.department.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        employees: {
          where: {
            deleted: false,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        },
      },
    });

    // Transform data to match frontend expectations
    const transformedData = departmentData
      .map((dept) => ({
        name: dept.name,
        value: dept.employees.length,
        color: "", // We'll assign colors after filtering
      }))
      .sort((a, b) => b.value - a.value) // Sort by employee count descending
      .map((dept, index) => {
        const colors = [
          "hsl(var(--hr-chart-1))",
          "hsl(var(--hr-chart-2))",
          "hsl(var(--hr-chart-3))",
          "hsl(var(--hr-chart-4))",
          "hsl(var(--hr-chart-5))",
          "hsl(var(--accent))",
        ];

        return {
          ...dept,
          color: colors[index % colors.length],
        };
      });

    res.status(200).json({ success: true, data: transformedData });
  } catch (error) {
    console.error("❌ Error in getDepartmentDistribution:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getDashboardActivities = async (req, res) => {
  const companyId = req.user.companyId;
  const { limit = 10, page = 1 } = req.query;

  if (!companyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const activities = await getRecentActivities(companyId, parseInt(limit));

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: activities.length,
      },
    });
  } catch (error) {
    console.error("❌ Error in getDashboardActivities:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
