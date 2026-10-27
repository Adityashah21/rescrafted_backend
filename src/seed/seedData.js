const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const env = require('../config/env');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const Category = require('../models/Category');
const Product = require('../models/Product');
const logger = require('../utils/logger');

const CATEGORIES = [
  {
    name: 'Upcycled Home Decor',
    slug: 'upcycled-decor',
    description: 'Vases, lighting, and art handcrafted from rescued industrial and domestic materials.',
    imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=600',
    isSustainabilityCategory: true,
  },
  {
    name: 'Reclaimed Wood Furniture',
    slug: 'reclaimed-furniture',
    description: 'Bespoke tables, desks, and shelving units rescued from architectural demolition timber.',
    imageUrl: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&q=80&w=600',
    isSustainabilityCategory: true,
  },
  {
    name: 'Refurbished Audio & Tech',
    slug: 'refurbished-tech',
    description: 'Audio gear, vintage hi-fi turntables, and renewed devices restored to studio fidelity.',
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=600',
    isSustainabilityCategory: true,
  },
  {
    name: 'Recycled Fashion & Bags',
    slug: 'recycled-fashion',
    description: 'Bags, backpacks, and accessories upcycled from billboard banners, tire tubes, and canvas.',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=600',
    isSustainabilityCategory: true,
  },
  {
    name: 'Zero Waste Daily Living',
    slug: 'zero-waste',
    description: 'Refillable kitchen essentials, organic cleaning kits, and plastic-free goods.',
    imageUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&q=80&w=600',
    isSustainabilityCategory: true,
  },
  {
    name: 'Circular Garden & Planters',
    slug: 'garden-planters',
    description: 'Planters and gardening tools fashioned from discarded ceramic tiles and upcycled steel.',
    imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&q=80&w=600',
    isSustainabilityCategory: true,
  },
];

