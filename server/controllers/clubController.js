const Club = require('../models/Club');
const User = require('../models/User');

// @desc    Get all clubs
// @route   GET /api/clubs
// @access  Public
const getClubs = async (req, res) => {
  try {
    const clubs = await Club.find({}).populate('facultyCoordinator', 'name username');
    res.json(clubs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a club
// @route   POST /api/clubs
// @access  Admin
const createClub = async (req, res) => {
  const { 
    name, 
    description, 
    category, 
    mission, 
    vision, 
    facultyCoordinator, 
    establishedDate 
  } = req.body;

  try {
    // Check if club exists
    const clubExists = await Club.findOne({ name });

    if (clubExists) {
      return res.status(400).json({ message: 'Club already exists' });
    }

    // If faculty coordinator is provided, check if they exist and have faculty role
    if (facultyCoordinator) {
      const faculty = await User.findById(facultyCoordinator);
      
      if (!faculty) {
        return res.status(404).json({ message: 'Faculty not found' });
      }
      
      if (faculty.role !== 'faculty') {
        return res.status(400).json({ message: 'Assigned user is not a faculty member' });
      }
    }

    // Create club with all required fields
    const club = await Club.create({
      name,
      description,
      category,
      mission,
      vision,
      facultyCoordinator: facultyCoordinator || null,
      establishedDate
    });

    res.status(201).json(club);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a club
// @route   PUT /api/clubs/:id
// @access  Admin
const updateClub = async (req, res) => {
  const { 
    name, 
    description, 
    category, 
    mission, 
    vision, 
    facultyCoordinator, 
    establishedDate 
  } = req.body;

  try {
    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // If faculty coordinator is provided, check if they exist and have faculty role
    if (facultyCoordinator) {
      const faculty = await User.findById(facultyCoordinator);
      
      if (!faculty) {
        return res.status(404).json({ message: 'Faculty not found' });
      }
      
      if (faculty.role !== 'faculty') {
        return res.status(400).json({ message: 'Assigned user is not a faculty member' });
      }
    }

    club.name = name || club.name;
    club.description = description || club.description;
    club.category = category || club.category;
    club.mission = mission || club.mission;
    club.vision = vision || club.vision;
    club.facultyCoordinator = facultyCoordinator || club.facultyCoordinator;
    club.establishedDate = establishedDate || club.establishedDate;

    const updatedClub = await club.save();

    res.json(updatedClub);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a club
// @route   DELETE /api/clubs/:id
// @access  Admin
const deleteClub = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    await club.remove();

    res.json({ message: 'Club removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Assign faculty coordinator to a club
// @route   PUT /api/clubs/:id/assign-faculty
// @access  Admin
const assignFaculty = async (req, res) => {
  const { facultyId } = req.body;

  try {
    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const faculty = await User.findById(facultyId);

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    if (faculty.role !== 'faculty') {
      return res.status(400).json({ message: 'Assigned user is not a faculty member' });
    }

    club.facultyCoordinator = faculty._id;
    await club.save();

    res.json(club);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Remove faculty coordinator from a club
// @route   PUT /api/clubs/:id/remove-faculty
// @access  Admin
const removeFaculty = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    club.facultyCoordinator = null;
    await club.save();

    res.json(club);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getClubs,
  createClub,
  updateClub,
  deleteClub,
  assignFaculty,
  removeFaculty,
};