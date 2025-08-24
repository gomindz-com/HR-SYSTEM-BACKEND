import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage engine
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const base = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname).slice(1).toLowerCase();

    let folderName;
    if (file.fieldname === "attachmentUrls") {
      folderName = "LEAVE_ATTACHMENTS";
    } else {
      folderName = "OTHERS";
    }

    const params = {
      folder: folderName,
      public_id: `${base}-${Date.now()}`,
    };

    if (["pdf", "docx", "doc"].includes(ext)) {
      params.resource_type = "raw"; // PDFs, Word docs, etc.
    } else {
      params.format = ext; // Keep image format
      params.transformation = [{ width: 800, height: 600, crop: "limit" }];
    }

    return params;
  },
});

// Updated file filter
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = /\.(jpg|jpeg|png|gif|pdf|docx|doc)$/i;

  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only JPG, PNG, PDF, or DOCX files are allowed"
      )
    );
  }
};

export { cloudinary };
// Export multer middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 5,
  },
});
