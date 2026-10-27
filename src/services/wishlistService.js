const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const cartService = require('./cartService');
const AppError = require('../utils/AppError');

class WishlistService {
  async getWishlist(userId) {
    let wishlist = await Wishlist.findOne({ userId }).populate({
      path: 'products',
      match: { status: 'published' },
      select: 'title slug pricePaise compareAtPricePaise stockQuantity condition images ratingsSummary sellerId',
      populate: {
        path: 'sellerId',
        select: 'storeName storeSlug',
      },
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [] });
    }

    return {
      _id: wishlist._id,
      userId: wishlist.userId,
      products: wishlist.products || [],
      count: wishlist.products?.length || 0,
    };
  }

  async addToWishlist(userId, productId) {
    const product = await Product.findById(productId);
    if (!product || product.status !== 'published') {
      throw new AppError('Product not found or unavailable.', 404, 'PRODUCT_NOT_FOUND');
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [productId] });
    } else {
      if (!wishlist.products.includes(productId)) {
        wishlist.products.push(productId);
        await wishlist.save();
      }
    }

    return this.getWishlist(userId);
  }

  async removeFromWishlist(userId, productId) {
    await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: productId } },
      { returnDocument: 'after' }
    );

    return this.getWishlist(userId);
  }

  async moveToCart(userId, productId) {
    // 1. Add to cart
    await cartService.addToCart(userId, { productId, quantity: 1 });

    // 2. Remove from wishlist
    await this.removeFromWishlist(userId, productId);

    return { message: 'Item successfully moved to cart.' };
  }
}

const wishlistService = new WishlistService();

module.exports = wishlistService;
