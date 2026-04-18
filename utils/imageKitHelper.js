const ImageKit = require('imagekit');
const dotenv = require('dotenv');
dotenv.config();

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const uploadToImageKit = async (fileBuffer, fileName) => {
    try {
        const response = await imagekit.upload({
            file: fileBuffer, // This will come from multer
            fileName: fileName,
            folder: '/rescrafted_products'
        });
        return response;
    } catch (error) {
        throw new Error("ImageKit Upload Failed: " + error.message);
    }
};

module.exports = { uploadToImageKit };