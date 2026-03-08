const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Avatar storage
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'mercx/avatars', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], transformation: [{ width: 400, height: 400, crop: 'fill' }] }
});

// Portfolio storage
const portfolioStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'mercx/portfolio', allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] }
});

// Delivery files storage
const deliveryStorage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'mercx/deliveries', resource_type: 'auto' }
});

exports.uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 } });
exports.uploadPortfolio = multer({ storage: portfolioStorage, limits: { fileSize: 5 * 1024 * 1024 } });
exports.uploadDelivery = multer({ storage: deliveryStorage, limits: { fileSize: 50 * 1024 * 1024 } });
exports.cloudinary = cloudinary;
