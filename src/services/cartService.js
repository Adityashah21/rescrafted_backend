const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');

class CartService {
  /**
   * Helper to revalidate prices, stock, and compute financial totals in integer paise
   */
  async formatAndRevalidateCart(cartDoc) {
    await cartDoc.populate({
      path: 'items.productId',
      select: 'title slug pricePaise compareAtPricePaise stockQuantity images condition sellerId status',
      populate: {
        path: 'sellerId',
        select: 'storeName storeSlug logoUrl',
      },
    });

    let subtotalPaise = 0;
    const validatedItems = [];
    const sellerGroupsMap = new Map();
    let hasUnavailableItems = false;

    for (const item of cartDoc.items) {
      const product = item.productId;

      // Check if product was deleted or archived
      if (!product || product.status !== 'published') {
        hasUnavailableItems = true;
        continue;
      }

      // Check if requested quantity exceeds current real-time stock
      const isOutOfStock = product.stockQuantity <= 0;
      const isQuantityAdjusted = item.quantity > product.stockQuantity;
      const effectiveQuantity = isOutOfStock
        ? 0
        : isQuantityAdjusted
        ? product.stockQuantity
        : item.quantity;

      if (isOutOfStock || isQuantityAdjusted) {
        hasUnavailableItems = true;
      }

      // Re-snapshot active database price (never trust stale client prices)
      const currentPricePaise = product.pricePaise;
      const itemSubtotalPaise = currentPricePaise * effectiveQuantity;

      if (!isOutOfStock) {
        subtotalPaise += itemSubtotalPaise;
      }

      const formattedItem = {
        _id: item._id,
        productId: {
          _id: product._id,
          title: product.title,
          slug: product.slug,
          pricePaise: currentPricePaise,
          compareAtPricePaise: product.compareAtPricePaise,
          stockQuantity: product.stockQuantity,
          condition: product.condition,
          imageUrl: product.images?.[0]?.url || '',
          seller: product.sellerId,
        },
        quantity: item.quantity,
        effectiveQuantity,
        unitPricePaise: currentPricePaise,
        itemSubtotalPaise,
        isOutOfStock,
        isQuantityAdjusted,
      };

      validatedItems.push(formattedItem);

      // Multi-seller grouping for fulfillment clarity
      const sellerIdStr = product.sellerId?._id?.toString() || 'unknown';
      if (!sellerGroupsMap.has(sellerIdStr)) {
        sellerGroupsMap.set(sellerIdStr, {
          sellerId: product.sellerId?._id,
          storeName: product.sellerId?.storeName || 'Artisan Workshop',
          storeSlug: product.sellerId?.storeSlug || '',
          items: [],
          subtotalPaise: 0,
        });
      }
      const group = sellerGroupsMap.get(sellerIdStr);
      group.items.push(formattedItem);
      group.subtotalPaise += itemSubtotalPaise;
    }

    // Shipping rules: Free carbon-neutral shipping above ₹999 (99900 paise), else ₹99 (9900 paise)
    const shippingThresholdPaise = 99900;
    const standardShippingPaise = 9900;
    const shippingPaise =
      subtotalPaise === 0 || subtotalPaise >= shippingThresholdPaise
        ? 0
        : standardShippingPaise;

    // Tax calculation: 5% GST for circular sustainable goods
    const taxPaise = Math.round(subtotalPaise * 0.05);
    const totalPaise = subtotalPaise + shippingPaise + taxPaise;

    return {
      _id: cartDoc._id,
      userId: cartDoc.userId,
      items: validatedItems,
      itemCount: validatedItems.reduce((acc, item) => acc + item.effectiveQuantity, 0),
      summary: {
        subtotalPaise,
        shippingPaise,
        taxPaise,
        totalPaise,
        freeShippingThresholdPaise: shippingThresholdPaise,
        isFreeShippingQualified: subtotalPaise >= shippingThresholdPaise && subtotalPaise > 0,
      },
      sellerGroups: Array.from(sellerGroupsMap.values()),
      hasUnavailableItems,
    };
  }

  async getCart(userId) {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }
    return this.formatAndRevalidateCart(cart);
  }

  async addToCart(userId, { productId, quantity }) {
    const product = await Product.findById(productId);
    if (!product || product.status !== 'published') {
      throw new AppError('This product is unavailable or no longer listed.', 404, 'PRODUCT_NOT_AVAILABLE');
    }

    if (product.stockQuantity < quantity) {
      throw new AppError(
        `Only ${product.stockQuantity} unit(s) available in stock.`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if product is already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > product.stockQuantity) {
        throw new AppError(
          `Cannot add more units. Total in cart would exceed available stock (${product.stockQuantity}).`,
          400,
          'STOCK_LIMIT_EXCEEDED'
        );
      }
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].pricePaiseSnapshot = product.pricePaise;
    } else {
      cart.items.push({
        productId,
        quantity,
        pricePaiseSnapshot: product.pricePaise,
      });
    }

    await cart.save();
    return this.formatAndRevalidateCart(cart);
  }

  async updateCartItem(userId, itemId, quantity) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError('Cart not found.', 404, 'CART_NOT_FOUND');
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new AppError('Item not found in cart.', 404, 'ITEM_NOT_FOUND');
    }

    const product = await Product.findById(item.productId);
    if (!product || product.status !== 'published') {
      // Remove item if no longer published
      cart.items.pull(itemId);
      await cart.save();
      throw new AppError('This product is no longer available and was removed from your cart.', 400, 'PRODUCT_UNAVAILABLE');
    }

    if (quantity > product.stockQuantity) {
      throw new AppError(
        `Only ${product.stockQuantity} unit(s) available in stock.`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    item.quantity = quantity;
    item.pricePaiseSnapshot = product.pricePaise;

    await cart.save();
    return this.formatAndRevalidateCart(cart);
  }

  async removeCartItem(userId, itemId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError('Cart not found.', 404, 'CART_NOT_FOUND');
    }

    cart.items.pull(itemId);
    await cart.save();

    return this.formatAndRevalidateCart(cart);
  }

  async clearCart(userId) {
    let cart = await Cart.findOne({ userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    return { message: 'Cart cleared successfully.' };
  }
}

const cartService = new CartService();

module.exports = cartService;
