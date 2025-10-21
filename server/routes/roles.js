const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const User = require('../models/User');

// Map role names to user role values
const roleMapping = {
  'Admin': 'admin',
  'Faculty': 'faculty',
  'Club Leader': 'clubLeader',
  'Student': 'student'
};

// Get all roles
router.get('/', async (req, res) => {
  try {
    const roles = await Role.find().populate('permissions');
    
    // Calculate user count for each role
    for (const role of roles) {
      // Map the role name to the user role value
      const userRoleValue = roleMapping[role.name];
      if (userRoleValue) {
        role.userCount = await User.countDocuments({ role: userRoleValue });
        console.log(`Role: ${role.name} -> ${userRoleValue}, Count: ${role.userCount}`);
      } else {
        role.userCount = 0;
        console.log(`No mapping found for role: ${role.name}`);
      }
    }
    
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get a single role by ID
router.get('/:id', async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate('permissions');
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    // Map the role name to the user role value
    const userRoleValue = roleMapping[role.name];
    if (userRoleValue) {
      role.userCount = await User.countDocuments({ role: userRoleValue });
      console.log(`Role: ${role.name} -> ${userRoleValue}, Count: ${role.userCount}`);
    } else {
      role.userCount = 0;
      console.log(`No mapping found for role: ${role.name}`);
    }
    
    res.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new role
router.post('/', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const role = new Role({
      name,
      description,
      permissions
    });
    const newRole = await role.save();
    
    // Map the role name to the user role value
    const userRoleValue = roleMapping[newRole.name];
    if (userRoleValue) {
      newRole.userCount = await User.countDocuments({ role: userRoleValue });
    } else {
      newRole.userCount = 0;
    }
    
    res.status(201).json(newRole);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update a role
router.put('/:id', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const role = await Role.findByIdAndUpdate(
      req.params.id,
      { name, description, permissions },
      { new: true, runValidators: true }
    ).populate('permissions');
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    // Map the role name to the user role value
    const userRoleValue = roleMapping[role.name];
    if (userRoleValue) {
      role.userCount = await User.countDocuments({ role: userRoleValue });
    } else {
      role.userCount = 0;
    }
    
    res.json(role);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete a role
router.delete('/:id', async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;