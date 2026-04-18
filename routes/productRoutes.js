const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const { getProducts, createProduct, getUserProducts, deleteProduct } = require('../controllers/productController');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (isValid) cb(null, true);
        else cb(new Error('Only image files are allowed.'));
    }
});

router.get('/', getProducts);
router.get('/user/:userId', protect, getUserProducts);
router.post('/', protect, upload.single('image'), createProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;