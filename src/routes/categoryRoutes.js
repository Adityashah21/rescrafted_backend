const express = require('express');
const categoryController = require('../controllers/categoryController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validateRequest = require('../middlewares/validateRequest');
const { createCategorySchema } = require('../validators/productValidators');

const router = express.Router();

// Public routes
router.get('/', categoryController.getCategories);
router.get('/:slug', categoryController.getCategory);

// Protected Admin Routes
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateRequest(createCategorySchema),
  categoryController.createCategory
);

router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  categoryController.updateCategory
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  categoryController.deleteCategory
);

module.exports = router;
