const User = require('../models/User');

class UserRepository {
  async findById(id) {
    return await User.findById(id).populate('role').populate('subscription');
  }

  async findByUsername(username) {
    return await User.findOne({ username }).populate('role');
  }

  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  async update(id, updateData) {
    return await User.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id) {
    return await User.findByIdAndDelete(id);
  }

  async findAll() {
    return await User.find().populate('role').populate('subscription');
  }
}

module.exports = new UserRepository();