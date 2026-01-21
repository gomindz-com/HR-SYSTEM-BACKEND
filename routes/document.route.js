import express from "express";
import {
  uploadDocument,
  uploadMultipleDocuments,
  getEmployeeDocuments,
  deleteDocument,
  getCompanyDocumentStats,
  addCompanyDocument,
  getCompanyDocuments,
  getMyCompaniesDocuments,
} from "../controller/document.controller.js";
import { upload } from "../config/cloudinary.config.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { checkSubscription } from "../middleware/subscription.middleware.js";

const router = express.Router();

// Document routes require: authentication + active subscription (all plans)
// Upload single document
router.post(
  "/upload/:employeeId",
  verifyToken,
  checkSubscription,
  upload.single("file"),
  uploadDocument
);

// Upload multiple documents
router.post(
  "/upload-multiple/:employeeId",
  verifyToken,
  checkSubscription,
  upload.array("files", 10),
  uploadMultipleDocuments
);

// Get all documents for an employee
router.get(
  "/employee/:employeeId",
  verifyToken,
  checkSubscription,
  getEmployeeDocuments
);

// Get company document statistics
router.get("/stats", verifyToken, checkSubscription, getCompanyDocumentStats);

// Upload company-wide document (e.g. policies, handbook)
router.post(
  "/company/upload",
  verifyToken,
  checkSubscription,
  upload.single("file"),
  addCompanyDocument
);

// List company-wide documents
router.get(
  "/company",
  verifyToken,
  checkSubscription,
  getCompanyDocuments
);

// List company-wide documents for employee portal
router.get(
  "/company/my-documents",
  verifyToken,
  checkSubscription,
  getMyCompaniesDocuments
);

// Delete document
router.delete("/:documentId", verifyToken, checkSubscription, deleteDocument);

export default router;
