const express = require('express');
const router = express.Router();
const {
  getClubs,
  createClub,
  updateClub,
  deleteClub,
  assignFaculty,
  removeFaculty,
} = require('../controllers/clubController');
const adminAuth = require('../middleware/admin');

router.route('/').get(getClubs).post(adminAuth, createClub);
router.route('/:id').put(adminAuth, updateClub).delete(adminAuth, deleteClub);
router.route('/:id/assign-faculty').put(adminAuth, assignFaculty);
router.route('/:id/remove-faculty').put(adminAuth, removeFaculty);

module.exports = router;