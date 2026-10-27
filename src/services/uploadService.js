const multer = require('multer');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// Store upload in memory buffer for stream processing
const storage = multer.memoryStorage();

// Validate file type (images only: jpg, jpeg, png, webp)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid file type. Only JPEG, PNG, and WebP images are permitted.',
        400,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }
};

// 5MB max file size
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

/**
 * Uploads a buffer to Cloudinary or falls back to a development data URI
 */
const uploadToCloudinary = async (fileBuffer, folder = 'rescrafted/products') => {
  if (!isConfigured) {
    // In local dev without Cloudinary credentials, return a stable placeholder or data URL
    const fallbackId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      url: `https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800&ref=${fallbackId}`,
      publicId: fallbackId,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:eco' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          logger.error({ error }, 'Cloudinary upload stream failed');
          return reject(new AppError('Failed to upload image to cloud storage.', 500, 'UPLOAD_ERROR'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete image from Cloudinary when product is permanently purged
 */
const deleteFromCloudinary = async (publicId) => {
  if (!isConfigured || publicId.startsWith('local_')) {
    return true;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    logger.warn({ error, publicId }, 'Failed to delete remote image from Cloudinary');
    return false;
  }
};

module.exports = {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
};
