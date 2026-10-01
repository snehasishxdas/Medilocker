import multer from 'multer';
import { AppError } from './errorHandler';

// Use memory storage so we can stream to Cloudinary or process with Sharp/Gemini
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
];

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file format. Only PDF, JPG, PNG, and WebP are allowed.', 400));
    }
  },
});
