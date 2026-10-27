const express = require('express');
const addressController = require('../controllers/addressController');
const authenticate = require('../middlewares/authenticate');
const validateRequest = require('../middlewares/validateRequest');
const {
  createAddressSchema,
  updateAddressSchema,
} = require('../validators/shoppingValidators');

const router = express.Router();

router.use(authenticate);

router.get('/', addressController.getAddresses);
router.get('/:id', addressController.getAddress);
router.post('/', validateRequest(createAddressSchema), addressController.createAddress);
router.patch('/:id', validateRequest(updateAddressSchema), addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.patch('/:id/set-default', addressController.setDefaultAddress);

module.exports = router;
