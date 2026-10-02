// src/utils/upload.js
/**
 * Upload middleware factory.
 * If USE_CLOUDINARY=true (and Cloudinary env vars are set), uses Cloudinary.
 * Otherwise falls back to local disk storage.
 */
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('./errors');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, WebP, and GIF images are allowed.', 400), false);
  }
};

let upload;

if (process.env.USE_CLOUDINARY === 'true') {
  const { uploadToCloudinary } = require('../config/cloudinary');
  upload = uploadToCloudinary;
} else {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.resolve(process.env.UPLOAD_DIR || './uploads/proofs'));
    },
    filename: (req, file, cb) => {
      const uid = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `proof_${uid}${ext}`);
    },
  });
  upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });
}

module.exports = upload;
