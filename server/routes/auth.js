const express = require('express');
const router = express.Router();
const { 
  login, 
  getMe, 
  changePassword, 
  createTestUser, 
  resetPassword,
  resetSpecificPassword,
  testSimplePassword,
  debugStudentUser,
  checkStudentRoles,
  comprehensiveDebug,
  fixPassword,
  verifyFixAdmin,
  debugLogin,
  debugPassword,
  fixPasswordHash
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', login);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, getMe);

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', protect, changePassword);

// @route   POST /api/auth/create-test-user
// @desc    Create a test user
// @access  Public
router.post('/create-test-user', createTestUser);

// @route   POST /api/auth/reset-password
// @desc    Reset user password
// @access  Public
router.post('/reset-password', resetPassword);

// @route   POST /api/auth/reset-specific-password
// @desc    Reset specific user password
// @access  Public
router.post('/reset-specific-password', resetSpecificPassword);

// @route   POST /api/auth/test-simple-password
// @desc    Test simple password
// @access  Public
router.post('/test-simple-password', testSimplePassword);

// @route   GET /api/auth/debug-student
// @desc    Debug student user
// @access  Public
router.get('/debug-student', debugStudentUser);

// @route   GET /api/auth/check-student-roles
// @desc    Check student roles
// @access  Public
router.get('/check-student-roles', checkStudentRoles);

// @route   POST /api/auth/comprehensive-debug
// @desc    Comprehensive password debug
// @access  Public
router.post('/comprehensive-debug', comprehensiveDebug);

// @route   POST /api/auth/fix-password
// @desc    Fix user password hash
// @access  Public
router.post('/fix-password', fixPassword);

// @route   POST /api/auth/verify-fix-admin
// @desc    Verify and fix admin account
// @access  Public
router.post('/verify-fix-admin', verifyFixAdmin);

// @route   POST /api/auth/debug-login
// @desc    Debug login
// @access  Public
router.post('/debug-login', debugLogin);

// @route   POST /api/auth/debug-password
// @desc    Debug password hash
// @access  Public
router.post('/debug-password', debugPassword);

// @route   POST /api/auth/fix-password-hash
// @desc    Fix password hash
// @access  Public
router.post('/fix-password-hash', fixPasswordHash);

module.exports = router;