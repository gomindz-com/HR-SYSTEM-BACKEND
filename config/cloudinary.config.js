import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer with Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Get companyId from the authenticated user
    const companyId = req.user?.companyId || "default";
    const employeeId = req.params?.employeeId || "unknown";

    // Only apply transformations to images, not documents
    const isImage = file.mimetype.startsWith("image/");
    const isExcel =
      file.mimetype.includes("excel") ||
      file.mimetype.includes("spreadsheet") ||
      file.mimetype.includes("csv");

    return {
      folder: `hr-documents/company-${companyId}/employee-${employeeId}`,
      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp", // Images
        "pdf", // PDFs
        "doc",
        "docx", // Word documents
        "xls",
        "xlsx",
        "csv", // Excel/CSV files
        "txt",
        "rtf", // Text files
        "ppt",
        "pptx", // PowerPoint
        "zip",
        "rar", // Archives
      ],
      transformation: isImage
        ? [{ width: 1000, height: 1000, crop: "limit" }]
        : undefined,
      public_id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      resource_type: isImage ? "image" : "raw",
      use_filename: true,
      unique_filename: true,
      // Special handling for Excel files
      ...(isExcel && {
        resource_type: "raw",
        // Don't force format, let Cloudinary handle it naturally
      }),
    };
  },
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      // PDFs
      "application/pdf",
      // Word documents
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // Excel/CSV files
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "text/comma-separated-values",
      "application/excel",
      "application/x-excel",
      "application/x-msexcel",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
      "application/vnd.ms-excel.template.macroEnabled.12",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
      "text/tab-separated-values",
      "application/vnd.oasis.opendocument.spreadsheet",
      // Text files
      "text/plain",
      "text/rtf",
      // PowerPoint
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // Archives
      "application/zip",
      "application/x-rar-compressed",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed: PDF, Word, Excel, CSV, Images, Text, PowerPoint, Archives`
        ),
        false
      );
    }
  },
});

// Helper function to delete file from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw error;
  }
};

// Helper function to generate proper Cloudinary URL
export const getCloudinaryUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    ...options,
  });
};

// Helper function to extract URL from Cloudinary response
export const extractCloudinaryUrl = (file) => {
  let baseUrl;

  // Check if path is a string
  if (typeof file.path === "string") {
    baseUrl = file.path;
  }
  // Check if path is an object with secure_url
  else if (file.path && file.path.secure_url) {
    baseUrl = file.path.secure_url;
  }
  // Check if url is a string
  else if (typeof file.url === "string") {
    baseUrl = file.url;
  }
  // Check if url is an object with secure_url
  else if (file.url && file.url.secure_url) {
    baseUrl = file.url.secure_url;
  }
  // Fallback: construct URL from public_id
  else {
    const publicId = file.public_id || file.filename;
    baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}`;
  }

  // Return the base URL as-is (Google Docs viewer will handle PDF viewing)
  return baseUrl;
};

// Helper function to ensure file is publicly accessible
export const makeFilePublic = async (publicId, resourceType = "raw") => {
  try {
    const result = await cloudinary.uploader.explicit(publicId, {
      type: "upload",
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error("Error making file public:", error);
    throw error;
  }
};

export { cloudinary };
