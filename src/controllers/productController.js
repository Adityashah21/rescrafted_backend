const productService = require('../services/productService');
const { uploadToCloudinary } = require('../services/uploadService');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const getProducts = asyncHandler(async (req, res) => {
  const { products, meta } = await productService.getProducts(req.query);
  return sendSuccess(res, 200, 'Products retrieved successfully.', products, meta);
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const result = await productService.getProductBySlug(slug);
  return sendSuccess(res, 200, 'Product details retrieved.', result);
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(
    req.user._id,
    req.user.role,
    req.body
  );
  return sendSuccess(res, 201, 'Product created successfully.', product);
});

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await productService.updateProduct(
    id,
    req.user._id,
    req.user.role,
    req.body
  );
  return sendSuccess(res, 200, 'Product updated successfully.', product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await productService.deleteProduct(
    id,
    req.user._id,
    req.user.role
  );
  return sendSuccess(res, 200, result.message);
});

const uploadProductImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No image file provided.', 400, 'NO_FILE_PROVIDED');
  }

  const uploadResult = await uploadToCloudinary(req.file.buffer, 'rescrafted/products');
  return sendSuccess(res, 200, 'Image uploaded successfully.', uploadResult);
});

module.exports = {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
};
