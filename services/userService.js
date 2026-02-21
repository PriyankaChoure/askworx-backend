const userRepository = require('../repositories/userRepository');

class UserService {
  async getUserById(id) {
    return await userRepository.findById(id);
  }

  async getUserByUsername(username) {
    return await userRepository.findByUsername(username);
  }

  async createUser(userData) {
    return await userRepository.create(userData);
  }

  async updateUser(id, updateData) {
    return await userRepository.update(id, updateData);
  }

  async deleteUser(id) {
    return await userRepository.delete(id);
  }

  async getAllUsers() {
    return await userRepository.findAll();
  }
}

module.exports = new UserService();