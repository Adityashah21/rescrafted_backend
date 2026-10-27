const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const requestLogger = require('./middlewares/requestLogger');
const { apiLimiter } = require('./middlewares/rateLimiter');
const mongoSanitizer = require('./middlewares/mongoSanitize');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');

// Route imports
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const addressRoutes = require('./routes/addressRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const sellerDashboardRoutes = require('./routes/sellerDashboardRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const app = express();

// Trust reverse proxy headers from hosting platforms (Render, Cloudflare, etc.)
app.set('trust proxy', 1);

// Security HTTP Headers
app.use(helmet());

// Cross-Origin Resource Sharing (CORS) with explicit allowlist
const defaultOrigins = [
  'https://rescrafted-frontend.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

// Clean and normalize env.FRONTEND_URL if provided (support comma-separated origins)
const configuredFrontends = env.FRONTEND_URL
  ? env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/+$/, '')).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...configuredFrontends, ...defaultOrigins]));

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Server-to-server, curl, mobile
  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes(cleanOrigin)) return true;
  // Match any Vercel deployment for this project (production, preview branches, personal forks)
  if (/^https:\/\/rescrafted-frontend.*\.vercel\.app$/.test(cleanOrigin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        // Pass false so CORS headers are omitted without throwing a 500 error
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Set-Cookie']
  })
);

// Logging HTTP Requests
app.use(requestLogger);

// Body and Cookie Parsers
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// Sanitize inputs against NoSQL injection
app.use(mongoSanitizer);

// Root welcome probe
app.get('/', (req, res) => {
  res.json({
    name: 'ResCrafted 2.0 API',
    tagline: 'Give Waste a Second Life',
    status: 'online',
    version: '2.0.0',
    documentation: '/api/v1/health'
  });
});

// Apply rate limiting to all /api/v1 routes
app.use('/api/v1', apiLimiter);

// Mount versioned routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/seller', sellerDashboardRoutes);
app.use('/api/v1/admin', adminDashboardRoutes);
app.use('/api/v1/reviews', reviewRoutes);

// Catch 404
app.use(notFound);

// Centralized error handling
app.use(errorHandler);

module.exports = app;
