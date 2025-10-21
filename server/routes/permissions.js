const express = require('express');
const router = express.Router();
const Permission = require('../models/Permission');

// Get all permissions
router.get('/', async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;