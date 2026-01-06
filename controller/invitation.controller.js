import prisma from "../config/prisma.config.js";
import { transporter } from "../config/transporter.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  createActivity,
  ACTIVITY_TYPES,
  PRIORITY_LEVELS,
  ICON_TYPES,
} from "../lib/activity-utils.js";
import { createNotification } from "../utils/notification.utils.js";

export const sendInvitation = async (req, res) => {
  const { email, role, position, departmentId, employeeId, shiftType } =
    req.body;
  const id = req.user.id;
  const companyId = req.user.companyId;

  try {
    if (!companyId) {
      return res
        .status(400)
        .json({ message: "your session is not associated with any company" });
    }
    if (!departmentId) {
      return res.status(400).json({ message: "departmentId is required" });
    }

    // Only ADMIN can send invitations
    if (req.user.role !== "ADMIN") {
      return res
        .status(401)
        .json({ message: "only ADMIN can send invitations" });
    }

    // Normalize email to handle case sensitivity and whitespace
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.employee.findUnique({
      where: {
        email: normalizedEmail,
        companyId,
      },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        companyId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return res
        .status(400)
        .json({ message: "Invitation already sent to this email" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(400).json({ message: "Company not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    if (role === "MANAGER") {
      const findManager = await prisma.employee.findFirst({
        where: {
          companyId,
          role: "MANAGER",
          departmentId,
        },
      });

      if (findManager) {
        return res.status(400).json({ message: "Manager already exists" });
      }

      // Also check pending invitations for MANAGER role in this department
      const pendingManagerInvite = await prisma.invitation.findFirst({
        where: {
          companyId,
          role: "MANAGER",
          departmentId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      });

      if (pendingManagerInvite) {
        return res.status(400).json({
          message:
            "A manager invitation is already pending for this department",
        });
      }
    }
    await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        position,
        role: role || "STAFF",
        companyId,
        invitedBy: id,
        employeeId: employeeId || null,
        shiftType: shiftType || "MORNING_SHIFT",
        token,
        expiresAt,
        status: "PENDING",
        createdAt: new Date(),
        departmentId,
      },
    });

    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:8080"
        : "https://hr.gomindz.gm";
    const invitationUrl = `${baseUrl}/accept-invitation/${token}`;

    const mailOptions = {
      from: `"HR System" <${process.env.GMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Invitation to join company",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
            <h2 style="color: #007bff; margin-top: 0;">Company Invitation</h2>
            <p>Hello,</p>
            <p>You are invited to join <strong>${company.companyName}</strong> as <strong>${
              position || "Employee"
            }</strong>.</p>
            <p>Please click the button below to accept the invitation:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" style="background: #007bff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #6c757d; font-size: 14px;">This invitation will expire in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">Thank you,<br/>The HR System Team</p>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Invitation email sent successfully:", {
        to: normalizedEmail,
        companyName: company.companyName,
        position: position || "Employee",
        timestamp: new Date().toISOString(),
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", {
        to: normalizedEmail,
        error: emailError.message,
        timestamp: new Date().toISOString(),
      });
      // Continue execution - invitation is already saved in database
    }

    res.status(200).json({
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.log("Error in sendInvitation", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendBulkInvitations = async (req, res) => {
  const { invitations, autoCreateDepartments = true } = req.body;
  const id = req.user.id;
  const companyId = req.user.companyId;

  try {
    if (!companyId) {
      return res.status(400).json({
        message: "your session is not associated with any company",
      });
    }

    // Only ADMIN can send bulk invitations
    if (req.user.role !== "ADMIN") {
      return res.status(401).json({
        message: "only ADMIN can send bulk invitations",
      });
    }

    if (
      !invitations ||
      !Array.isArray(invitations) ||
      invitations.length === 0
    ) {
      return res.status(400).json({
        message: "invitations array is required and must not be empty",
      });
    }

    const results = [];
    const errors = [];
    const createdDepartments = new Map(); // Cache for created departments

    // Get company info once
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(400).json({ message: "Company not found" });
    }

    for (const invitation of invitations) {
      const { email, role, position, departmentName, employeeId, shiftType } =
        invitation;

      try {
        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await prisma.employee.findUnique({
          where: { email: normalizedEmail, companyId },
        });

        if (existingUser) {
          errors.push({ email: normalizedEmail, error: "User already exists" });
          continue;
        }

        // Check for existing pending invitation
        const existingInvitation = await prisma.invitation.findFirst({
          where: {
            email: normalizedEmail,
            companyId,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        });

        if (existingInvitation) {
          errors.push({
            email: normalizedEmail,
            error: "Invitation already sent",
          });
          continue;
        }

        // Handle department - either find existing or create new
        let departmentId = null;

        if (departmentName) {
          // First check if we already created this department in this batch
          if (createdDepartments.has(departmentName.toLowerCase())) {
            departmentId = createdDepartments.get(departmentName.toLowerCase());
          } else {
            // Check if department already exists
            let department = await prisma.department.findFirst({
              where: {
                name: { equals: departmentName, mode: "insensitive" },
                companyId,
              },
            });

            // If department doesn't exist and auto-creation is enabled, create it
            if (!department && autoCreateDepartments) {
              department = await prisma.department.create({
                data: {
                  name: departmentName,
                  companyId,
                  managerId: id,
                },
              });

              // Cache the created department
              createdDepartments.set(
                departmentName.toLowerCase(),
                department.id
              );

              console.log(`Created new department: ${departmentName}`);
            }

            if (department) {
              departmentId = department.id;
            } else {
              errors.push({
                email: normalizedEmail,
                error: `Department "${departmentName}" not found and auto-creation is disabled`,
              });
              continue;
            }
          }
        }

        // Check if role is MANAGER - enforce one manager per department
        if (role === "MANAGER" && departmentId) {
          const findManager = await prisma.employee.findFirst({
            where: {
              companyId,
              role: "MANAGER",
              departmentId,
            },
          });

          if (findManager) {
            errors.push({
              email: normalizedEmail,
              error: "Manager already exists for this department",
            });
            continue;
          }

          // Also check pending invitations for MANAGER role in this department
          const pendingManagerInvite = await prisma.invitation.findFirst({
            where: {
              companyId,
              role: "MANAGER",
              departmentId,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
          });

          if (pendingManagerInvite) {
            errors.push({
              email: normalizedEmail,
              error:
                "A manager invitation is already pending for this department",
            });
            continue;
          }
        }

        // Create invitation
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.invitation.create({
          data: {
            email: normalizedEmail,
            position,
            role: role || "STAFF",
            companyId,
            invitedBy: id,
            employeeId: employeeId || null,
            shiftType: shiftType || "MORNING_SHIFT",
            token,
            expiresAt,
            status: "PENDING",
            createdAt: new Date(),
            departmentId,
          },
        });

        // Send email
        const baseUrl =
          process.env.NODE_ENV === "development"
            ? "http://localhost:8080"
            : process.env.CLIENT_URL;

        const invitationUrl = `${baseUrl}/accept-invitation/${token}`;

        try {
          await transporter.sendMail({
            from: `"HR System" <${process.env.GMAIL_USER}>`,
            to: normalizedEmail,
            subject: "Invitation to join company",
            html: `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff;">
                  <h2 style="color: #007bff; margin-top: 0;">Company Invitation</h2>
                  <p>Hello,</p>
                  <p>You are invited to join <strong>${company.companyName}</strong> as <strong>${position || "Employee"}</strong>.</p>
                  ${departmentName ? `<p>Department: <strong>${departmentName}</strong></p>` : ""}
                  <p>Please click the button below to accept the invitation:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${invitationUrl}" style="background: #007bff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                      Accept Invitation
                    </a>
                  </div>
                  <p style="color: #6c757d; font-size: 14px;">This invitation will expire in 24 hours.</p>
                  <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                  <p style="color: #6c757d; font-size: 12px; margin-bottom: 0;">Thank you,<br/>The HR System Team</p>
                </div>
              </div>
            `,
          });
        } catch (emailError) {
          console.error("Failed to send bulk invitation email:", {
            to: normalizedEmail,
            error: emailError.message,
            timestamp: new Date().toISOString(),
          });
          // Continue execution - invitation is already saved in database
        }

        results.push({
          email: normalizedEmail,
          status: "success",
          departmentCreated: createdDepartments.has(
            departmentName?.toLowerCase()
          ),
        });
      } catch (error) {
        errors.push({ email: email || "unknown", error: error.message });
      }
    }

    res.json({
      success: true,
      results,
      errors,
      summary: {
        total: invitations.length,
        successful: results.length,
        failed: errors.length,
        departmentsCreated: createdDepartments.size,
      },
    });
  } catch (error) {
    console.log("Error in sendBulkInvitations", error);
    res.status(500).json({
      message: "Failed to process bulk invitations",
      error: error.message,
    });
  }
};

export const acceptInvitation = async (req, res) => {
  const { token } = req.params;
  const { name, password, confirmPassword } = req.body;

  try {
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    if (confirmPassword !== password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const invitation = await prisma.invitation.findFirst({
      where: {
        token,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      return res.status(400).json({ message: "Invalid or expired invitation" });
    }

    const existingUser = await prisma.employee.findUnique({
      where: { email: invitation.email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const now = new Date();
    if (invitation.expiresAt < now) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: "EXPIRED",
        },
      });
      return res.status(400).json({ message: "Invitation has expired" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    // Check if employeeId from invitation is already taken
    // If it is, set it to null to avoid unique constraint violation
    let finalEmployeeId = invitation.employeeId || null;
    if (finalEmployeeId) {
      const existingEmployeeWithId = await prisma.employee.findUnique({
        where: { employeeId: finalEmployeeId },
      });

      if (existingEmployeeWithId) {
        // EmployeeId is already taken, set to null
        // Employee can still be created without employeeId
        console.warn(
          `EmployeeId "${finalEmployeeId}" from invitation is already taken. Creating employee without employeeId.`
        );
        finalEmployeeId = null;
      }
    }

    const newEmployee = await prisma.employee.create({
      data: {
        name,
        email: invitation.email.toLowerCase().trim(),
        password: hashedPassword,
        companyId: invitation.companyId,
        role: invitation.role,
        employeeId: finalEmployeeId,
        profilePic: randomAvatar,
        position: invitation.position,
        shiftType: invitation.shiftType || "MORNING_SHIFT",
        createdAt: new Date(),
        departmentId: invitation.departmentId,
        emailVerified: true, // Invited users are pre-verified via invitation email
      },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    // Create activity for new employee joining
    await createActivity({
      companyId: invitation.companyId,
      type: ACTIVITY_TYPES.EMPLOYEE_ADDED,
      title: "New Employee Joined",
      description: `${name} joined the company as ${invitation.position}`,
      priority: PRIORITY_LEVELS.NORMAL,
      icon: ICON_TYPES.EMPLOYEE,
    });

    // Notify admin about new employee joining
    try {
      const adminUser = await prisma.employee.findFirst({
        where: {
          companyId: invitation.companyId,
          role: "ADMIN",
          deleted: false,
        },
        select: { id: true },
      });

      if (adminUser) {
        await createNotification({
          companyId: invitation.companyId,
          userId: adminUser.id,
          message: `${name} has accepted the invitation and joined as ${invitation.position}`,
          type: "STATUS_CHANGE",
          category: "SYSTEM",
          priority: "NORMAL",
          redirectUrl: `/employees/${newEmployee.id}`,
        });
      }
    } catch (notifError) {
      console.error("Error creating employee joined notification:", notifError);
    }

    res.status(200).json({
      message: "Account created successfully, please login to continue",
    });
  } catch (error) {
    console.log("Error in AcceptInvite controller", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
