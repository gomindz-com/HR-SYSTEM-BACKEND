import prisma from "../config/prisma.config.js";
import { transporter } from "../config/transporter.js";

// REQUEST LEAVE
export const requestLeave = async (req, res) => {
  const id = req.user.id;
  const companyId = req.user.companyId;
  const { leaveType, startDate, endDate, comments } = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "company id is required" });
  }

  if (!id) {
    return res.status(400).json({ message: "user id is required" });
  }

  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ message: "missing required field" });
  }

  if (startDate > endDate) {
    return res
      .status(400)
      .json({ message: "start date must be before end date" });
  }

  try {
    const attachments = req.files ? req.files.map((file) => file.path) : [];

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: id,
        companyId: companyId,
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        days: endDate - startDate + 1,
        comments: comments,
        status: "PENDING",
        attachmentUrls: attachments,
      },
    });

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
        updatedAt: new Date(),
      },
    });

    // Send email notification to the employee
    const emailContent = {
      from: process.env.GMAIL_USER,
      to: leaveRequest.employee.email,
      subject: "Leave Request Approved",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Leave Request Approved</h2>
          <p>Dear ${leaveRequest.employee.name},</p>
          <p>Your leave request has been <strong>approved</strong>.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #495057;">Leave Details:</h3>
            <p><strong>Leave Type:</strong> ${leaveRequest.leaveType}</p>
            <p><strong>Start Date:</strong> ${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
            <p><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
            ${leaveRequest.comments ? `<p><strong>Comments:</strong> ${leaveRequest.comments}</p>` : ""}
          </div>
          
          <p>Your leave has been approved and is now confirmed. Please ensure all your work is properly handed over before your leave period.</p>
          
          <p>If you have any questions, please contact your supervisor or HR department.</p>
          
          <p>Best regards,<br>HR Team</p>
        </div>
      `,
    };

    // Send the email
    await transporter.sendMail(emailContent);

    return res
      .status(200)
      .json({ message: "leave request approved successfully" });
  } catch (error) {
    console.log("error in approveLeave controller", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// REJECT LEAVE
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
      },
    });

    // Send email notification to the employee
    const emailContent = {
      from: process.env.GMAIL_USER,
      to: leaveRequest.employee.email,
      subject: "Leave Request Rejected",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">Leave Request Rejected</h2>
          <p>Dear ${leaveRequest.employee.name},</p>
          <p>We regret to inform you that your leave request has been <strong>rejected</strong>.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #495057;">Leave Details:</h3>
            <p><strong>Leave Type:</strong> ${leaveRequest.leaveType}</p>
            <p><strong>Start Date:</strong> ${new Date(leaveRequest.startDate).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(leaveRequest.endDate).toLocaleDateString()}</p>
            <p><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
            ${leaveRequest.comments ? `<p><strong>Your Comments:</strong> ${leaveRequest.comments}</p>` : ""}
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">Rejection Reason:</h3>
            <p><strong>${rejectReason}</strong></p>
          </div>
          
          <p>If you have any questions about this decision or would like to discuss alternative arrangements, please contact your supervisor or HR department.</p>
          
          <p>Best regards,<br>HR Team</p>
        </div>
      `,
    };

    // Send the email
    await transporter.sendMail(emailContent);

    return res
      .status(200)
      .json({ message: "leave request rejected successfully" });
  } catch (error) {
    console.log("error in rejectLeave controller", error);
    return res.status(500).json({ message: "Internal server error" });
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
        },
      }),
      // Count approved requests
      prisma.leaveRequest.count({
        where: {
          companyId: companyId,
          status: "APPROVED",
        },
      }),
      // Count rejected requests
      prisma.leaveRequest.count({
        where: {
          companyId: companyId,
          status: "REJECTED",
        },
      }),
      // Sum total days from approved requests
      prisma.leaveRequest.aggregate({
        where: {
          companyId: companyId,
          status: "APPROVED",
        },
        _sum: {
          days: true,
        },
      }),
      // Count total requests
      prisma.leaveRequest.count({
        where: {
          companyId: companyId,
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
