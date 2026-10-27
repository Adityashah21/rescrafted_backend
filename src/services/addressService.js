const Address = require('../models/Address');
const AppError = require('../utils/AppError');

class AddressService {
  async getAddresses(userId) {
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    return addresses;
  }

  async getAddressById(userId, addressId) {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      throw new AppError('Delivery address not found.', 404, 'ADDRESS_NOT_FOUND');
    }
    return address;
  }

  async createAddress(userId, addressData) {
    const count = await Address.countDocuments({ userId });

    // If first address, automatically make it default
    const isDefault = count === 0 ? true : Boolean(addressData.isDefault);

    const address = await Address.create({
      ...addressData,
      userId,
      isDefault,
    });

    return address;
  }

  async updateAddress(userId, addressId, addressData) {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');
    }

    Object.assign(address, addressData);
    await address.save();

    return address;
  }

  async deleteAddress(userId, addressId) {
    const address = await Address.findOneAndDelete({ _id: addressId, userId });
    if (!address) {
      throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');
    }

    // If we deleted the default address, promote the latest remaining one
    if (address.isDefault) {
      const remaining = await Address.findOne({ userId }).sort({ createdAt: -1 });
      if (remaining) {
        remaining.isDefault = true;
        await remaining.save();
      }
    }

    return { message: 'Address deleted successfully.' };
  }

  async setDefaultAddress(userId, addressId) {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');
    }

    address.isDefault = true;
    await address.save();

    return address;
  }
}

const addressService = new AddressService();

module.exports = addressService;
