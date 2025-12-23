# Performance Module API Testing Plan (Postman)

## Prerequisites

- Base URL: `http://localhost:YOUR_PORT/api` (or your production URL)
- You'll need test accounts for:
  - **Admin** (role: ADMIN)
  - **Manager** (role: MANAGER)
  - **Employee** (role: STAFF)

---

## Step 1: Authentication

### 1.1 Login (Admin Account)

**Request:**

```
POST /api/auth/login
Content-Type: application/json
```

**Body:**

```json
{
  "email": "admin@example.com",
  "password": "your-admin-password"
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "ADMIN",
      "companyId": 1,
      ...
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Postman Setup:**

1. Copy the `token` from response
2. Create an environment variable: `token` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. Set Authorization header for all subsequent requests:
   - Type: Bearer Token
   - Token: `{{token}}`

---

## Step 2: Performance Settings

### 2.1 Get Performance Settings

**Request:**

```
GET /api/performance/settings
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Performance settings retrieved successfully",
  "data": {
    "id": "uuid-here",
    "companyId": 1,
    "defaultRatingScale": "FIVE_POINT",
    "allowSelfReview": true,
    "requireManagerReview": true,
    "enableEmailNotifications": true,
    "reminderDaysBefore": 7,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Note:** If settings don't exist, they'll be created automatically with defaults.

---

### 2.2 Update Performance Settings (Admin Only)

**Request:**

```
PUT /api/performance/settings
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "defaultRatingScale": "FIVE_POINT",
  "allowSelfReview": true,
  "requireManagerReview": true,
  "enableEmailNotifications": true,
  "reminderDaysBefore": 7
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Performance settings updated successfully",
  "data": {
    "id": "uuid-here",
    "companyId": 1,
    "defaultRatingScale": "FIVE_POINT",
    "allowSelfReview": true,
    "requireManagerReview": true,
    "enableEmailNotifications": true,
    "reminderDaysBefore": 7,
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Test Cases:**

- ✅ Valid update (Admin)
- ❌ Try as Manager/Staff (should get 403)
- ❌ Invalid rating scale (should validate)

---

## Step 3: Review Templates

### 3.1 Get All Templates

**Request:**

```
GET /api/performance/templates
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Templates retrieved successfully",
  "data": [
    {
      "id": "template-uuid-1",
      "name": "Annual Performance Review",
      "description": "Standard yearly review",
      "ratingScale": "FIVE_POINT",
      "isDefault": true,
      "isActive": true,
      "sections": [
        {
          "id": "section-uuid-1",
          "title": "Job Performance",
          "description": "Evaluate day-to-day performance",
          "order": 1,
          "questions": [
            {
              "id": "question-uuid-1",
              "questionText": "How well did you meet your objectives?",
              "questionType": "RATING",
              "order": 1
            }
          ]
        }
      ],
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### 3.2 Create Template (Admin Only)

**Request:**

```
POST /api/performance/templates
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "name": "Q4 2025 Performance Review",
  "description": "Quarterly performance review template",
  "ratingScale": "FIVE_POINT",
  "isDefault": false,
  "sections": [
    {
      "title": "Performance Objectives",
      "description": "Review achievement of objectives",
      "order": 1,
      "isRequired": true,
      "questions": [
        {
          "questionText": "Rate your overall performance this quarter (1-5)",
          "questionType": "RATING",
          "order": 1,
          "isRequired": true,
          "helpText": "Consider your key achievements and goals met"
        },
        {
          "questionText": "What were your key achievements this quarter?",
          "questionType": "TEXT_LONG",
          "order": 2,
          "isRequired": true
        },
        {
          "questionText": "What challenges did you face?",
          "questionType": "TEXT_LONG",
          "order": 3,
          "isRequired": false
        }
      ]
    },
    {
      "title": "Skills & Development",
      "description": "Assess skills and growth",
      "order": 2,
      "isRequired": true,
      "questions": [
        {
          "questionText": "Rate your technical skills (1-5)",
          "questionType": "RATING",
          "order": 1,
          "isRequired": true
        },
        {
          "questionText": "What skills would you like to develop?",
          "questionType": "TEXT_LONG",
          "order": 2,
          "isRequired": false
        }
      ]
    }
  ]
}
```

**Expected Response (201):**

```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "id": "new-template-uuid",
    "name": "Q4 2025 Performance Review",
    "sections": [
      {
        "id": "section-uuid",
        "title": "Performance Objectives",
        "questions": [
          {
            "id": "question-uuid",
            "questionText": "Rate your overall performance this quarter (1-5)",
            "questionType": "RATING"
          }
        ]
      }
    ]
  }
}
```

**Postman Setup:**

- Save `data.id` to environment variable: `templateId`

**Test Cases:**

- ✅ Valid template with sections and questions
- ❌ Missing name (should return 400)
- ❌ Missing ratingScale (should return 400)
- ❌ Try as Manager/Staff (should get 403)
- ✅ Set isDefault: true (should unset other defaults)

---

### 3.3 Get Template by ID

**Request:**

```
GET /api/performance/templates/{{templateId}}
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Template retrieved successfully",
  "data": {
    "id": "template-uuid",
    "name": "Q4 2025 Performance Review",
    "sections": [
      {
        "id": "section-uuid",
        "title": "Performance Objectives",
        "questions": [
          {
            "id": "question-uuid",
            "questionText": "Rate your overall performance this quarter (1-5)",
            "questionType": "RATING"
          }
        ]
      }
    ]
  }
}
```

---

### 3.4 Update Template (Admin Only)

**Request:**

```
PUT /api/performance/templates/{{templateId}}
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "name": "Updated Q4 2025 Performance Review",
  "description": "Updated description",
  "ratingScale": "FIVE_POINT",
  "isDefault": true,
  "isActive": true
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "id": "template-uuid",
    "name": "Updated Q4 2025 Performance Review",
    "isDefault": true,
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

---

### 3.5 Delete Template (Admin Only - Soft Delete)

**Request:**

```
DELETE /api/performance/templates/{{templateId}}
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

**Note:** This is a soft delete (sets `isActive: false`)

---

## Step 4: Review Cycles

### 4.1 Get All Cycles

**Request:**

```
GET /api/performance/cycles
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Review cycles retrieved successfully",
  "data": [
    {
      "id": "cycle-uuid-1",
      "name": "Q4 2025 Review Cycle",
      "description": "Quarterly review",
      "status": "DRAFT",
      "startDate": "2025-10-01T00:00:00.000Z",
      "endDate": "2025-12-31T23:59:59.000Z",
      "template": {
        "id": "template-uuid",
        "name": "Q4 2025 Performance Review"
      },
      "_count": {
        "reviews": 0
      }
    }
  ]
}
```

---

### 4.2 Create Review Cycle (Admin Only)

**Request:**

```
POST /api/performance/cycles
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "name": "Q4 2025 Review Cycle",
  "description": "Quarterly performance review for Q4 2025",
  "templateId": "{{templateId}}",
  "startDate": "2025-10-01",
  "endDate": "2025-12-31",
  "selfReviewDueDate": "2025-12-15",
  "managerReviewDueDate": "2025-12-25"
}
```

**Expected Response (201):**

```json
{
  "success": true,
  "message": "Review cycle created successfully",
  "data": {
    "id": "cycle-uuid",
    "name": "Q4 2025 Review Cycle",
    "status": "DRAFT",
    "template": {
      "id": "template-uuid",
      "name": "Q4 2025 Performance Review"
    },
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Postman Setup:**

- Save `data.id` to environment variable: `cycleId`

**Test Cases:**

- ✅ Valid cycle creation
- ❌ Missing required fields (name, templateId, startDate, endDate)
- ❌ Invalid templateId (should return 404)
- ❌ End date before start date (should validate)
- ❌ Try as Manager/Staff (should get 403)

---

### 4.3 Get Cycle by ID

**Request:**

```
GET /api/performance/cycles/{{cycleId}}
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Review cycle retrieved successfully",
  "data": {
    "id": "cycle-uuid",
    "name": "Q4 2025 Review Cycle",
    "template": {
      "id": "template-uuid",
      "sections": [
        {
          "title": "Performance Objectives",
          "questions": [...]
        }
      ]
    },
    "reviews": [
      {
        "id": "review-uuid",
        "subject": {
          "id": 10,
          "name": "John Doe",
          "position": "Developer"
        },
        "manager": {
          "id": 5,
          "name": "Sarah Manager"
        },
        "status": "NOT_STARTED"
      }
    ]
  }
}
```

---

### 4.4 Activate Review Cycle (Admin Only)

**⚠️ IMPORTANT:** This creates Review records for all employees. Make sure all employees have managers assigned to their departments!

**Request:**

```
POST /api/performance/cycles/{{cycleId}}/activate
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (Optional - to include specific employees only):**

```json
{
  "employeeIds": [10, 11, 12]
}
```

**Or leave body empty to include all eligible employees:**

```json
{}
```

**Expected Response (201):**

```json
{
  "success": true,
  "message": "Review cycle activated and reviews created successfully",
  "data": [
    {
      "id": "review-uuid-1",
      "subjectId": 10,
      "managerId": 5,
      "status": "NOT_STARTED"
    },
    {
      "id": "review-uuid-2",
      "subjectId": 11,
      "managerId": 5,
      "status": "NOT_STARTED"
    }
  ]
}
```

**Postman Setup:**

- Save first review `id` to environment variable: `reviewId`

**Error Response (if employees missing managers):**

```json
{
  "success": false,
  "message": "Some employees do not have assigned managers",
  "error": "MANAGER_MISSING",
  "employeesWithoutManagers": [
    {
      "id": 15,
      "name": "John Doe",
      "email": "john@example.com",
      "department": "Engineering",
      "departmentId": 5
    }
  ],
  "details": "The following 1 employee(s) need managers assigned: John Doe. Please assign managers to their departments before activating the review cycle."
}
```

**Test Cases:**

- ✅ Activate with all employees
- ✅ Activate with specific employeeIds
- ❌ Activate cycle that's not DRAFT (should return 400)
- ❌ Activate with employees missing managers (should return 400 with list)
- ❌ Try as Manager/Staff (should get 403)

---

### 4.5 Complete Review Cycle (Admin Only)

**Request:**

```
POST /api/performance/cycles/{{cycleId}}/complete
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Review cycle completed successfully",
  "data": {
    "id": "cycle-uuid",
    "status": "COMPLETED"
  }
}
```

**Test Cases:**

- ✅ Complete ACTIVE cycle
- ❌ Complete cycle that's not ACTIVE (should return 400)

---

## Step 5: Reviews (Employee Perspective)

### 5.1 Get My Reviews (As Employee)

**Request:**

```
GET /api/performance/reviews/mine
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": [
    {
      "id": "review-uuid",
      "status": "NOT_STARTED",
      "cycle": {
        "id": "cycle-uuid",
        "name": "Q4 2025 Review Cycle",
        "startDate": "2025-10-01T00:00:00.000Z",
        "endDate": "2025-12-31T23:59:59.000Z",
        "selfReviewDueDate": "2025-12-15T00:00:00.000Z"
      },
      "manager": {
        "id": 5,
        "name": "Sarah Manager"
      }
    }
  ]
}
```

**Test Cases:**

- ✅ Employee sees their own reviews
- ✅ Empty array if no reviews

---

### 5.2 Get Review by ID (As Employee)

**Request:**

```
GET /api/performance/reviews/{{reviewId}}
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Review retrieved successfully",
  "data": {
    "id": "review-uuid",
    "status": "NOT_STARTED",
    "cycle": {
      "id": "cycle-uuid",
      "template": {
        "sections": [
          {
            "title": "Performance Objectives",
            "questions": [
              {
                "id": "question-uuid-1",
                "questionText": "Rate your overall performance this quarter (1-5)",
                "questionType": "RATING"
              }
            ]
          }
        ]
      }
    },
    "subject": {
      "id": 10,
      "name": "John Doe",
      "position": "Developer"
    },
    "manager": {
      "id": 5,
      "name": "Sarah Manager"
    },
    "responses": []
  }
}
```

**Test Cases:**

- ✅ Employee can view their own review
- ❌ Employee tries to view another employee's review (should get 403)

---

### 5.3 Save Response (Auto-save - As Employee)

**Request:**

```
POST /api/performance/reviews/{{reviewId}}/responses
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "questionId": "question-uuid-1",
  "responseType": "SELF",
  "textResponse": "I exceeded my targets by 20% this quarter",
  "ratingValue": 4.5,
  "selectedOptions": []
}
```

**For Rating Questions:**

```json
{
  "questionId": "question-uuid-1",
  "responseType": "SELF",
  "ratingValue": 4.5
}
```

**For Multiple Choice:**

```json
{
  "questionId": "question-uuid-2",
  "responseType": "SELF",
  "selectedOptions": ["Option A", "Option B"]
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Response saved successfully",
  "data": {
    "id": "response-uuid",
    "reviewId": "review-uuid",
    "questionId": "question-uuid-1",
    "authorId": 10,
    "responseType": "SELF",
    "textResponse": "I exceeded my targets by 20% this quarter",
    "ratingValue": 4.5,
    "createdAt": "2025-01-15T12:00:00.000Z"
  }
}
```

**Test Cases:**

- ✅ Save text response
- ✅ Save rating response
- ✅ Save multiple choice response
- ✅ Auto-save updates existing response (upsert)
- ❌ Employee tries to save with responseType: "MANAGER" (should get 403)
- ❌ Save after self-review already submitted (should return 400)

---

### 5.4 Submit Self Review (As Employee)

**Request:**

```
POST /api/performance/reviews/{{reviewId}}/submit-self
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Self review submitted successfully",
  "data": {
    "id": "review-uuid",
    "status": "PENDING_MANAGER",
    "selfReviewCompletedAt": "2025-01-15T12:30:00.000Z"
  }
}
```

**Test Cases:**

- ✅ Submit self review
- ❌ Submit already submitted review (should return 400)
- ❌ Manager tries to submit self review for employee (should get 403)

**Note:** After submission, manager will receive notification and email.

---

## Step 6: Reviews (Manager Perspective)

### 6.1 Get Reviews to Complete (As Manager)

**Request:**

```
GET /api/performance/reviews/to-complete
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": [
    {
      "id": "review-uuid",
      "status": "PENDING_MANAGER",
      "cycle": {
        "id": "cycle-uuid",
        "name": "Q4 2025 Review Cycle",
        "managerReviewDueDate": "2025-12-25T00:00:00.000Z"
      },
      "subject": {
        "id": 10,
        "name": "John Doe",
        "position": "Developer",
        "profilePic": "url-to-pic"
      }
    }
  ]
}
```

**Test Cases:**

- ✅ Manager sees reviews for their employees
- ✅ Only shows PENDING_MANAGER status
- ✅ Empty array if no pending reviews

---

### 6.2 Get Review by ID (As Manager)

**Request:**

```
GET /api/performance/reviews/{{reviewId}}
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Review retrieved successfully",
  "data": {
    "id": "review-uuid",
    "status": "PENDING_MANAGER",
    "cycle": {
      "template": {
        "sections": [
          {
            "questions": [
              {
                "id": "question-uuid-1",
                "questionText": "Rate your overall performance this quarter (1-5)",
                "questionType": "RATING"
              }
            ]
          }
        ]
      }
    },
    "subject": {
      "id": 10,
      "name": "John Doe"
    },
    "responses": [
      {
        "id": "response-uuid-1",
        "questionId": "question-uuid-1",
        "authorId": 10,
        "responseType": "SELF",
        "textResponse": "I exceeded my targets by 20%",
        "ratingValue": 4.5
      }
    ]
  }
}
```

**Note:** Manager can see employee's self-review responses.

---

### 6.3 Save Manager Response (Auto-save - As Manager)

**Request:**

```
POST /api/performance/reviews/{{reviewId}}/responses
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "questionId": "question-uuid-1",
  "responseType": "MANAGER",
  "textResponse": "John has consistently exceeded expectations. Great work on the Q4 project.",
  "ratingValue": 4.5,
  "selectedOptions": []
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Response saved successfully",
  "data": {
    "id": "response-uuid-2",
    "responseType": "MANAGER",
    "authorId": 5,
    "textResponse": "John has consistently exceeded expectations..."
  }
}
```

**Test Cases:**

- ✅ Manager saves their responses
- ❌ Manager tries to save with responseType: "SELF" (should get 403)
- ❌ Save after manager review already submitted (should return 400)

---

### 6.4 Submit Manager Review (As Manager)

**Request:**

```
POST /api/performance/reviews/{{reviewId}}/submit-manager
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "overallRating": 4.5,
  "overallRatingLabel": "Exceeds Expectations",
  "managerComments": "John has shown exceptional performance this quarter. He consistently met and exceeded all objectives. His technical skills have improved significantly, and he's become a valuable team member. Keep up the excellent work!"
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Manager review submitted successfully",
  "data": {
    "id": "review-uuid",
    "status": "COMPLETED",
    "overallRating": 4.5,
    "overallRatingLabel": "Exceeds Expectations",
    "managerComments": "John has shown exceptional performance...",
    "managerReviewCompletedAt": "2025-01-15T13:00:00.000Z"
  }
}
```

**Test Cases:**

- ✅ Submit manager review
- ❌ Submit when self-review not completed (should return 400)
- ❌ Submit already submitted review (should return 400)
- ❌ Employee tries to submit manager review (should get 403)

**Note:** After submission, employee will receive notification and email.

---

## Step 7: Admin Actions

### 7.1 Finalize Review (Admin Only)

**Request:**

```
POST /api/performance/reviews/{{reviewId}}/finalize
Authorization: Bearer {{token}}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Review finalized successfully",
  "data": {
    "reviewId": "review-uuid",
    "overallRating": 4.5,
    "overallRatingLabel": "Exceeds Expectations"
  }
}
```

**Test Cases:**

- ✅ Finalize COMPLETED review
- ❌ Finalize review that's not COMPLETED (should return 400)
- ❌ Try as Manager/Employee (should get 403)

**Note:**

- If overallRating not set, it calculates from manager responses
- Employee receives notification and email

---

### 7.2 Acknowledge Review (As Employee)

**Request:**

```
POST /api/performance/reviews/{{reviewId}}/acknowledge
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body:**

```json
{
  "employeeComments": "I acknowledge this review and agree with the feedback provided. I will work on the areas identified for improvement."
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "message": "Review acknowledged successfully",
  "data": {
    "id": "review-uuid",
    "status": "ACKNOWLEDGED",
    "employeeComments": "I acknowledge this review...",
    "acknowledgedAt": "2025-01-15T14:00:00.000Z"
  }
}
```

**Test Cases:**

- ✅ Acknowledge FINALIZED review
- ❌ Acknowledge review that's not FINALIZED (should return 400)
- ❌ Manager tries to acknowledge (should get 403)

---

## Complete Testing Flow

### Full End-to-End Test Scenario

1. **Login as Admin**
   - Get token

2. **Setup**
   - Get/Update performance settings
   - Create template with sections and questions
   - Create review cycle

3. **Activate Cycle**
   - Should create reviews for all employees
   - Verify all employees have managers (or get error)

4. **Login as Employee**
   - Get my reviews
   - Get review details
   - Save responses (auto-save)
   - Submit self review

5. **Login as Manager**
   - Get reviews to complete
   - Get review details (see employee's responses)
   - Save manager responses
   - Submit manager review

6. **Login as Admin**
   - Finalize review

7. **Login as Employee**
   - Acknowledge review

---

## Postman Collection Structure

### Recommended Folder Structure:

```
Performance Module API Tests
├── 1. Authentication
│   ├── Login (Admin)
│   ├── Login (Manager)
│   └── Login (Employee)
├── 2. Settings
│   ├── Get Settings
│   └── Update Settings
├── 3. Templates
│   ├── Get All Templates
│   ├── Create Template
│   ├── Get Template by ID
│   ├── Update Template
│   └── Delete Template
├── 4. Cycles
│   ├── Get All Cycles
│   ├── Create Cycle
│   ├── Get Cycle by ID
│   ├── Activate Cycle
│   └── Complete Cycle
├── 5. Reviews (Employee)
│   ├── Get My Reviews
│   ├── Get Review by ID
│   ├── Save Response
│   └── Submit Self Review
├── 6. Reviews (Manager)
│   ├── Get Reviews to Complete
│   ├── Get Review by ID
│   ├── Save Manager Response
│   └── Submit Manager Review
└── 7. Admin Actions
    ├── Finalize Review
    └── Acknowledge Review
```

---

## Environment Variables

Create these in Postman:

```
baseUrl = http://localhost:YOUR_PORT/api
token = (set after login)
templateId = (set after creating template)
cycleId = (set after creating cycle)
reviewId = (set after activating cycle)
questionId = (set from template response)
```

---

## Common Test Scenarios

### Error Cases to Test:

1. **Unauthorized (401)**
   - Request without token
   - Request with invalid token

2. **Forbidden (403)**
   - Manager tries admin-only endpoints
   - Employee tries manager-only endpoints
   - User tries to access another user's review

3. **Not Found (404)**
   - Invalid templateId
   - Invalid cycleId
   - Invalid reviewId

4. **Bad Request (400)**
   - Missing required fields
   - Invalid data types
   - Business rule violations (e.g., activate non-DRAFT cycle)

5. **Validation Errors**
   - Invalid rating scale
   - Invalid question type
   - Date validation (end before start)

---

## Tips for Testing

1. **Use Postman Pre-request Scripts** to auto-set variables:

```javascript
// After login, auto-save token
if (pm.response.code === 200) {
  const jsonData = pm.response.json();
  if (jsonData.data && jsonData.data.token) {
    pm.environment.set("token", jsonData.data.token);
  }
}
```

2. **Use Tests tab** to verify responses:

```javascript
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property("success");
  pm.expect(jsonData.success).to.eql(true);
});
```

3. **Test Status Transitions:**
   - NOT_STARTED → IN_PROGRESS (auto-save)
   - IN_PROGRESS → PENDING_MANAGER (submit self)
   - PENDING_MANAGER → COMPLETED (submit manager)
   - COMPLETED → FINALIZED (admin finalize)
   - FINALIZED → ACKNOWLEDGED (employee acknowledge)

---

## Quick Reference: Status Flow

```
NOT_STARTED
    ↓ (auto-save response)
IN_PROGRESS
    ↓ (submit self review)
PENDING_MANAGER
    ↓ (submit manager review)
COMPLETED
    ↓ (admin finalize)
FINALIZED
    ↓ (employee acknowledge)
ACKNOWLEDGED
```

---

This testing plan covers all endpoints in the performance module. Test in the order shown to follow the natural flow of the review process.
