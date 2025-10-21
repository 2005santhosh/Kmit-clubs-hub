const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use public directory so files are accessible via URL
        const uploadDir = path.join(__dirname, '../public/uploads/events');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('Created directory:', uploadDir);
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'event-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            return cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'), false);
        }
        cb(null, true);
    }
});

// Upload event image
router.post('/event-image', protect, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        console.log('File uploaded successfully:', req.file);
        
        // The URL should be accessible from the frontend
        const fileUrl = `/uploads/events/${req.file.filename}`;
        
        console.log('File URL:', fileUrl);
        
        res.json({ 
            success: true, 
            url: fileUrl,
            filename: req.file.filename,
            message: 'Image uploaded successfully' 
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
});

// Test endpoint to check if upload directory exists
router.get('/check-upload-dir', protect, (req, res) => {
    const uploadDir = path.join(__dirname, '../public/uploads/events');
    const exists = fs.existsSync(uploadDir);
    
    res.json({
        directory: uploadDir,
        exists: exists,
        writable: exists ? fs.accessSync(uploadDir, fs.constants.W_OK) : false
    });
});

module.exports = router;