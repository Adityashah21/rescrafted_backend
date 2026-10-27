const express = require('express');
const productController = require('../controllers/productController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validateRequest = require('../middlewares/validateRequest');
const { upload } = require('../services/uploadService');
const {
  createProductSchema,
  updateProductSchema,
} = require('../validators/productValidators');

const router = express.Router();

// Public discovery endpoints
router.get('/', productController.getProducts);
router.get('/:slug', productController.getProductBySlug);

// Seller / Admin protected endpoints
router.post(
  '/',
  authenticate,
  authorize('seller', 'admin'),
  validateRequest(createProductSchema),
  productController.createProduct
);

router.post(
  '/upload-image',
  authenticate,
  authorize('seller', 'admin'),
  upload.single('image'),
  productController.uploadProductImage
);

router.patch(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  validateRequest(updateProductSchema),
  productController.updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorize('seller', 'admin'),
  productController.deleteProduct
);

module.exports = router;
