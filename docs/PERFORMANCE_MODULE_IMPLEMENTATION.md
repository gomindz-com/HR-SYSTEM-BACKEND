# 🚀 Performance Module Implementation Plan

## Overview

Based on your codebase patterns, you have:

- **Controllers** in `controller/` (functions exported individually)
- **Routes** in `routes/` (use `verifyToken` + `checkSubscription` middleware)
- **Routes registered** in `app.js`
- **Prisma** for database with `req.user.companyId` pattern

---

## Phase 1: Database Schema (Day 1)

### Step 1.1: Add the Prisma Models

Open `backend/prisma/schema.prisma` and add these models at the end:

```prisma
// ============================================
// PERFORMANCE MODULE
// ============================================

model PerformanceSettings {
  id                       String      @id @default(uuid())
  companyId                Int         @unique
  defaultRatingScale       RatingScale @default(FIVE_POINT)
  allowSelfReview          Boolean     @default(true)
  requireManagerReview     Boolean     @default(true)
  enableEmailNotifications Boolean     @default(true)
  reminderDaysBefore       Int         @default(7)

  company   Company  @relation(fields: [companyId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ReviewTemplate {
  id          String      @id @default(uuid())
  companyId   Int
  name        String
  description String?
  isDefault   Boolean     @default(false)
  ratingScale RatingScale @default(FIVE_POINT)
  isActive    Boolean     @default(true)

  company      Company         @relation(fields: [companyId], references: [id])
  sections     ReviewSection[]
  reviewCycles ReviewCycle[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([companyId])
}

model ReviewSection {
  id          String  @id @default(uuid())
  templateId  String
  title       String
  description String?
  order       Int
  isRequired  Boolean @default(true)

  template  ReviewTemplate   @relation(fields: [templateId], references: [id], onDelete: Cascade)
  questions ReviewQuestion[]

  @@index([templateId])
  @@unique([templateId, order])
}

model ReviewQuestion {
  id           String       @id @default(uuid())
  sectionId    String
  questionText String
  helpText     String?
  order        Int
  questionType QuestionType @default(TEXT_LONG)
  isRequired   Boolean      @default(true)
  options      String[]

  section ReviewSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)

  @@index([sectionId])
  @@unique([sectionId, order])
}

model ReviewCycle {
  id                   String      @id @default(uuid())
  companyId            Int
  templateId           String?
  name                 String
  description          String?
  startDate            DateTime
  endDate              DateTime
  selfReviewDueDate    DateTime?
  managerReviewDueDate DateTime?
  status               CycleStatus @default(DRAFT)

  company  Company         @relation(fields: [companyId], references: [id])
  template ReviewTemplate? @relation(fields: [templateId], references: [id])
  reviews  Review[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([companyId])
  @@index([status])
}

model Review {
  id        String @id @default(uuid())
  cycleId   String
  subjectId Int
  managerId Int?

  status                   PerformanceReviewStatus @default(NOT_STARTED)
  selfReviewCompletedAt    DateTime?
  managerReviewCompletedAt DateTime?
  finalizedAt              DateTime?
  acknowledgedAt           DateTime?

  overallRating      Float?
  overallRatingLabel String?
  managerComments    String?
  employeeComments   String?

  cycle     ReviewCycle      @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  subject   Employee         @relation("ReviewSubject", fields: [subjectId], references: [id])
  manager   Employee?        @relation("ReviewManager", fields: [managerId], references: [id])
  responses ReviewResponse[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([cycleId])
  @@index([subjectId])
  @@index([managerId])
  @@unique([cycleId, subjectId])
}

model ReviewResponse {
  id           String           @id @default(uuid())
  reviewId     String
  questionId   String
  authorId     Int
  responseType PerformanceReviewType

  textResponse    String?
  ratingValue     Float?
  selectedOptions String[]

  review Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  author Employee @relation(fields: [authorId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([reviewId])
  @@index([authorId])
  @@unique([reviewId, questionId, authorId, responseType])
}

// ============================================
// PERFORMANCE ENUMS
// ============================================

enum RatingScale {
  THREE_POINT
  FIVE_POINT
  TEN_POINT
}

enum PerformanceReviewType {
  SELF
  MANAGER
}

enum CycleStatus {
  DRAFT
  ACTIVE
  COMPLETED
  ARCHIVED
}

enum PerformanceReviewStatus {
  NOT_STARTED
  IN_PROGRESS
  PENDING_MANAGER
  COMPLETED
  FINALIZED
  ACKNOWLEDGED
}

enum QuestionType {
  TEXT_SHORT
  TEXT_LONG
  RATING
  MULTIPLE_CHOICE
  YES_NO
}
```

