const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const ClubActivityReport = require('../models/ClubActivityReport');

const router = express.Router();

// Configure multer for report file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use public directory so files are accessible via URL
        const uploadDir = path.join(__dirname, '../public/uploads/reports');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('Created reports directory:', uploadDir);
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'report-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for reports
    },
    fileFilter: function (req, file, cb) {
        // Accept common report file formats
        if (!file.originalname.match(/\.(pdf|doc|docx|xls|xlsx|csv|ppt|pptx)$/i)) {
            return cb(new Error('Only report files (PDF, DOC, DOCX, XLS, XLSX, CSV, PPT, PPTX) are allowed!'), false);
        }
        cb(null, true);
    }
});

// Upload report file
router.post('/report', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { title, description, type, club } = req.body;

        if (!title || !type || !club) {
            // Clean up the uploaded file if validation fails
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                success: false, 
                message: 'Title, type, and club are required' 
            });
        }

        console.log('File uploaded successfully:', req.file);
        
        // The URL should be accessible from the frontend
        const fileUrl = `/uploads/reports/${req.file.filename}`;
        
        // Create a new club activity report
        const newReport = new ClubActivityReport({
            title,
            description: description || '',
            club,
            type,
            submittedBy: req.user.id,
            submittedDate: new Date(),
            status: 'pending',
            content: `Uploaded report: ${req.file.originalname}`,
            attachments: [{
                filename: req.file.originalname,
                path: fileUrl,
                mimetype: req.file.mimetype,
                size: req.file.size
            }]
        });

        const savedReport = await newReport.save();
        
        // Populate the report with user and club details
        const populatedReport = await ClubActivityReport.findById(savedReport._id)
            .populate('club', 'name')
            .populate('submittedBy', 'name');
        
        console.log('Report saved to database successfully:', populatedReport);
        
        res.status(201).json({ 
            success: true, 
            report: populatedReport,
            message: 'Report uploaded successfully' 
        });
    } catch (error) {
        console.error('Error uploading report:', error);
        
        // Clean up the uploaded file if an error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload report',
            error: error.message 
        });
    }
});

// Test endpoint to check if upload directory exists
router.get('/check-reports-dir', protect, (req, res) => {
    const uploadDir = path.join(__dirname, '../public/uploads/reports');
    const exists = fs.existsSync(uploadDir);
    
    res.json({
        directory: uploadDir,
        exists: exists,
        writable: exists ? fs.accessSync(uploadDir, fs.constants.W_OK) : false
    });
});

module.exports = router;