const seedDatabase = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }
    logger.info('Connected to MongoDB Atlas for seeding.');

    // 1. Seed or find Categories
    const categoryDocs = [];
    for (const cat of CATEGORIES) {
      let doc = await Category.findOne({ slug: cat.slug });
      if (!doc) {
        doc = await Category.create(cat);
        logger.info(`Created category: ${cat.name}`);
      }
      categoryDocs.push(doc);
    }

    const catMap = {};
    categoryDocs.forEach((c) => {
      catMap[c.slug] = c._id;
    });

    // 2. Seed an artisan seller user & profile
    const sellerEmail = 'artisan.jaipur@rescrafted.test';
    let sellerUser = await User.findOne({ email: sellerEmail });
    if (!sellerUser) {
      sellerUser = await User.create({
        name: 'Aarav Jaipuria',
        email: sellerEmail,
        password: 'Password123!',
        role: 'seller',
        phone: '9876543210',
        isEmailVerified: true,
      });
    }

    let sellerProfile = await SellerProfile.findOne({ userId: sellerUser._id });
    if (!sellerProfile) {
      sellerProfile = await SellerProfile.create({
        userId: sellerUser._id,
        storeName: 'TimberCraft & Glass Studio',
        storeSlug: 'timbercraft-glass-studio',
        bio: 'We transform architectural demolition timber and salvaged bottle glass into functional heirloom pieces.',
        status: 'approved',
        businessAddress: {
          city: 'Jaipur',
          state: 'Rajasthan',
          country: 'India',
          postalCode: '302001',
        },
        ratingsSummary: {
          averageRating: 4.9,
          totalReviews: 46,
        },
      });
      logger.info('Created sample SellerProfile: TimberCraft & Glass Studio');
    }

    // 3. Seed sample sustainable products
    const sampleProducts = [
      {
        title: 'Minimalist Desk Lamp from Century Reclaimed Teak',
        slug: 'reclaimed-teak-minimalist-desk-lamp',
        description:
          'Handcrafted from salvaged 100-year-old teak salvaged from heritage havelis in Rajasthan. Paired with solid brass rotary switch and vintage braided cotton cord. Every grain tells a story of survival and architectural heritage.',
        pricePaise: 249900, // ₹2,499.00
        compareAtPricePaise: 349900,
        categoryId: catMap['upcycled-decor'],
        condition: 'upcycled',
        materials: ['Reclaimed Colonial Teak', 'Solid Brass Switch', 'Organic Cotton Cord'],
        sustainabilitySpecs: {
          recycledPercentage: 92,
          materialsReused: ['Demolition Teak Beams', 'Repurposed Plumbing Fixtures'],
          repairabilityIndex: 9,
          packagingType: 'recycled_cardboard',
          weightGrams: 1450,
          estimatedCo2SavedKg: 4.8,
          estimatedWasteDivertedKg: 2.1,
        },
        dimensions: { lengthCm: 22, widthCm: 14, heightCm: 38 },
        stockQuantity: 14,
        sku: 'RC-UPC-TEAK-01',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&q=80&w=800',
            publicId: 'seed_lamp_1',
            isPrimary: true,
          },
          {
            url: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&q=80&w=800',
            publicId: 'seed_lamp_2',
            isPrimary: false,
          },
        ],
        status: 'published',
        ratingsSummary: { averageRating: 4.9, reviewCount: 38 },
      },
      {
        title: 'Waterproof Commuter Bag Upcycled from Vinyl Billboards',
        slug: 'upcycled-billboard-waterproof-messenger-bag',
        description:
          'Constructed from heavy-duty discarded highway billboard banners that would otherwise sit in landfills for centuries. Each bag has a one-of-a-kind graphic cut. Waterproof, exceptionally durable, and lined with recycled PET fabric.',
        pricePaise: 189900, // ₹1,899.00
        compareAtPricePaise: 249900,
        categoryId: catMap['recycled-fashion'],
        condition: 'upcycled',
        materials: ['Repurposed Vinyl Billboard Canvas', 'Automotive Seatbelt Webbing', 'YKK Zippers'],
        sustainabilitySpecs: {
          recycledPercentage: 98,
          materialsReused: ['Highway PVC Billboard', 'Scrapped Car Seatbelt'],
          repairabilityIndex: 8,
          packagingType: 'zero_waste',
          weightGrams: 620,
          estimatedCo2SavedKg: 6.2,
          estimatedWasteDivertedKg: 1.4,
        },
        dimensions: { lengthCm: 38, widthCm: 12, heightCm: 28 },
        stockQuantity: 8,
        sku: 'RC-UPC-BAG-02',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800',
            publicId: 'seed_bag_1',
            isPrimary: true,
          },
        ],
        status: 'published',
        ratingsSummary: { averageRating: 4.8, reviewCount: 52 },
      },
      {
        title: 'Certified Refurbished 1980s Studio Hi-Fi Headphones',
        slug: 'restored-vintage-analog-headphones',
        description:
          'Classic Japanese monitoring headphones fully reconditioned by acoustic engineers. Drivers measured and calibrated to within 0.5dB channel balance, fitted with new high-density memory foam ear cushions and oxygen-free copper detachable cabling.',
        pricePaise: 420000, // ₹4,200.00
        compareAtPricePaise: 550000,
        categoryId: catMap['refurbished-tech'],
        condition: 'refurbished',
        materials: ['Renewed Aluminum Housing', 'OFC Copper Wire', 'Bio-based Foam'],
        sustainabilitySpecs: {
          recycledPercentage: 85,
          materialsReused: ['Original Studio Drivers', 'Cast Alloy Gimbals'],
          repairabilityIndex: 10,
          packagingType: 'recycled_cardboard',
          weightGrams: 310,
          estimatedCo2SavedKg: 12.5,
          estimatedWasteDivertedKg: 0.9,
        },
        dimensions: { lengthCm: 18, widthCm: 9, heightCm: 20 },
        stockQuantity: 5,
        sku: 'RC-REF-HP-03',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800',
            publicId: 'seed_hp_1',
            isPrimary: true,
          },
        ],
        status: 'published',
        ratingsSummary: { averageRating: 5.0, reviewCount: 19 },
      },
      {
        title: 'Handmade Terrazzo Tray from Crushed Beverage Glass',
        slug: 'recycled-glass-terrazzo-serving-tray',
        description:
          'Cast using 70% post-consumer discarded glass collected from local restaurants, crushed into terrazzo aggregates, and bonded with zero-VOC eco-resin. Finished with natural organic beeswax.',
        pricePaise: 129900, // ₹1,299.00
        compareAtPricePaise: 169900,
        categoryId: catMap['upcycled-decor'],
        condition: 'recycled',
        materials: ['Crushed Beverage Glass', 'Non-Toxic Bio Resin', 'Natural Cork Bottom'],
        sustainabilitySpecs: {
          recycledPercentage: 90,
          materialsReused: ['Commercial Beverage Bottles'],
          repairabilityIndex: 7,
          packagingType: 'biodegradable',
          weightGrams: 1100,
          estimatedCo2SavedKg: 3.1,
          estimatedWasteDivertedKg: 1.8,
        },
        dimensions: { lengthCm: 30, widthCm: 20, heightCm: 3 },
        stockQuantity: 20,
        sku: 'RC-REC-TRAY-04',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=800',
            publicId: 'seed_tray_1',
            isPrimary: true,
          },
        ],
        status: 'published',
        ratingsSummary: { averageRating: 4.7, reviewCount: 29 },
      },
      {
        title: 'Solid Reclaimed Sal Wood Coffee Table',
        slug: 'reclaimed-sal-wood-coffee-table',
        description:
          'Built with salvaged railway sleeper timber. The ancient Sal wood has survived decades of heavy rail use, resulting in an indestructible, rich texture with deep natural patinas. Steel legs formed from scrap construction rebar.',
        pricePaise: 849900, // ₹8,499.00
        compareAtPricePaise: 1199900,
        categoryId: catMap['reclaimed-furniture'],
        condition: 'upcycled',
        materials: ['Reclaimed Railway Sleeper Sal Wood', 'Upcycled Steel Rebar', 'Linseed Oil Finish'],
        sustainabilitySpecs: {
          recycledPercentage: 95,
          materialsReused: ['Indian Railway Sleepers', 'Structural Construction Rebar'],
          repairabilityIndex: 10,
          packagingType: 'recycled_cardboard',
          weightGrams: 14500,
          estimatedCo2SavedKg: 28.4,
          estimatedWasteDivertedKg: 16.0,
        },
        dimensions: { lengthCm: 90, widthCm: 55, heightCm: 45 },
        stockQuantity: 3,
        sku: 'RC-UPC-TBL-05',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=800',
            publicId: 'seed_table_1',
            isPrimary: true,
          },
        ],
        status: 'published',
        ratingsSummary: { averageRating: 4.9, reviewCount: 14 },
      },
      {
        title: 'Zero Waste Starter Kit: Bamboo & Natural Loofah Set',
        slug: 'zero-waste-starter-kit-bamboo-loofah',
        description:
          'A thoughtful replacement for plastic kitchen and bathroom items: 4 organically harvested bamboo toothbrushes, 3 whole unbleached dried gourd loofahs, and a brass safety razor. 100% compostable and zero-plastic.',
        pricePaise: 89900, // ₹899.00
        compareAtPricePaise: 119900,
        categoryId: catMap['zero-waste'],
        condition: 'recycled',
        materials: ['Wild Moso Bamboo', 'Natural Plant Loofah', 'Cast Brass'],
        sustainabilitySpecs: {
          recycledPercentage: 100,
          materialsReused: ['Farm Harvest Loofah Vine Byproduct'],
          repairabilityIndex: 8,
          packagingType: 'zero_waste',
          weightGrams: 280,
          estimatedCo2SavedKg: 1.9,
          estimatedWasteDivertedKg: 0.6,
        },
        dimensions: { lengthCm: 20, widthCm: 15, heightCm: 5 },
        stockQuantity: 35,
        sku: 'RC-ZER-KIT-06',
        images: [
          {
            url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&q=80&w=800',
            publicId: 'seed_kit_1',
            isPrimary: true,
          },
        ],
        status: 'published',
        ratingsSummary: { averageRating: 4.8, reviewCount: 71 },
      },
    ];

    for (const prod of sampleProducts) {
      const exists = await Product.findOne({ slug: prod.slug });
      if (!exists) {
        await Product.create({
          ...prod,
          sellerId: sellerProfile._id,
        });
        logger.info(`Created product: ${prod.title}`);
      }
    }

    logger.info('Database seeding completed successfully.');
  } catch (error) {
    logger.error(`Seeding error: ${error.message}`);
  }
};

// If run directly via node command line
if (require.main === module) {
  seedDatabase().then(() => {
    logger.info('Seed process exited.');
    process.exit(0);
  });
}

module.exports = seedDatabase;
