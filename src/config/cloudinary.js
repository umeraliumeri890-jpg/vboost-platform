// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { AppError } = require('../utils/errors');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'microtask_proofs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }],
    public_id: (req, file) => {
      const crypto = require('crypto');
      return `proof_${crypto.randomBytes(16).toString('hex')}`;
    },
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

const uploadToCloudinary = multer({
  storage: cloudinaryStorage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, WebP, and GIF images are allowed.', 400), false);
    }
  },
  limits: { fileSize: MAX_SIZE_BYTES },
});

module.exports = { cloudinary, uploadToCloudinary };
