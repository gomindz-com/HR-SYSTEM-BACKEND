import prisma from "../config/prisma.config.js";
import { transporter } from "../config/transporter.js";
import {
  createActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  ICON_TYPES,
} from "../lib/activity-utils.js";
import { createNotification } from "../utils/notification.utils.js";
import { getDepartmentFilter } from "../utils/access-control.utils.js";
import {
  sendLeaveRequestSubmittedEmail,
  sendManagerApprovalEmail,
  sendManagerRejectionEmail,
  sendHRApprovalEmail,
  sendHRRejectionEmail,
} from "../emails/leaveEmails.js";
// REQUEST LEAVE
export const requestLeave = async (req, res) => {
  const id = req.user.id;
  const companyId = req.user.companyId;
  const { leaveType, startDate, endDate, comments } = req.body;

  // Basic validation
  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  if (!id) {
    return res.status(400).json({ message: "user id is required" });
  }

  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ message: "missing required field" });
  }

  // Validate leave type
  const validLeaveTypes = [
    "STUDY",
    "MATERNITY",
    "SICK",
    "PERSONAL",
    "VACATION",
    "ANNUAL",
  ];
  if (!validLeaveTypes.includes(leaveType)) {
    return res.status(400).json({
      message: "invalid leave type",
      validTypes: validLeaveTypes,
    });
  }

  // Date validation
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today

  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "invalid date format" });
  }

  // Check if start date is in the past
  if (start < today) {
    return res.status(400).json({
      message: "start date cannot be in the past",
      startDate: startDate,
      today: today.toISOString().split("T")[0],
    });
  }

  // Check if end date is in the past
  if (end < today) {
    return res.status(400).json({
      message: "end date cannot be in the past",
      endDate: endDate,
      today: today.toISOString().split("T")[0],
    });
  }

  // Check if start date is before end date
  if (start > end) {
    return res.status(400).json({
      message: "start date must be before end date",
      startDate: startDate,
      endDate: endDate,
    });
  }

  // Check if leave duration is reasonable (max 90 days)
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  if (days > 90) {
    return res.status(400).json({
      message: "leave duration cannot exceed 90 days",
      requestedDays: days,
      maxDays: 90,
    });
  }

  // Check if leave duration is at least 1 day
  if (days < 1) {
    return res.status(400).json({
      message: "leave duration must be at least 1 day",
      requestedDays: days,
    });
  }

  try {
    const attachments = req.files ? req.files.map((file) => file.path) : [];

    // Check if user already has a pending leave request for overlapping dates
    const existingLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: id,
        companyId: companyId,
        status: "PENDING",
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });

    if (existingLeave) {
      return res.status(400).json({
        message:
          "you already have a pending leave request for overlapping dates",
        existingRequest: {
          id: existingLeave.id,
          startDate: existingLeave.startDate,
          endDate: existingLeave.endDate,
          leaveType: existingLeave.leaveType,
        },
      });
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: id,
        companyId: companyId,
        leaveType: leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        days: days,
        comments: comments,
        status: "PENDING",
        attachmentUrls: attachments,
      },
    });

    // Create activity for new leave request
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.LEAVE_REQUEST,
      title: "New Leave Request",
      description: `${req.user.name} requested ${leaveType} leave for ${days} days`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.LEAVE,
    });

    // Get employee data for email
    const employee = await prisma.employee.findUnique({
      where: { id: id },
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
      },
    });

    // Send confirmation email to employee
    if (employee) {
      try {
        await sendLeaveRequestSubmittedEmail(employee, leaveRequest);
      } catch (emailError) {
        console.error(
          "Error sending leave request submitted email:",
          emailError
        );
        // Don't fail the request if email fails
      }
    }

    // Notify Manager or HR/Admin about new leave request
    try {
      let notifyUserId = null;

      // Find manager in same department
      if (employee?.departmentId) {
        const manager = await prisma.employee.findFirst({
          where: {
            companyId: companyId,
            departmentId: employee.departmentId,
            role: "MANAGER",
            deleted: false,
          },
          select: { id: true },
        });

        if (manager) {
          notifyUserId = manager.id;
        }
      }

      // If no manager found, notify ADMIN/HR
      if (!notifyUserId) {
        const adminUser = await prisma.employee.findFirst({
          where: {
            companyId: companyId,
            role: "ADMIN",
            deleted: false,
          },
          select: { id: true },
        });

        if (adminUser) {
          notifyUserId = adminUser.id;
        }
      }

      if (notifyUserId) {
        await createNotification({
          companyId,
          userId: notifyUserId,
          message: `${req.user.name} requested ${leaveType} leave (${days} days)`,
          type: "LEAVE_REQUESTED",
          category: "LEAVE",
          priority: "HIGH",
          redirectUrl: `/leave`,
        });
      }
    } catch (notifError) {
      console.error("Error creating leave request notification:", notifError);
      // Don't fail the request if notification fails
    }

    return res.status(201).json({
      message: "leave request created successfully",
      data: leaveRequest,
    });
  } catch (error) {
    console.log("error in requestLeave controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET ALL LEAVE REQUESTS
export const getLeaveRequests = async (req, res) => {
  const companyId = req.user.companyId;

  // Pagination params
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  // Search and filter params
  const searchTerm = req.query.search || "";
  const statusFilter = req.query.status || "";
  const leaveTypeFilter = req.query.leaveType || "";

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  try {
    // Validate leaveType filter
    const validLeaveTypes = [
      "STUDY",
      "MATERNITY",
      "SICK",
      "PERSONAL",
      "VACATION",
      "ANNUAL",
    ];
    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];

    // Build where clause for filtering
    const whereClause = {
      companyId: companyId,
      ...(searchTerm && {
        employee: {
          name: {
            contains: searchTerm,
            mode: "insensitive", // Case-insensitive search
          },
        },
      }),
      ...(statusFilter &&
        statusFilter !== "all" &&
        validStatuses.includes(statusFilter.toUpperCase()) && {
          status: statusFilter.toUpperCase(),
        }),
      ...(leaveTypeFilter &&
        leaveTypeFilter !== "all" &&
        validLeaveTypes.includes(leaveTypeFilter.toUpperCase()) && {
          leaveType: leaveTypeFilter.toUpperCase(),
        }),
      employee: {
        ...getDepartmentFilter(req.user),
      },
    };

    const [leaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: "desc", // Most recent first
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              profilePic: true,
              email: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.leaveRequest.count({
        where: whereClause,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        leaveRequests,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filters: {
        searchTerm,
        statusFilter,
        leaveTypeFilter,
      },
    });
  } catch (error) {
    console.log("error in getLeaveRequests controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET MY LEAVE REQUESTS
export const getMyLeaveRequests = async (req, res) => {
  const id = req.user.id;
  const companyId = req.user.companyId;

  // Pagination params
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  if (!id) {
    return res.status(400).json({ message: "user id is required" });
  }

  try {
    const [myLeaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { employeeId: id, companyId: companyId },
        skip,
        take: pageSize,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePic: true,
            },
          },
        },
      }),

      prisma.leaveRequest.count({
        where: { employeeId: id, companyId: companyId },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        myLeaveRequests,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.log("error in cancelLeaveRequest controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ==========MANAGER APPROVAL==========
export const approveLeave = async (req, res) => {
  const id = req.params.id;
  const companyId = req.user.companyId;

  if (!id) {
    return res.status(400).json({ message: "leave request id is required" });
  }

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  try {
    // First get the leave request details with employee info
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id), companyId: companyId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return res.status(404).json({ message: "leave request not found" });
    }

    // Update the leave request status
    await prisma.leaveRequest.update({
      where: { id: parseInt(id), companyId: companyId },
      data: {
        status: "APPROVED",
        approverId: req.user.id,
        isApproved: true,
        approvedAt: new Date(),
        updatedAt: new Date(),
        hrApprovalStatus: "PENDING", // Still needs HR approval
      },
    });

    // Send email notification to the employee
    try {
      await sendManagerApprovalEmail(leaveRequest.employee, leaveRequest);
    } catch (emailError) {
      console.error("Error sending manager approval email:", emailError);
      // Don't fail the request if email fails
    }

    // Create activity for approved leave request
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.LEAVE_REQUEST,
      title: "Leave Request Approved",
      description: `${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave request was approved`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.LEAVE,
    });

    // Notify employee about approval
    try {
      await createNotification({
        companyId,
        userId: leaveRequest.employee.id,
        message: `Your ${leaveRequest.leaveType} leave was approved by manager - pending HR review`,
        type: "LEAVE_APPROVED",
        category: "LEAVE",
        priority: "NORMAL",
        redirectUrl: `/leave`,
      });
    } catch (notifError) {
      console.error("Error creating leave approval notification:", notifError);
      // Don't fail the request if notification fails
    }

    // Notify HR/Admin about manager approval
    try {
      const adminUser = await prisma.employee.findFirst({
        where: {
          companyId: companyId,
          role: "ADMIN",
          deleted: false,
        },
        select: { id: true },
      });

      if (adminUser) {
        await createNotification({
          companyId,
          userId: adminUser.id,
          message: `${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave was approved by manager - pending HR review`,
          type: "LEAVE_REQUESTED",
          category: "LEAVE",
          priority: "HIGH",
          redirectUrl: `/leave`,
        });
      }
    } catch (notifError) {
      console.error(
        "Error creating HR notification for manager approval:",
        notifError
      );
      // Don't fail the request if notification fails
    }

    return res
      .status(200)
      .json({ message: "leave request approved successfully" });
  } catch (error) {
    console.log("error in approveLeave controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ==========MANAGER REJECT LEAVE==========
export const rejectLeave = async (req, res) => {
  const id = req.params.id;
  const companyId = req.user.companyId;
  const { rejectReason } = req.body;

  if (!id) {
    return res.status(400).json({ message: "leave request id is required" });
  }

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  if (!rejectReason) {
    return res.status(400).json({ message: "reject reason is required" });
  }

  try {
    // First get the leave request details with employee info
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(id), companyId: companyId },
      include: {
        employee: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!leaveRequest) {
      return res.status(404).json({ message: "leave request not found" });
    }

    // Update the leave request status
    await prisma.leaveRequest.update({
      where: { id: parseInt(id), companyId: companyId },
      data: {
        status: "REJECTED",
        approverId: req.user.id,
        updatedAt: new Date(),
        rejectReason: rejectReason,
        hrApprovalStatus: "PENDING", // HR can still review
      },
    });

    // Send email notification to the employee
    try {
      await sendManagerRejectionEmail(
        leaveRequest.employee,
        leaveRequest,
        rejectReason
      );
    } catch (emailError) {
      console.error("Error sending manager rejection email:", emailError);
      // Don't fail the request if email fails
    }

    // Create activity for rejected leave request
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.LEAVE_REQUEST,
      title: "Leave Request Rejected",
      description: `${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave request was rejected`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.LEAVE,
    });

    // Notify employee about rejection
    try {
      await createNotification({
        companyId,
        userId: leaveRequest.employee.id,
        message: `Your ${leaveRequest.leaveType} leave was rejected by manager: ${rejectReason}`,
        type: "LEAVE_REJECTED",
        category: "LEAVE",
        priority: "HIGH",
        redirectUrl: `/leave`,
      });
    } catch (notifError) {
      console.error("Error creating leave rejection notification:", notifError);
      // Don't fail the request if notification fails
    }

    // Notify HR/Admin about manager rejection
    try {
      const adminUser = await prisma.employee.findFirst({
        where: {
          companyId: companyId,
          role: "ADMIN",
          deleted: false,
        },
        select: { id: true },
      });

      if (adminUser) {
        await createNotification({
          companyId,
          userId: adminUser.id,
          message: `${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave was rejected by manager - HR can review`,
          type: "LEAVE_REQUESTED",
          category: "LEAVE",
          priority: "HIGH",
          redirectUrl: `/leave`,
        });
      }
    } catch (notifError) {
      console.error(
        "Error creating HR notification for manager rejection:",
        notifError
      );
      // Don't fail the request if notification fails
    }

    return res
      .status(200)
      .json({ message: "leave request rejected successfully" });
  } catch (error) {
    console.log("error in rejectLeave controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ==========HR APPROVAL==========
export const hrApproveLeave = async (req, res) => {
  const leaveId = req.params.id; // Fix: was req.params
  const { id, companyId } = req.user;

  if (!leaveId) {
    return res.status(400).json({ message: "leave id is required" });
  }

  if (!id) {
    return res.status(400).json({ message: "user id is required" });
  }

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  try {
    // Fetch leave request with employee data
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(leaveId), companyId: companyId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return res.status(404).json({ message: "leave request not found" });
    }

    // Check if already approved by HR
    if (leaveRequest.hrApprovalStatus === "APPROVED") {
      return res
        .status(400)
        .json({ message: "leave request is already approved by hr" });
    }

    // Check if HR approval is pending
    if (leaveRequest.hrApprovalStatus !== "PENDING") {
      return res
        .status(400)
        .json({ message: "leave request is not pending for hr approval" });
    }

    // Determine previous manager status for email context
    const wasManagerApproved = leaveRequest.status === "APPROVED";
    const wasManagerRejected = leaveRequest.status === "REJECTED";

    // Update database based on current status
    let updateData = {
      hrApprovalStatus: "APPROVED",
    };

    if (leaveRequest.status === "PENDING") {
      // Single-tier: HR approves without manager approval
      updateData.status = "APPROVED";
      updateData.approverId = id;
      updateData.isApproved = true;
      updateData.approvedAt = new Date();
    } else if (leaveRequest.status === "REJECTED") {
      // Override: HR approves after manager rejection
      updateData.status = "APPROVED";
      updateData.approverId = id;
      updateData.isApproved = true;
      updateData.approvedAt = new Date();
    }
    // If status is already "APPROVED", just update hrApprovalStatus

    await prisma.leaveRequest.update({
      where: { id: parseInt(leaveId), companyId: companyId },
      data: updateData,
    });

    // Send email notification to the employee
    try {
      await sendHRApprovalEmail(
        leaveRequest.employee,
        leaveRequest,
        wasManagerApproved,
        wasManagerRejected
      );
    } catch (emailError) {
      console.error("Error sending HR approval email:", emailError);
      // Don't fail the request if email fails
    }

    // Create activity
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.LEAVE_REQUEST,
      title: "Leave Fully Approved",
      description: `HR approved ${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave (${leaveRequest.days} days)`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.LEAVE,
    });

    // Notify employee
    try {
      await createNotification({
        companyId,
        userId: leaveRequest.employee.id,
        message: `Your ${leaveRequest.leaveType} leave was fully approved by HR`,
        type: "LEAVE_APPROVED",
        category: "LEAVE",
        priority: "HIGH",
        redirectUrl: `/leave`,
      });
    } catch (notifError) {
      console.error("Error creating leave approval notification:", notifError);
      // Don't fail the request if notification fails
    }

    // Notify manager if they approved/rejected before
    if (wasManagerApproved || wasManagerRejected) {
      try {
        // Find manager in same department
        if (leaveRequest.employee.departmentId) {
          const manager = await prisma.employee.findFirst({
            where: {
              companyId: companyId,
              departmentId: leaveRequest.employee.departmentId,
              role: "MANAGER",
              deleted: false,
            },
            select: { id: true },
          });

          if (manager) {
            const message = wasManagerApproved
              ? `HR approved ${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave (you approved it)`
              : `HR overrode your rejection and approved ${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave`;

            await createNotification({
              companyId,
              userId: manager.id,
              message: message,
              type: "LEAVE_APPROVED",
              category: "LEAVE",
              priority: "NORMAL",
              redirectUrl: `/leave`,
            });
          }
        }
      } catch (notifError) {
        console.error("Error creating manager notification:", notifError);
        // Don't fail the request if notification fails
      }
    }

    res
      .status(200)
      .json({ message: "leave request approved by hr successfully" });
  } catch (error) {
    console.log("error in hrApproveLeave controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ==========HR REJECT LEAVE==========
export const hrRejectLeave = async (req, res) => {
  const leaveId = req.params.id; // Fix: was req.params
  const { hrRejectReason } = req.body;
  const { id, companyId } = req.user;

  if (!leaveId) {
    return res.status(400).json({ message: "leave id is required" });
  }

  if (!hrRejectReason) {
    return res.status(400).json({ message: "HR reject reason is required" });
  }

  if (!id) {
    return res.status(400).json({ message: "user id is required" });
  }

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  try {
    // Fetch leave request with employee data
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: parseInt(leaveId), companyId: companyId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return res.status(404).json({ message: "leave request not found" });
    }

    // Check if already approved by HR
    if (leaveRequest.hrApprovalStatus === "APPROVED") {
      return res
        .status(400)
        .json({ message: "leave request is already approved by hr" });
    }

    // Check if HR approval is pending
    if (leaveRequest.hrApprovalStatus !== "PENDING") {
      return res
        .status(400)
        .json({ message: "leave request is not pending for hr approval" });
    }

    // Determine if manager approved before
    const wasManagerApproved = leaveRequest.status === "APPROVED";

    // Update database
    let updateData = {
      hrApprovalStatus: "REJECTED",
      hrRejectReason: hrRejectReason,
    };

    if (leaveRequest.status === "APPROVED") {
      // Override manager approval
      updateData.status = "REJECTED";
    } else if (leaveRequest.status === "PENDING") {
      // HR rejects without manager approval
      updateData.status = "REJECTED";
    }
    // If status is already "REJECTED", just update hrApprovalStatus

    await prisma.leaveRequest.update({
      where: { id: parseInt(leaveId), companyId: companyId },
      data: updateData,
    });

    // Send email notification to the employee
    try {
      await sendHRRejectionEmail(
        leaveRequest.employee,
        leaveRequest,
        hrRejectReason,
        wasManagerApproved
      );
    } catch (emailError) {
      console.error("Error sending HR rejection email:", emailError);
      // Don't fail the request if email fails
    }

    // Create activity
    await createActivity({
      companyId,
      type: ACTIVITY_TYPES.LEAVE_REQUEST,
      title: "Leave Rejected by HR",
      description: `HR rejected ${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave`,
      priority: PRIORITY_LEVELS.HIGH,
      icon: ICON_TYPES.LEAVE,
    });

    // Notify employee
    try {
      await createNotification({
        companyId,
        userId: leaveRequest.employee.id,
        message: `Your ${leaveRequest.leaveType} leave was rejected by HR: ${hrRejectReason}`,
        type: "LEAVE_REJECTED",
        category: "LEAVE",
        priority: "HIGH",
        redirectUrl: `/leave`,
      });
    } catch (notifError) {
      console.error("Error creating leave rejection notification:", notifError);
      // Don't fail the request if notification fails
    }

    // Notify manager if they approved before
    if (wasManagerApproved) {
      try {
        // Find manager in same department
        if (leaveRequest.employee.departmentId) {
          const manager = await prisma.employee.findFirst({
            where: {
              companyId: companyId,
              departmentId: leaveRequest.employee.departmentId,
              role: "MANAGER",
              deleted: false,
            },
            select: { id: true },
          });

          if (manager) {
            await createNotification({
              companyId,
              userId: manager.id,
              message: `HR overrode your approval and rejected ${leaveRequest.employee.name}'s ${leaveRequest.leaveType} leave`,
              type: "LEAVE_REJECTED",
              category: "LEAVE",
              priority: "NORMAL",
              redirectUrl: `/leave`,
            });
          }
        }
      } catch (notifError) {
        console.error("Error creating manager notification:", notifError);
        // Don't fail the request if notification fails
      }
    }

    res
      .status(200)
      .json({ message: "leave request rejected by hr successfully" });
  } catch (error) {
    console.log("error in hrRejectLeave controller", error);
    return res
      .status(500)
      .json({ error: error.message, message: "Internal server error" });
  }
};

// GET LEAVE STATS
export const getLeaveStats = async (req, res) => {
  const companyId = req.user.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  try {
    const [
      pendingCount,
      approvedCount,
      rejectedCount,
      totalDays,
      totalRequests,
    ] = await Promise.all([
      // Count pending requests
      prisma.leaveRequest.count({
        where: {
          companyId: companyId,
          status: "PENDING",
          employee: {
            ...getDepartmentFilter(req.user),
          },
        },
      }),
      // Count fully approved requests (HR approved)
      prisma.leaveRequest.count({
        where: {
          companyId: companyId,
          status: "APPROVED",
          hrApprovalStatus: "APPROVED", // Only count fully approved
          employee: {
            ...getDepartmentFilter(req.user),
          },
        },
      }),
      // Count rejected requests
      prisma.leaveRequest.count({
        where: {
          companyId: companyId,
          status: "REJECTED",
          employee: {
            ...getDepartmentFilter(req.user),
          },
        },
      }),
      // Sum total days from fully approved requests (HR approved)
      prisma.leaveRequest.aggregate({
        where: {
          companyId: companyId,
          status: "APPROVED",
          hrApprovalStatus: "APPROVED", // Only count fully approved
          employee: {
            ...getDepartmentFilter(req.user),
          },
        },
        _sum: {
          days: true,
        },
      }),
      // Count total requests
      prisma.leaveRequest.count({
        where: {
          companyId: companyId,
          employee: {
            ...getDepartmentFilter(req.user),
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          pendingCount,
          approvedCount,
          rejectedCount,
          totalDays: totalDays._sum.days || 0,
          totalRequests,
        },
      },
    });
  } catch (error) {
    console.log("error in getLeaveStats controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET EMPLOYEE LEAVE BALANCE
export const getEmployeeLeaveBalance = async (req, res) => {
  const employeeId = req.user.id;
  const companyId = req.user.companyId;

  if (!employeeId) {
    return res.status(400).json({ message: "employee id is required" });
  }

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  try {
    const [pendingRequests, approvedRequests, rejectedRequests, totalDaysUsed] =
      await Promise.all([
        // Count pending requests for this employee
        prisma.leaveRequest.count({
          where: {
            employeeId: employeeId,
            companyId: companyId,
            status: "PENDING",
          },
        }),
        // Count fully approved requests for this employee (HR approved)
        prisma.leaveRequest.count({
          where: {
            employeeId: employeeId,
            companyId: companyId,
            status: "APPROVED",
            hrApprovalStatus: "APPROVED", // Only count fully approved
          },
        }),
        // Count rejected requests for this employee
        prisma.leaveRequest.count({
          where: {
            employeeId: employeeId,
            companyId: companyId,
            status: "REJECTED",
          },
        }),
        // Sum total days used from fully approved requests (HR approved)
        prisma.leaveRequest.aggregate({
          where: {
            employeeId: employeeId,
            companyId: companyId,
            status: "APPROVED",
            hrApprovalStatus: "APPROVED", // Only count fully approved
          },
          _sum: {
            days: true,
          },
        }),
      ]);

    const daysUsed = totalDaysUsed._sum.days || 0;

    // Days available: count of rejected requests only (not pending)
    const unapprovedRequests = rejectedRequests;

    return res.status(200).json({
      success: true,
      data: {
        leaveBalance: {
          daysLeft: unapprovedRequests, // Changed to unapproved requests count
          daysUsed: approvedRequests, // Count of approved requests
          pendingRequests,
          annualLeaveAllowance: 25, // Keep for reference
        },
      },
    });
  } catch (error) {
    console.log("error in getEmployeeLeaveBalance controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
