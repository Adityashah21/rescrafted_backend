const addressService = require('../services/addressService');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await addressService.getAddresses(req.user._id);
  return sendSuccess(res, 200, 'Addresses retrieved successfully.', addresses);
});

const getAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const address = await addressService.getAddressById(req.user._id, id);
  return sendSuccess(res, 200, 'Address details retrieved.', address);
});

const createAddress = asyncHandler(async (req, res) => {
  const address = await addressService.createAddress(req.user._id, req.body);
  return sendSuccess(res, 201, 'Address added successfully.', address);
});

const updateAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const address = await addressService.updateAddress(req.user._id, id, req.body);
  return sendSuccess(res, 200, 'Address updated successfully.', address);
});

const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await addressService.deleteAddress(req.user._id, id);
  return sendSuccess(res, 200, result.message);
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const address = await addressService.setDefaultAddress(req.user._id, id);
  return sendSuccess(res, 200, 'Default address updated.', address);
});

module.exports = {
  getAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
