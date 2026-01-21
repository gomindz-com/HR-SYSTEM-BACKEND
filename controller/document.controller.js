import prisma from "../config/prisma.config.js";
import {
  upload,
  deleteFromCloudinary,
  getCloudinaryUrl,
  extractCloudinaryUrl,
} from "../config/cloudinary.config.js";

// Upload single document
export const uploadDocument = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { category, description } = req.body;
    const { companyId, id: uploadedBy } = req.user;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Check if employee exists and belongs to the company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(employeeId),
        companyId: companyId,
        deleted: false,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // File is already uploaded to Cloudinary by multer
    const fileName = req.file.filename;
    const publicId = req.file.public_id || req.file.filename;

    // Get the URL from Cloudinary response
    const publicUrl = extractCloudinaryUrl(req.file);

    console.log("Upload Debug:", {
      fileName,
      publicId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      path: req.file.path,
      url: req.file.url,
      publicUrl,
      fileKeys: Object.keys(req.file),
      pathType: typeof req.file.path,
      urlType: typeof req.file.url,
      isExcel:
        req.file.mimetype.includes("excel") ||
        req.file.mimetype.includes("spreadsheet"),
      isCSV: req.file.mimetype.includes("csv"),
      // Log the actual file object structure for debugging
      fileStructure: JSON.stringify(req.file, null, 2),
    });

    // Save document record to database
    const document = await prisma.document.create({
      data: {
        employeeId: parseInt(employeeId),
        companyId: companyId,
        fileName: fileName,
        originalName: req.file.originalname,
        fileUrl: publicUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        category: category || "OTHER",
        description: description || null,
        uploadedBy: uploadedBy,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: document,
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error: error.message,
    });
  }
};

// Upload multiple documents
export const uploadMultipleDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { category, description } = req.body;
    const { companyId, id: uploadedBy } = req.user;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    // Check if employee exists and belongs to the company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(employeeId),
        companyId: companyId,
        deleted: false,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Files are already uploaded to Cloudinary by multer
    // Save document records to database
    const documents = await Promise.all(
      req.files.map(async (file) => {
        const publicId = file.public_id || file.filename;

        // Get the URL from Cloudinary response
        const publicUrl = extractCloudinaryUrl(file);

        console.log("Multiple Upload Debug:", {
          fileName: file.filename,
          publicId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          path: file.path,
          url: file.url,
          publicUrl,
        });

        return await prisma.document.create({
          data: {
            employeeId: parseInt(employeeId),
            companyId: companyId,
            fileName: file.filename,
            originalName: file.originalname,
            fileUrl: publicUrl,
            fileSize: file.size,
            mimeType: file.mimetype,
            category: category || "OTHER",
            description: description || null,
            uploadedBy: uploadedBy,
          },
          include: {
            uploader: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      })
    );

    res.status(201).json({
      success: true,
      message: `${documents.length} documents uploaded successfully`,
      data: documents,
    });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload documents",
      error: error.message,
    });
  }
};

// Get all documents for an employee
export const getEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { companyId } = req.user;

    // Check if employee exists and belongs to the company
    const employee = await prisma.employee.findFirst({
      where: {
        id: parseInt(employeeId),
        companyId: companyId,
        deleted: false,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const documents = await prisma.document.findMany({
      where: {
        employeeId: parseInt(employeeId),
        companyId: companyId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
      error: error.message,
    });
  }
};

// Delete document
export const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { companyId } = req.user;

    const document = await prisma.document.findFirst({
      where: {
        id: parseInt(documentId),
        companyId: companyId,
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Delete from Cloudinary
    try {
      // Use the fileName as publicId (it should already include the folder path)
      const publicId = document.fileName.split(".")[0]; // Remove file extension
      console.log("Deleting from Cloudinary:", {
        publicId,
        fileName: document.fileName,
      });
      await deleteFromCloudinary(publicId);
    } catch (cloudinaryError) {
      console.error("Error deleting from Cloudinary:", cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await prisma.document.delete({
      where: {
        id: parseInt(documentId),
      },
    });

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: error.message,
    });
  }
};

// Helper function to get company document statistics
export const getCompanyDocumentStats = async (req, res) => {
  try {
    const { companyId } = req.user;

    const stats = await prisma.document.groupBy({
      by: ["category"],
      where: {
        companyId: companyId,
      },
      _count: {
        id: true,
      },
    });

    const totalDocuments = await prisma.document.count({
      where: {
        companyId: companyId,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        totalDocuments,
        categoryStats: stats,
      },
    });
  } catch (error) {
    console.error("Error fetching document stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch document statistics",
      error: error.message,
    });
  }
};


// =================================
// COMPANY RELATED DOCUMENTS
// ================================

// Upload a company-wide document (e.g. policies, handbook, compliance docs)
// File is uploaded to Cloudinary via multer (upload.single("file"))
export const addCompanyDocument = async (req, res) => {
  try {
    const { id: uploadedBy, companyId, role } = req.user;
    const { category, description } = req.body;

    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to upload company documents",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const fileName = req.file.filename;
    const publicId = req.file.public_id || req.file.filename;

    const publicUrl = extractCloudinaryUrl(req.file);

    console.log("Company Document Upload Debug:", {
      fileName,
      publicId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      path: req.file.path,
      url: req.file.url,
      publicUrl,
      category,
    });

    const document = await prisma.document.create({
      data: {
        employeeId: null,
        companyId,
        fileName,
        originalName: req.file.originalname,
        fileUrl: publicUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        category: category || "COMPANY_POLICY",
        description: description || null,
        uploadedBy,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Company document uploaded successfully",
      data: document,
    });
  } catch (error) {
    console.error("Error uploading company document:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload company document",
      error: error.message,
    });
  }
};

export const getCompanyDocuments = async (req, res) => {
  try {
    const { companyId } = req.user;
    const { category } = req.query;

    const whereClause = {
      companyId,
      employeeId: null,
    };

    if (category) {
      whereClause.category = category;
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching company documents:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch company documents",
      error: error.message,
    });
  }
};

export const getMyCompaniesDocuments = async (req, res) => {
  try {
    const { id, companyId } = req.user;

    if (!companyId || !id) {
      return res.status(400).json({
        success: false,
        message: "Company ID and user ID are required",
      });
    }

    const documents = await prisma.document.findMany({
      where: {
        companyId,
        employeeId: null,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching my companies documents:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch my companies documents",
      error: error.message,
    });
  }
}; 