### Step 1.2: Update Employee Model Relations

Find your `Employee` model and add these relations:

```prisma
model Employee {
  // ... existing fields ...

  // Add these new relations at the end
  reviewsAsSubject   Review[]         @relation("ReviewSubject")
  reviewsAsManager   Review[]         @relation("ReviewManager")
  reviewResponses    ReviewResponse[]
}
```

### Step 1.3: Update Company Model Relations

Find your `Company` model and add:

```prisma
model Company {
  // ... existing fields ...

  // Add these new relations
  performanceSettings PerformanceSettings?
  reviewTemplates     ReviewTemplate[]
  reviewCycles        ReviewCycle[]
}
```

### Step 1.4: Remove Old ReviewStatus Enum

Your schema has an old `ReviewStatus` enum. Either:

- Delete it if not used elsewhere, OR
- Keep it (that's why I named the new one `PerformanceReviewStatus`)

### Step 1.5: Run Migration

```bash
cd backend
npx prisma migrate dev --name add_performance_module
```

---

## Phase 2: Performance Settings (Day 2)

**Goal:** Let admins configure performance review settings for their company.

### Step 2.1: Create Controller

Create `backend/controller/performance.controller.js`:

```javascript
import prisma from "../config/prisma.config.js";

// ============================================
// PERFORMANCE SETTINGS
// ============================================

/**
 * Get company performance settings
 * Creates default settings if none exist
 */
export const getPerformanceSettings = async (req, res) => {
  const companyId = req.user.companyId;

  try {
    // Find or create settings
    let settings = await prisma.performanceSettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.performanceSettings.create({
        data: { companyId },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Error getting performance settings:", error);
    res.status(500).json({ message: "Failed to get performance settings" });
  }
};

/**
 * Update company performance settings
 * Only ADMIN can update
 */
export const updatePerformanceSettings = async (req, res) => {
  const companyId = req.user.companyId;
  const {
    defaultRatingScale,
    allowSelfReview,
    requireManagerReview,
    enableEmailNotifications,
    reminderDaysBefore,
  } = req.body;

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

    res.json(settings);
  } catch (error) {
    console.error("Error updating performance settings:", error);
    res.status(500).json({ message: "Failed to update performance settings" });
  }
};
```

---

## Phase 3: Review Templates (Day 3-4)

**Goal:** Let admins create reusable review templates with sections and questions.

### Step 3.1: Add Template CRUD to Controller

Add to `backend/controller/performance.controller.js`:

```javascript
// ============================================
// REVIEW TEMPLATES
// ============================================

/**
 * Get all templates for company
 */
export const getTemplates = async (req, res) => {
  const companyId = req.user.companyId;

  try {
    const templates = await prisma.reviewTemplate.findMany({
      where: { companyId, isActive: true },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: { orderBy: { order: "asc" } },
          },
        },
        _count: { select: { reviewCycles: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(templates);
  } catch (error) {
    console.error("Error getting templates:", error);
    res.status(500).json({ message: "Failed to get templates" });
  }
};

/**
 * Get single template by ID
 */
export const getTemplateById = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;

  try {
    const template = await prisma.reviewTemplate.findFirst({
      where: { id, companyId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    console.error("Error getting template:", error);
    res.status(500).json({ message: "Failed to get template" });
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

  if (!name) {
    return res.status(400).json({ message: "Template name is required" });
  }

  try {
    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.reviewTemplate.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

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
            isRequired: section.isRequired ?? true,
            questions: {
              create: section.questions?.map((q, qIndex) => ({
                questionText: q.questionText,
                helpText: q.helpText,
                order: q.order || qIndex + 1,
                questionType: q.questionType || "TEXT_LONG",
                isRequired: q.isRequired ?? true,
                options: q.options || [],
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ message: "Failed to create template" });
  }
};

/**
 * Update a template
 * Note: Only updates template metadata, not sections (use separate endpoints)
 */
export const updateTemplate = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;
  const { name, description, ratingScale, isDefault, isActive } = req.body;

  try {
    // Verify ownership
    const existing = await prisma.reviewTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.reviewTemplate.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.reviewTemplate.update({
      where: { id },
      data: {
        name,
        description,
        ratingScale,
        isDefault,
        isActive,
      },
    });

    res.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ message: "Failed to update template" });
  }
};

/**
 * Delete (soft) a template
 */
export const deleteTemplate = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;

  try {
    // Verify ownership
    const existing = await prisma.reviewTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Soft delete
    await prisma.reviewTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ message: "Failed to delete template" });
  }
};
```

---

## Phase 4: Review Cycles (Day 5-6)

**Goal:** Let admins create review cycles and activate them to generate reviews for employees.

### The Review Cycle Flow Explained

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REVIEW CYCLE FLOW                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. ADMIN creates cycle (DRAFT)                                         │
│     - Selects template                                                  │
│     - Sets dates (start, end, due dates)                                │
│     - Selects employees to include                                      │
│                                                                          │
│  2. ADMIN activates cycle (DRAFT → ACTIVE)                              │
│     - System creates Review records for each employee                   │
│     - System assigns manager from Employee.departmentId → Manager       │
│     - Notifications sent to all employees                               │
│                                                                          │
│  3. EMPLOYEES complete self-reviews                                     │
│     - Status: NOT_STARTED → IN_PROGRESS → PENDING_MANAGER               │
│     - Creates ReviewResponse records with type=SELF                     │
│                                                                          │
│  4. MANAGERS complete their reviews                                     │
│     - Status: PENDING_MANAGER → COMPLETED                               │
│     - Creates ReviewResponse records with type=MANAGER                  │
│                                                                          │
│  5. ADMIN finalizes reviews (COMPLETED → FINALIZED)                     │
│     - Locks all responses                                               │
│     - Calculates overall ratings                                        │
│                                                                          │
│  6. EMPLOYEES acknowledge (FINALIZED → ACKNOWLEDGED)                    │
│     - Employee signs off on the review                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step 4.1: Add Cycle CRUD to Controller

Add to `backend/controller/performance.controller.js`:

```javascript
// ============================================
// REVIEW CYCLES
// ============================================

/**
 * Get all cycles for company
 */
export const getCycles = async (req, res) => {
  const companyId = req.user.companyId;

  try {
    const cycles = await prisma.reviewCycle.findMany({
      where: { companyId },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(cycles);
  } catch (error) {
    console.error("Error getting cycles:", error);
    res.status(500).json({ message: "Failed to get cycles" });
  }
};

/**
 * Get single cycle with reviews
 */
export const getCycleById = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;

  try {
    const cycle = await prisma.reviewCycle.findFirst({
      where: { id, companyId },
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
            manager: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found" });
    }

    res.json(cycle);
  } catch (error) {
    console.error("Error getting cycle:", error);
    res.status(500).json({ message: "Failed to get cycle" });
  }
};

/**
 * Create a new review cycle
 */
export const createCycle = async (req, res) => {
  const companyId = req.user.companyId;
  const {
    name,
    description,
    templateId,
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
    // Verify template exists and belongs to company
    const template = await prisma.reviewTemplate.findFirst({
      where: { id: templateId, companyId, isActive: true },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const cycle = await prisma.reviewCycle.create({
      data: {
        companyId,
        name,
        description,
        templateId,
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

    res.status(201).json(cycle);
  } catch (error) {
    console.error("Error creating cycle:", error);
    res.status(500).json({ message: "Failed to create cycle" });
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
  const { id } = req.params;
  const { employeeIds } = req.body; // Optional: specific employees, or all if not provided

  try {
    // Get cycle
    const cycle = await prisma.reviewCycle.findFirst({
      where: { id, companyId },
    });

    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found" });
    }

    if (cycle.status !== "DRAFT") {
      return res
        .status(400)
        .json({ message: "Only DRAFT cycles can be activated" });
    }

    // Get employees to include
    const whereClause = {
      companyId,
      status: "ACTIVE",
      deleted: false,
      role: { in: ["STAFF", "MANAGER"] }, // Exclude ADMIN and SUPER_ADMIN from reviews
    };

    if (employeeIds && employeeIds.length > 0) {
      whereClause.id = { in: employeeIds };
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        department: {
          include: { manager: true },
        },
      },
    });

    if (employees.length === 0) {
      return res.status(400).json({ message: "No eligible employees found" });
    }

    // Create reviews in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update cycle status
      await tx.reviewCycle.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      // Create review records
      const reviews = await Promise.all(
        employees.map((emp) =>
          tx.review.create({
            data: {
              cycleId: id,
              subjectId: emp.id,
              managerId: emp.department?.managerId || null,
              status: "NOT_STARTED",
            },
          })
        )
      );

      return reviews;
    });

    // TODO: Send notifications to employees

    res.json({
      message: "Cycle activated successfully",
      reviewsCreated: result.length,
    });
  } catch (error) {
    console.error("Error activating cycle:", error);
    res.status(500).json({ message: "Failed to activate cycle" });
  }
};

/**
 * Complete a cycle (mark as COMPLETED)
 */
export const completeCycle = async (req, res) => {
  const companyId = req.user.companyId;
  const { id } = req.params;

  try {
    const cycle = await prisma.reviewCycle.findFirst({
      where: { id, companyId },
    });

    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found" });
    }

    if (cycle.status !== "ACTIVE") {
      return res
        .status(400)
        .json({ message: "Only ACTIVE cycles can be completed" });
    }

    await prisma.reviewCycle.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    res.json({ message: "Cycle completed successfully" });
  } catch (error) {
    console.error("Error completing cycle:", error);
    res.status(500).json({ message: "Failed to complete cycle" });
  }
};
```

---

## Phase 5: Reviews & Responses (Day 7-8)

**Goal:** Let employees fill out self-reviews and managers fill out their reviews.

### The Review Response Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    SELF-REVIEW FLOW                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Employee opens their review → sees template questions              │
│                    ↓                                                │
│  Employee answers a question → auto-save to ReviewResponse          │
│  (POST /reviews/:reviewId/responses with responseType=SELF)         │
│                    ↓                                                │
│  Employee clicks "Submit Self Review"                               │
│  (POST /reviews/:reviewId/submit-self)                              │
│                    ↓                                                │
│  Status: NOT_STARTED/IN_PROGRESS → PENDING_MANAGER                  │
│  selfReviewCompletedAt = now()                                      │
│  Notification sent to manager                                       │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    MANAGER REVIEW FLOW                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Manager opens employee's review → sees employee's responses        │
│                    ↓                                                │
│  Manager adds their answers → auto-save with responseType=MANAGER   │
│                    ↓                                                │
│  Manager clicks "Submit Manager Review"                             │
│  (POST /reviews/:reviewId/submit-manager)                           │
│                    ↓                                                │
│  Status: PENDING_MANAGER → COMPLETED                                │
│  managerReviewCompletedAt = now()                                   │
│  Overall rating calculated                                          │
│  Notification sent to employee                                      │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Step 5.1: Add Review Endpoints to Controller

```javascript
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
      where: { subjectId: employeeId },
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
        manager: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(reviews);
  } catch (error) {
    console.error("Error getting my reviews:", error);
    res.status(500).json({ message: "Failed to get reviews" });
  }
};

/**
 * Get reviews I need to complete as a manager
 */
export const getReviewsToComplete = async (req, res) => {
  const managerId = req.user.id;

  try {
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

    res.json(reviews);
  } catch (error) {
    console.error("Error getting reviews to complete:", error);
    res.status(500).json({ message: "Failed to get reviews" });
  }
};

/**
 * Get a single review with all details
 * Used for the review form
 */
export const getReviewById = async (req, res) => {
  const userId = req.user.id;
  const companyId = req.user.companyId;
  const { id } = req.params;

  try {
    const review = await prisma.review.findFirst({
      where: { id },
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

    // Permission check: user is subject, manager, or admin
    const isSubject = review.subjectId === userId;
    const isManager = review.managerId === userId;
    const isAdmin = req.user.role === "ADMIN";

    if (!isSubject && !isManager && !isAdmin) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this review" });
    }

    res.json(review);
  } catch (error) {
    console.error("Error getting review:", error);
    res.status(500).json({ message: "Failed to get review" });
  }
};

/**
 * Save a response (auto-save)
 * Called as user fills out the form
 */
export const saveResponse = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
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
    // Get review and verify permission
    const review = await prisma.review.findFirst({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Verify user can respond
    if (responseType === "SELF" && review.subjectId !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized for self-review" });
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

    // Upsert the response
    const response = await prisma.reviewResponse.upsert({
      where: {
        reviewId_questionId_authorId_responseType: {
          reviewId,
          questionId,
          authorId: userId,
          responseType,
        },
      },
      update: {
        textResponse,
        ratingValue,
        selectedOptions: selectedOptions || [],
      },
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
        data: { status: "IN_PROGRESS" },
      });
    }

    res.json(response);
  } catch (error) {
    console.error("Error saving response:", error);
    res.status(500).json({ message: "Failed to save response" });
  }
};

/**
 * Submit self-review
 * Marks self-review as complete
 */
export const submitSelfReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, subjectId: userId },
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.selfReviewCompletedAt) {
      return res.status(400).json({ message: "Self review already submitted" });
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "PENDING_MANAGER",
        selfReviewCompletedAt: new Date(),
      },
    });

    // TODO: Notify manager

    res.json({ message: "Self review submitted successfully" });
  } catch (error) {
    console.error("Error submitting self review:", error);
    res.status(500).json({ message: "Failed to submit self review" });
  }
};

/**
 * Submit manager review
 */
export const submitManagerReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
  const { overallRating, overallRatingLabel, managerComments } = req.body;

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, managerId: userId },
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.status !== "PENDING_MANAGER") {
      return res.status(400).json({ message: "Self review not yet submitted" });
    }

    if (review.managerReviewCompletedAt) {
      return res
        .status(400)
        .json({ message: "Manager review already submitted" });
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "COMPLETED",
        managerReviewCompletedAt: new Date(),
        overallRating,
        overallRatingLabel,
        managerComments,
      },
    });

    // TODO: Notify employee

    res.json({ message: "Manager review submitted successfully" });
  } catch (error) {
    console.error("Error submitting manager review:", error);
    res.status(500).json({ message: "Failed to submit manager review" });
  }
};

/**
 * Acknowledge a review (employee signs off)
 */
export const acknowledgeReview = async (req, res) => {
  const userId = req.user.id;
  const { reviewId } = req.params;
  const { employeeComments } = req.body;

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, subjectId: userId },
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.status !== "FINALIZED") {
      return res
        .status(400)
        .json({ message: "Review must be finalized first" });
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        employeeComments,
      },
    });

    res.json({ message: "Review acknowledged successfully" });
  } catch (error) {
    console.error("Error acknowledging review:", error);
    res.status(500).json({ message: "Failed to acknowledge review" });
  }
};
```

---

## Phase 6: Routes Setup (Day 9)

### Step 6.1: Create Route File

Create `backend/routes/performance.route.js`:

```javascript
import express from "express";
import {
  // Settings
  getPerformanceSettings,
  updatePerformanceSettings,
  // Templates
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  // Cycles
  getCycles,
  getCycleById,
  createCycle,
  activateCycle,
  completeCycle,
  // Reviews
  getMyReviews,
  getReviewsToComplete,
  getReviewById,
  saveResponse,
  submitSelfReview,
  submitManagerReview,
  acknowledgeReview,
} from "../controller/performance.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";
import { requireRole } from "../middleware/rbac.middleware.js";

const router = express.Router();

// All routes require auth + subscription
router.use(verifyToken);
router.use(checkSubscription);

// ============================================
// SETTINGS (Admin only)
// ============================================
router.get("/settings", getPerformanceSettings);
router.put("/settings", requireRole(["ADMIN"]), updatePerformanceSettings);

// ============================================
// TEMPLATES (Admin only for CUD)
// ============================================
router.get("/templates", getTemplates);
router.get("/templates/:id", getTemplateById);
router.post("/templates", requireRole(["ADMIN"]), createTemplate);
router.put("/templates/:id", requireRole(["ADMIN"]), updateTemplate);
router.delete("/templates/:id", requireRole(["ADMIN"]), deleteTemplate);

// ============================================
// CYCLES (Admin only for management)
// ============================================
router.get("/cycles", getCycles);
router.get("/cycles/:id", getCycleById);
router.post("/cycles", requireRole(["ADMIN"]), createCycle);
router.post("/cycles/:id/activate", requireRole(["ADMIN"]), activateCycle);
router.post("/cycles/:id/complete", requireRole(["ADMIN"]), completeCycle);

// ============================================
// REVIEWS
// ============================================
router.get("/reviews/mine", getMyReviews); // Employee's own reviews
router.get("/reviews/to-complete", getReviewsToComplete); // Manager's queue
router.get("/reviews/:id", getReviewById); // Single review details

// ============================================
// RESPONSES
// ============================================
router.post("/reviews/:reviewId/responses", saveResponse);
router.post("/reviews/:reviewId/submit-self", submitSelfReview);
router.post("/reviews/:reviewId/submit-manager", submitManagerReview);
router.post("/reviews/:reviewId/acknowledge", acknowledgeReview);

export default router;
```

### Step 6.2: Register Route in app.js

Add to `backend/app.js`:

```javascript
// ... existing imports ...
import performanceRoutes from "./routes/performance.route.js";

// ... existing code ...

// ROUTES
// ... existing routes ...
app.use("/api/performance", performanceRoutes);
```

---

## Phase 7: Testing Checklist (Day 10)

Use Postman or curl to test:

### Settings

```bash
# Get settings
GET /api/performance/settings

# Update settings (as Admin)
PUT /api/performance/settings
{
  "defaultRatingScale": "FIVE_POINT",
  "allowSelfReview": true
}
```

### Templates

```bash
# Create template
POST /api/performance/templates
{
  "name": "Q4 2025 Review",
  "ratingScale": "FIVE_POINT",
  "sections": [
    {
      "title": "Performance",
      "order": 1,
      "questions": [
        { "questionText": "Rate your performance", "questionType": "RATING", "order": 1 },
        { "questionText": "Key achievements?", "questionType": "TEXT_LONG", "order": 2 }
      ]
    }
  ]
}

# Get all templates
GET /api/performance/templates
```

### Cycles

```bash
# Create cycle
POST /api/performance/cycles
{
  "name": "Q4 2025",
  "templateId": "<template-id>",
  "startDate": "2025-10-01",
  "endDate": "2025-12-31",
  "selfReviewDueDate": "2025-12-15",
  "managerReviewDueDate": "2025-12-25"
}

# Activate cycle (creates reviews for employees)
POST /api/performance/cycles/<cycle-id>/activate
```

### Reviews

```bash
# Get my reviews (as employee)
GET /api/performance/reviews/mine

# Get single review
GET /api/performance/reviews/<review-id>

# Save a response (auto-save)
POST /api/performance/reviews/<review-id>/responses
{
  "questionId": "<question-id>",
  "responseType": "SELF",
  "textResponse": "I exceeded my targets..."
}

# Submit self review
POST /api/performance/reviews/<review-id>/submit-self

# Submit manager review
POST /api/performance/reviews/<review-id>/submit-manager
{
  "overallRating": 4.5,
  "overallRatingLabel": "Exceeds Expectations",
  "managerComments": "Great work this quarter!"
}
```

---

## 📋 Summary Checklist

| Day | Task                | Deliverable                           |
| --- | ------------------- | ------------------------------------- |
| 1   | Schema + Migration  | Database tables created               |
| 2   | Settings CRUD       | `/api/performance/settings` working   |
| 3-4 | Templates CRUD      | Template builder API complete         |
| 5-6 | Cycles + Activation | Can create and activate review cycles |
| 7-8 | Reviews + Responses | Full review flow working              |
| 9   | Routes + RBAC       | All endpoints secured                 |
| 10  | Testing             | Postman collection verified           |

---

## Next Steps After Backend

Once this is working, you'll need:

1. **Frontend components** (Template builder, Review form, Dashboard)
2. **Notifications** (Email when cycle activates, when reviews need attention)
3. **Reports** (Review history, ratings analytics)
