import prisma from "../config/prisma.config.js";
import {
  createNotification,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
} from "../utils/notification.utils.js";
import {
  sendCycleActivatedEmail,
  sendSelfReviewSubmittedEmail,
  sendManagerReviewSubmittedEmail,
  sendReviewFinalizedEmail,
} from "../emails/performanceEmails.js";

// ============================================
// PERFORMANCE SETTINGS
// ============================================

// find the company setting or create one if there is none found
export const getPerformanceSettings = async (req, res) => {
  const companyId = req.user.companyId;

  if (!companyId) {
    console.error("Company ID is required");
    return res.status(400).json({ message: "Company ID is required" });
  }

  try {
    let settings = await prisma.performanceSettings.findUnique({
      where: {
        companyId: companyId,
      },
    });

    if (!settings) {
      settings = await prisma.performanceSettings.create({
        data: {
          companyId,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Performance settings retrieved successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error getting performance settings:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// update company performance settings

export const updatePerformanceSettings = async (req, res) => {
  const companyId = req.user.companyId;
  const {
    defaultRatingScale,
    allowSelfReview,
    requireManagerReview,
    enableEmailNotifications,
    reminderDaysBefore,
  } = req.body;

  if (!companyId) {
    console.error("Company ID is required");
    return res.status(400).json({ message: "Company ID is required" });
  }

  try {
    const settings = await prisma.performanceSettings.upsert({
      where: { companyId },

      update: {
        defaultRatingScale,
        allowSelfReview,
        requireManagerReview,
        enableEmailNotifications,
        reminderDaysBefore,
      },

      create: {
        companyId,
        defaultRatingScale,
        allowSelfReview,
        requireManagerReview,
        enableEmailNotifications,
        reminderDaysBefore,
      },
    });

    res.status(200).json({
      success: true,
      message: "Performance settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating performance settings:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ============================================
// REVIEW TEMPLATES
// ============================================

// Get all templates for company

export const getTemplates = async (req, res) => {
  const companyId = req.user.companyId;

  if (!companyId) {
    console.error("Company ID is required");
    return res.status(400).json({ message: "Company ID is required" });
  }

  try {
    const templates = await prisma.reviewTemplate.findMany({
      where: {
        companyId,
        isActive: true,
      },

      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
        _count: { select: { reviewCycles: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Templates retrieved successfully",
      data: templates,
    });
  } catch (error) {
    console.error("Error getting templates:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// get  single template by id

export const getTemplateById = async (req, res) => {
  const { templateId } = req.params;
  const companyId = req.user.companyId;

  if (!templateId)
    return res.status(400).json({ message: "Template ID is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });

  try {
    const template = await prisma.reviewTemplate.findFirst({
      where: {
        id: templateId,
        companyId,
        isActive: true,
      },

      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!template)
      return res.status(404).json({ message: "Template not found" });

    res.status(200).json({
      success: true,
      message: "Template retrieved successfully",
      data: template,
    });
  } catch (error) {
    console.error("Error getting template by id:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * Create a new review template
 *
 * Example request body:
 * {
 *   "name": "Annual Performance Review",
 *   "description": "Standard yearly review",
 *   "ratingScale": "FIVE_POINT",
 *   "sections": [
 *     {
 *       "title": "Job Performance",
 *       "description": "Evaluate day-to-day performance",
 *       "order": 1,
 *       "questions": [
 *         {
 *           "questionText": "How well did you meet your objectives?",
 *           "questionType": "RATING",
 *           "order": 1
 *         },
 *         {
 *           "questionText": "What were your key achievements?",
 *           "questionType": "TEXT_LONG",
 *           "order": 2
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

export const createTemplate = async (req, res) => {
  const companyId = req.user.companyId;
  const { name, description, ratingScale, isDefault, sections } = req.body;

  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });
  if (!name) return res.status(400).json({ message: "Name is required" });
  if (!ratingScale)
    return res.status(400).json({ message: "Rating scale is required" });

  try {
    // if isDefault is true, update all other templates to false
    if (isDefault) {
      await prisma.reviewTemplate.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // create the template
    const template = await prisma.reviewTemplate.create({
      data: {
        companyId,
        name,
        description,
        ratingScale: ratingScale || "FIVE_POINT",
        isDefault: isDefault || false,
        sections: {
          create: sections?.map((section, sIndex) => ({
            title: section.title,
            description: section.description,
            order: section.order || sIndex + 1,
            questions: {
              create: section.questions?.map((q, qIndex) => ({
                questionText: q.questionText,
                questionType: q.questionType || "TEXT_LONG",
                helpText: q.helpText,
                order: q.order || qIndex + 1,
                isRequired: q.isRequired || true,
                options: q.options || [],
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: template,
    });
  } catch (error) {
    console.log("Error creating template:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * Update a template
 * Note: Only updates template metadata, not sections (separate endpoints for sections)
 */

export const updateTemplate = async (req, res) => {
  const { templateId } = req.params;
  const companyId = req.user.companyId;
  const { name, description, ratingScale, isDefault, isActive } = req.body;

  if (!templateId)
    return res.status(400).json({ message: "Template ID is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });
  if (!name) return res.status(400).json({ message: "Name is required" });
  if (!ratingScale)
    return res.status(400).json({ message: "Rating scale is required" });

  try {
    const existingTemplate = await prisma.reviewTemplate.findUnique({
      where: { id: templateId, companyId },
    });

    if (!existingTemplate)
      return res.status(404).json({ message: "Template not found" });

    if (!existingTemplate.isActive)
      return res
        .status(400)
        .json({ message: "Cannot update inactive template" });

    // if isDefault is true, update all other templates to false
    if (isDefault) {
      await prisma.reviewTemplate.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // update the template
    const template = await prisma.reviewTemplate.update({
      where: { id: templateId },
      data: {
        name,
        description,
        ratingScale: ratingScale,
        isDefault: isDefault,
        isActive: isActive,
      },
    });

    res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: template,
    });
  } catch (error) {
    console.log("Error updating template:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * Delete (soft) a template
 */

export const deleteTemplate = async (req, res) => {
  const { templateId } = req.params;
  const companyId = req.user.companyId;

  if (!templateId)
    return res.status(400).json({ message: "Template ID is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });
  try {
    const existingTemplate = await prisma.reviewTemplate.findFirst({
      where: { id: templateId, companyId },
    });

    if (!existingTemplate)
      return res.status(404).json({ message: "Template not found" });

    // delete the template
    await prisma.reviewTemplate.update({
      where: { id: templateId },
      data: {
        isActive: false,
      },
    });

    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.log("Error deleting template:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ============================================
// REVIEW CYCLES
// ============================================

// get all review cycles for a company

export const getCycles = async (req, res) => {
  const companyId = req.user.companyId;
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });

  try {
    const cycles = await prisma.reviewCycle.findMany({
      where: { companyId },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!cycles.length)
      return res.status(404).json({ message: "No review cycles found" });

    res.status(200).json({
      success: true,
      message: "Review cycles retrieved successfully",
      data: cycles,
    });
  } catch (error) {
    console.log("Error getting review cycles:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// get a single review cycle by id

export const getCycleById = async (req, res) => {
  const { cycleId } = req.params;
  const companyId = req.user.companyId;

  if (!cycleId)
    return res.status(400).json({ message: "Cycle ID is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });
  try {
    const cycle = await prisma.reviewCycle.findFirst({
      where: {
        id: cycleId,
        companyId,
      },

      include: {
        template: {
          include: {
            sections: {
              orderBy: { order: "asc" },
              include: { questions: { orderBy: { order: "asc" } } },
            },
          },
        },
        reviews: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                position: true,
                profilePic: true,
              },
            },
            manager: {
              select: {
                id: true,
                name: true,
                position: true,
                profilePic: true,
              },
            },
          },
        },
      },
    });

    if (!cycle)
      return res.status(404).json({ message: "Review cycle not found" });
    res.status(200).json({
      success: true,
      message: "Review cycle retrieved successfully",
      data: cycle,
    });
  } catch (error) {
    console.log("Error getting review cycle by id:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Create a new review cycle

export const createCycle = async (req, res) => {
  const companyId = req.user.companyId;
  const {
    templateId,
    name,
    description,
    startDate,
    endDate,
    selfReviewDueDate,
    managerReviewDueDate,
  } = req.body;

  if (!name || !templateId || !startDate || !endDate) {
    return res.status(400).json({
      message: "Name, template, start date, and end date are required",
    });
  }
  try {
    const template = await prisma.reviewTemplate.findFirst({
      where: {
        id: templateId,
        companyId,
        isActive: true,
      },
    });

    if (!template)
      return res
        .status(404)
        .json({ message: "Template not found or inactive" });

    const cycle = await prisma.reviewCycle.create({
      data: {
        companyId,
        templateId,
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        selfReviewDueDate: selfReviewDueDate
          ? new Date(selfReviewDueDate)
          : null,
        managerReviewDueDate: managerReviewDueDate
          ? new Date(managerReviewDueDate)
          : null,
      },

      include: {
        template: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: "Review cycle created successfully",
      data: cycle,
    });
  } catch (error) {
    console.log("Error creating review cycle:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * Activate a review cycle
 * This creates Review records for all active employees
 *
 * IMPORTANT: This is the key operation that kicks off reviews!
 */

export const activateCycle = async (req, res) => {
  const companyId = req.user.companyId;
  const { cycleId } = req.params;
  const { employeeIds } = req.body;

  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });
  if (!cycleId)
    return res.status(400).json({ message: "Cycle ID is required" });

  try {
    // Get Cycle

    const cycle = await prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });

    if (!cycle)
      return res.status(404).json({ message: "Review cycle not found" });

    if (cycle.status !== "DRAFT")
      return res
        .status(400)
        .json({ message: "Review cycle is not in draft status" });

    //  Get employees to include

    const whereClause = {
      companyId,
      deleted: false,
      status: "ACTIVE",
      role: { in: ["STAFF", "MANAGER"] }, // Exclude Admin and super_admin
    };

    if (employeeIds && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        department: { include: { manager: true } },
      },
    });

    if (employees.length === 0)
      return res
        .status(404)
        .json({ message: "No employees eligible for review" });

    // Validate: Check for employees without managers
    const employeesWithoutManagers = employees.filter(
      (emp) => !emp.department?.managerId
    );

    if (employeesWithoutManagers.length > 0) {
      const employeeNames = employeesWithoutManagers
        .map((e) => e.name)
        .join(", ");
      return res.status(400).json({
        success: false,
        message: "Some employees do not have assigned managers",
        error: "MANAGER_MISSING",
        employeesWithoutManagers: employeesWithoutManagers.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          department: e.department?.name || "No Department",
          departmentId: e.departmentId,
        })),
        details: `The following ${employeesWithoutManagers.length} employee(s) need managers assigned: ${employeeNames}. Please assign managers to their departments before activating the review cycle.`,
      });
    }

    // create review in a  transaction

    const result = await prisma.$transaction(async (tx) => {
      //   update cycle status

      await tx.reviewCycle.update({
        where: { id: cycleId },
        data: { status: "ACTIVE" },
      });

      //   create reviews for each employee

      const reviews = await Promise.all(
        employees.map(async (employee) =>
          tx.review.create({
            data: {
              cycleId,
              subjectId: employee.id,
              managerId: employee.department.manager?.id || null,
              status: "NOT_STARTED",
            },
          })
        )
      );

      return reviews;
    });

    // Send notifications and emails to all employees
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const review = result[i];

      // Create notification
      try {
        await createNotification({
          companyId,
          userId: employee.id,
          message: `Performance review cycle "${cycle.name}" has been activated. Please complete your self-review.`,
          type: "REVIEW",
          category: NOTIFICATION_CATEGORIES.PERFORMANCE,
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          redirectUrl: `/performance/reviews/${review.id}`,
        });
      } catch (error) {
        console.error(
          `Failed to create notification for employee ${employee.id}:`,
          error
        );
      }

      // Send email
      try {
        await sendCycleActivatedEmail(employee, cycle);
      } catch (error) {
        console.error(
          `Failed to send email to employee ${employee.id}:`,
          error
        );
      }
    }

    res.status(201).json({
      success: true,
      message: "Review cycle activated and reviews created successfully",
      data: result,
    });
  } catch (error) {
    console.log("Error activating review cycle:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

//  Complete a cycle (mark as COMPLETED)

export const completeCycle = async (req, res) => {
  const companyId = req.user.companyId;
  const { cycleId } = req.params;

  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });

  try {
    const cycle = await prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });

    if (!cycle)
      return res.status(404).json({ message: "Review cycle not found" });

    if (cycle.status !== "ACTIVE")
      return res
        .status(400)
        .json({ message: "Only active cycles can be completed" });

    await prisma.reviewCycle.update({
      where: { id: cycleId },
      data: { status: "COMPLETED" },
    });

    res.status(200).json({
      success: true,
      message: "Review cycle completed successfully",
      data: cycle,
    });
  } catch (error) {
    console.log("Error completing review cycle:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ============================================
// REVIEWS
// ============================================

/**
 * Get my pending reviews (as subject)
 * For the employee dashboard
 */

export const getMyReviews = async (req, res) => {
  const employeeId = req.user.id;
  try {
    const reviews = await prisma.review.findMany({
      where: {
        subjectId: employeeId,
      },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            selfReviewDueDate: true,
            status: true,
          },
        },
        manager: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!reviews.length) {
      console.log("No reviews found");
      return res.status(404).json({ message: "No reviews found" });
    }

    res.status(200).json({
      success: true,
      message: "Reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    console.log("Error getting my reviews:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Get reviews I need to complete as a manager

export const getReviewsToComplete = async (req, res) => {
  const managerId = req.user.id;

  try {
    // get reviews that are pending manager review
    const reviews = await prisma.review.findMany({
      where: {
        managerId,
        status: "PENDING_MANAGER", // Only show when employee has submitted
      },

      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            managerReviewDueDate: true,
          },
        },

        subject: {
          select: { id: true, name: true, position: true, profilePic: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!reviews.length) {
      console.log("No reviews found");
      return res.status(404).json({ message: "No reviews found" });
    }

    res.status(200).json({
      success: true,
      message: "Reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    console.log("Error getting reviews to complete:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

//  Get a single review with all details
//  Used for the review form

export const getReviewById = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;
  const companyId = req.user.companyId;

  try {
    const review = await prisma.review.findFirst({
      where: {
        id: reviewId,
        cycle: {
          companyId: companyId,
        },
      },
      include: {
        cycle: {
          include: {
            template: {
              include: {
                sections: {
                  orderBy: { order: "asc" },
                  include: { questions: { orderBy: { order: "asc" } } },
                },
              },
            },
          },
        },

        subject: {
          select: { id: true, name: true, position: true, profilePic: true },
        },
        manager: { select: { id: true, name: true } },
        responses: true,
      },
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const isSubject = review.subjectId === userId;
    const isManager = review.managerId === userId;
    const isAdmin = req.user.role === "ADMIN";

    if (!isSubject && !isManager && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this review" });
    }

    res.status(200).json({
      success: true,
      message: "Review retrieved successfully",
      data: review,
    });
  } catch (error) {
    console.log("Error getting review by id:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * Save a response (auto-save)
 * Called as user fills out the form
 */

export const saveResponse = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
  const companyId = req.user.companyId;

  const {
    questionId,
    textResponse,
    ratingValue,
    selectedOptions,
    responseType,
  } = req.body;

  if (!questionId || !responseType) {
    return res
      .status(400)
      .json({ message: "questionId and responseType are required" });
  }

  try {
    // get review and verify permission

    const review = await prisma.review.findFirst({
      where: { id: reviewId },
    });

    // verify user can respond
    if (responseType === "SELF" && review.subjectId !== userId) {
      return res.status(403).json({ message: "Not authorized to self review" });
    }

    if (responseType === "MANAGER" && review.managerId !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized for manager review" });
    }

    // Verify review is in correct status
    if (responseType === "SELF" && review.selfReviewCompletedAt) {
      return res.status(400).json({ message: "Self review already submitted" });
    }

    if (responseType === "MANAGER" && review.managerReviewCompletedAt) {
      return res
        .status(400)
        .json({ message: "Manager review already submitted" });
    }

    // upsert the response

    const response = await prisma.reviewResponse.upsert({
      where: {
        reviewId_questionId_authorId_responseType: {
          reviewId,
          questionId,
          authorId: userId,
          responseType,
        },
      },

      // update
      update: {
        textResponse,
        ratingValue,
        selectedOptions: selectedOptions || [],
      },

      //   create if not exists
      create: {
        reviewId,
        questionId,
        authorId: userId,
        responseType,
        textResponse,
        ratingValue,
        selectedOptions: selectedOptions || [],
      },
    });

    // Update review status to IN_PROGRESS if NOT_STARTED
    if (review.status === "NOT_STARTED") {
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          status: "IN_PROGRESS",
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Response saved successfully",
      data: response,
    });
  } catch (error) {
    console.log("Error saving response:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Submit self-review
//  Marks self-review as complete

export const submitSelfReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
  const companyId = req.user.companyId;

  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, subjectId: userId },
    });

    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.selfReviewCompletedAt)
      return res.status(400).json({ message: "Self review already submitted" });

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "PENDING_MANAGER",
        selfReviewCompletedAt: new Date(),
      },
      include: {
        subject: {
          select: { id: true, name: true, email: true, position: true },
        },
        manager: { select: { id: true, name: true, email: true } },
        cycle: { select: { name: true, managerReviewDueDate: true } },
      },
    });

    // Send notification and email to manager
    if (updatedReview.manager) {
      try {
        // Create notification for manager
        await createNotification({
          companyId,
          userId: updatedReview.manager.id,
          message: `${updatedReview.subject.name} has submitted their self-review. Please complete your review.`,
          type: "REVIEW",
          category: NOTIFICATION_CATEGORIES.PERFORMANCE,
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          redirectUrl: `/performance/reviews/${reviewId}`,
        });

        // Send email to manager
        await sendSelfReviewSubmittedEmail(
          updatedReview.manager,
          updatedReview.subject,
          updatedReview
        );
      } catch (error) {
        console.error("Failed to send notification/email to manager:", error);
      }
    }

    res.status(200).json({
      success: true,
      message: "Self review submitted successfully",
      data: review,
    });
  } catch (error) {
    console.log("Error submitting self review:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Submit manager review

export const submitManagerReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
  const { overallRating, overallRatingLabel, managerComments } = req.body;

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, managerId: userId },
    });

    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.status !== "PENDING_MANAGER") {
      return res.status(400).json({ message: "Self review not yet submitted" });
    }

    if (review.managerReviewCompletedAt)
      return res
        .status(400)
        .json({ message: "Manager review already submitted" });

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "COMPLETED",
        managerReviewCompletedAt: new Date(),
        overallRating,
        overallRatingLabel,
        managerComments,
      },
      include: {
        subject: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        cycle: { select: { companyId: true } },
      },
    });

    // Send notification and email to employee
    try {
      // Create notification for employee
      await createNotification({
        companyId: updatedReview.cycle.companyId,
        userId: updatedReview.subject.id,
        message: `Your manager has completed your performance review. Overall rating: ${overallRatingLabel || overallRating}`,
        type: "REVIEW",
        category: NOTIFICATION_CATEGORIES.PERFORMANCE,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        redirectUrl: `/performance/reviews/${reviewId}`,
      });

      // Send email to employee
      await sendManagerReviewSubmittedEmail(
        updatedReview.subject,
        updatedReview.manager,
        updatedReview
      );
    } catch (error) {
      console.error("Failed to send notification/email to employee:", error);
    }

    res.status(200).json({
      success: true,
      message: "Manager review submitted successfully",
      data: review,
    });
  } catch (error) {
    console.log("Error submitting manager review:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * Finalize a review (Admin only)
 * Transitions review from COMPLETED → FINALIZED
 * Calculates overall rating if not already set
 */
export const finalizeReview = async (req, res) => {
  const companyId = req.user.companyId;
  const { reviewId } = req.params;

  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId },
      include: {
        subject: { select: { id: true, name: true, email: true } },
        cycle: { select: { companyId: true } },
        responses: {
          where: { responseType: "MANAGER" },
        },
      },
    });

    if (!review) return res.status(404).json({ message: "Review not found" });

    // Verify company ownership
    if (review.cycle.companyId !== companyId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (review.status !== "COMPLETED") {
      return res
        .status(400)
        .json({ message: "Only COMPLETED reviews can be finalized" });
    }

    // Calculate overall rating from manager responses if not already set
    let overallRating = review.overallRating;
    let overallRatingLabel = review.overallRatingLabel;

    if (!overallRating && review.responses.length > 0) {
      const ratingResponses = review.responses.filter(
        (r) => r.ratingValue !== null
      );
      if (ratingResponses.length > 0) {
        const sum = ratingResponses.reduce((acc, r) => acc + r.ratingValue, 0);
        overallRating = sum / ratingResponses.length;
        // Simple label mapping (can be enhanced)
        if (overallRating >= 4.5) overallRatingLabel = "Outstanding";
        else if (overallRating >= 3.5)
          overallRatingLabel = "Exceeds Expectations";
        else if (overallRating >= 2.5)
          overallRatingLabel = "Meets Expectations";
        else if (overallRating >= 1.5) overallRatingLabel = "Needs Improvement";
        else overallRatingLabel = "Unsatisfactory";
      }
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        overallRating,
        overallRatingLabel,
      },
      include: {
        subject: { select: { id: true, name: true, email: true } },
        cycle: { select: { companyId: true } },
      },
    });

    // Send notification and email to employee
    try {
      // Create notification for employee
      await createNotification({
        companyId: updatedReview.cycle.companyId,
        userId: updatedReview.subject.id,
        message: `Your performance review has been finalized. Please acknowledge the review.`,
        type: "REVIEW",
        category: NOTIFICATION_CATEGORIES.PERFORMANCE,
        priority: NOTIFICATION_PRIORITIES.NORMAL,
        redirectUrl: `/performance/reviews/${reviewId}`,
      });

      // Send email to employee
      await sendReviewFinalizedEmail(updatedReview.subject, updatedReview);
    } catch (error) {
      console.error("Failed to send notification/email to employee:", error);
    }

    res.status(200).json({
      success: true,
      message: "Review finalized successfully",
      data: { reviewId, overallRating, overallRatingLabel },
    });
  } catch (error) {
    console.log("Error finalizing review:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Acknowledge a review (employee signs off)

export const acknowledgeReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;

  const { employeeComments } = req.body;

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, subjectId: userId },
    });

    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.status !== "FINALIZED")
      return res
        .status(400)
        .json({ message: "Review must be finalized before acknowledging" });

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "ACKNOWLEDGED",
        employeeComments,
        acknowledgedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Review acknowledged successfully",
      data: review,
    });
  } catch (error) {
    console.log("Error acknowledging review:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
