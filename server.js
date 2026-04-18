const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

/* ========================
   ✅ MIDDLEWARE
======================== */
app.use(express.json());

// 🔥 CORS (IMPORTANT)
app.use(cors({
    origin: "https://rescrafted-frontend.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


/* ========================
   ✅ DATABASE CONNECTION
======================== */
const MONGO_URI = process.env.MONGODB_URL;

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => {
        console.error("❌ MongoDB Error:", err.message);
        process.exit(1);
    });


/* ========================
   ✅ ROUTES
======================== */

// Test route
app.get('/', (req, res) => {
    res.status(200).json({ message: "Rescrafted API running 🚀" });
});

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/users', require('./routes/userRoutes'));


/* ========================
   ❌ ERROR HANDLER
======================== */
app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});


/* ========================
   🚀 START SERVER
======================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});