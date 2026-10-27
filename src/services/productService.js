const Product = require('../models/Product');
const Category = require('../models/Category');
const SellerProfile = require('../models/SellerProfile');
const AppError = require('../utils/AppError');
const createSlug = require('../utils/slugify');
const { formatPaginationMeta } = require('../utils/pagination');

class ProductService {
  async getProducts(query = {}) {
    const {
      search,
      category,
      condition,
      minPrice,
      maxPrice,
      minRating,
      materials,
      sellerId,
      sort = 'newest',
      page = 1,
      limit = 12,
    } = query;

    const filter = { status: 'published' };

    // 1. Text Search across title, description, and materials
    if (search && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    // 2. Category filter (can be ObjectId or category slug)
    if (category) {
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        filter.categoryId = category;
      } else {
        const catDoc = await Category.findOne({ slug: category.toLowerCase() });
        if (catDoc) {
          filter.categoryId = catDoc._id;
        }
      }
    }

    // 3. Condition filter
    if (condition) {
      filter.condition = condition;
    }

    // 4. Price range filter (in whole paise)
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.pricePaise = {};
      if (minPrice !== undefined) filter.pricePaise.$gte = minPrice;
      if (maxPrice !== undefined) filter.pricePaise.$lte = maxPrice;
    }

    // 5. Minimum rating filter
    if (minRating) {
      filter['ratingsSummary.averageRating'] = { $gte: minRating };
    }

    // 6. Materials filter
    if (materials) {
      const materialList = materials.split(',').map((m) => new RegExp(m.trim(), 'i'));
      filter.materials = { $in: materialList };
    }

    // 7. Seller filter
    if (sellerId) {
      filter.sellerId = sellerId;
    }

    // 8. Sorting strategy
    let sortOptions = { createdAt: -1 };
    switch (sort) {
      case 'price_asc':
        sortOptions = { pricePaise: 1 };
        break;
      case 'price_desc':
        sortOptions = { pricePaise: -1 };
        break;
      case 'rating':
        sortOptions = { 'ratingsSummary.averageRating': -1, createdAt: -1 };
        break;
      case 'popular':
        sortOptions = { 'ratingsSummary.reviewCount': -1, createdAt: -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('categoryId', 'name slug')
        .populate('sellerId', 'storeName storeSlug logoUrl ratingsSummary')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const meta = formatPaginationMeta(total, page, limit);

    return { products, meta };
  }

  async getProductBySlug(slug) {
    const product = await Product.findOne({
      slug: slug.toLowerCase(),
      status: { $in: ['published', 'draft'] },
    })
      .populate('categoryId', 'name slug description')
      .populate('subcategoryId', 'name slug')
      .populate('sellerId', 'storeName storeSlug logoUrl bio ratingsSummary status')
      .lean();

    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    // Fetch up to 4 related sustainable products in the same category
    const relatedProducts = await Product.find({
      categoryId: product.categoryId?._id,
      _id: { $ne: product._id },
      status: 'published',
    })
      .populate('sellerId', 'storeName storeSlug')
      .limit(4)
      .lean();

    return {
      product,
      relatedProducts,
    };
  }

  async createProduct(userId, userRole, productData) {
    // 1. Find seller profile belonging to user
    let sellerProfile = await SellerProfile.findOne({ userId });

    // In dev or if seller profile wasn't provisioned yet, create a default one
    if (!sellerProfile) {
      sellerProfile = await SellerProfile.create({
        userId,
        storeName: `Studio ${Math.random().toString(36).substring(2, 7)}`,
        storeSlug: `studio-${Date.now()}`,
        status: 'approved',
      });
    }

    // 2. Safe unique slug generation
    const slug = createSlug(productData.title, true);

    // 3. Generate unique SKU if omitted
    const sku =
      productData.sku ||
      `RC-${productData.condition.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // 4. Create product
    const product = await Product.create({
      ...productData,
      sellerId: sellerProfile._id,
      slug,
      sku,
      status: productData.status || 'published',
    });

    return product;
  }

  async updateProduct(productId, userId, userRole, updateData) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    // Enforce ownership if user is not admin
    if (userRole !== 'admin') {
      const sellerProfile = await SellerProfile.findOne({ userId });
      if (!sellerProfile || product.sellerId.toString() !== sellerProfile._id.toString()) {
        throw new AppError('You are not authorized to update this product listing.', 403, 'FORBIDDEN');
      }
    }

    if (updateData.title && updateData.title !== product.title) {
      updateData.slug = createSlug(updateData.title, true);
    }

    const updated = await Product.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    });

    return updated;
  }

  async deleteProduct(productId, userId, userRole) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    if (userRole !== 'admin') {
      const sellerProfile = await SellerProfile.findOne({ userId });
      if (!sellerProfile || product.sellerId.toString() !== sellerProfile._id.toString()) {
        throw new AppError('You are not authorized to remove this listing.', 403, 'FORBIDDEN');
      }
    }

    // Soft delete / archive to protect historical order records
    product.status = 'archived';
    await product.save();

    return { message: 'Product listing successfully archived.' };
  }
}

const productService = new ProductService();

module.exports = productService;
