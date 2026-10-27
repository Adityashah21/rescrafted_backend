const Category = require('../models/Category');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const createSlug = require('../utils/slugify');

class CategoryService {
  async getAllCategories() {
    // Fetch all active categories with product count
    const categories = await Category.find({ isActive: true })
      .populate('parentCategory', 'name slug')
      .sort({ name: 1 })
      .lean();

    // Attach published product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          categoryId: cat._id,
          status: 'published',
        });
        return {
          ...cat,
          productCount: count,
        };
      })
    );

    return categoriesWithCount;
  }

  async getCategoryBySlug(slug) {
    const category = await Category.findOne({
      slug: slug.toLowerCase(),
      isActive: true,
    }).populate('parentCategory', 'name slug');

    if (!category) {
      throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    }

    return category;
  }

  async createCategory(data) {
    const slug = createSlug(data.name);

    const existing = await Category.findOne({ slug });
    if (existing) {
      throw new AppError('A category with this name already exists.', 409, 'DUPLICATE_CATEGORY');
    }

    const category = await Category.create({
      ...data,
      slug,
    });

    return category;
  }

  async updateCategory(id, data) {
    if (data.name) {
      data.slug = createSlug(data.name);
    }

    const category = await Category.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    }

    return category;
  }

  async deleteCategory(id) {
    const hasProducts = await Product.exists({ categoryId: id });
    if (hasProducts) {
      // Soft-deactivate if products are linked
      await Category.findByIdAndUpdate(id, { isActive: false });
      return { message: 'Category deactivated because products are linked to it.' };
    }

    await Category.findByIdAndDelete(id);
    return { message: 'Category deleted successfully.' };
  }
}

const categoryService = new CategoryService();

module.exports = categoryService;
