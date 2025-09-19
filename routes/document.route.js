import express from "express";
import {
  uploadDocument,
  uploadMultipleDocuments,
  getEmployeeDocuments,
  deleteDocument,
  getCompanyDocumentStats,
} from "../controller/document.controller.js";
import { upload } from "../config/cloudinary.config.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// Upload single document
router.post(
  "/upload/:employeeId",
  verifyToken,
  upload.single("file"),
  uploadDocument
);

// Upload multiple documents
router.post(
  "/upload-multiple/:employeeId",
  verifyToken,
  upload.array("files", 10),
  uploadMultipleDocuments
);

// Get all documents for an employee
router.get("/employee/:employeeId", verifyToken, getEmployeeDocuments);

// Get company document statistics
router.get("/stats", verifyToken, getCompanyDocumentStats);

// Delete document
router.delete("/:documentId", verifyToken, deleteDocument);

export default router;
