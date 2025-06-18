import multer from "multer";
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Define storage configuration
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "dev-profile_uploads", // Folder name in Cloudinary
    allowed_formats: ["png", "jpeg"],
  },
});

const upload = multer({ storage });

export default upload;