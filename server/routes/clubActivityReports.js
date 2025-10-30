const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const ClubActivityReport = require('../models/ClubActivityReport');
const User = require('../models/User');
const Club = require('../models/Club');
const Event = require('../models/Event');

// Multer config for uploads (store in public/uploads/reports)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads/reports');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('application/') || file.mimetype.includes('sheet') || file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Excel, CSV allowed.'), false);
    }
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper functions to generate report data
async function generateUsersReport(dateFrom, dateTo, clubId) {
  const query = {
    createdAt: {
      $gte: new Date(dateFrom),
      $lte: new Date(dateTo)
    }
  };
  
  if (clubId) {
    query.club = clubId;
  }
  
  const users = await User.find(query)
    .populate('club', 'name')
    .select('name username email role createdAt');
  
  return users.map(user => ({
    Name: user.name,
    Username: user.username,
    Email: user.email,
    Role: user.role,
    Club: user.club ? user.club.name : 'N/A',
    'Join Date': user.createdAt.toLocaleDateString()
  }));
}

async function generateClubsReport(dateFrom, dateTo) {
  const clubs = await Club.find({
    createdAt: {
      $gte: new Date(dateFrom),
      $lte: new Date(dateTo)
    }
  })
    .populate('faculty', 'name email')
    .populate('leader', 'name email');
  
  return clubs.map(club => ({
    Name: club.name,
    Description: club.description,
    Faculty: club.faculty ? club.faculty.name : 'N/A',
    'Faculty Email': club.faculty ? club.faculty.email : 'N/A',
    Leader: club.leader ? club.leader.name : 'N/A',
    'Leader Email': club.leader ? club.leader.email : 'N/A',
    'Created Date': club.createdAt.toLocaleDateString(),
    Members: club.members ? club.members.length : 0
  }));
}

async function generateEventsReport(dateFrom, dateTo, clubId) {
  const query = {
    date: {
      $gte: new Date(dateFrom),
      $lte: new Date(dateTo)
    }
  };
  
  if (clubId) {
    query.clubId = clubId;
  }
  
  const events = await Event.find(query)
    .populate('clubId', 'name')
    .populate('organizer', 'name');
    // Removed .populate('registeredUsers.userId', 'name username email'); as it's not used (only length is needed)
  
  // SAFE FIX: Ensure registeredUsers is always an array
  events.forEach(event => {
    if (!event.registeredUsers || !Array.isArray(event.registeredUsers)) {
      event.registeredUsers = [];
    }
  });
  
  return events.map(event => ({
    Title: event.title || 'Untitled Event',
    Description: event.description || 'No description',
    Club: event.clubId ? event.clubId.name : 'N/A',
    Organizer: event.organizer ? event.organizer.name : 'N/A',
    Venue: event.venue || 'N/A',
    Date: event.date ? event.date.toLocaleDateString() : 'N/A',
    Time: event.time || 'N/A',
    Status: event.status || 'N/A',
    'Max Participants': event.maxParticipants || 0,
    'Registered Participants': (event.registeredUsers || []).length  // FIX: Null-coalesce to prevent undefined.length error
  }));
}

async function generateAttendanceReport(dateFrom, dateTo, clubId) {
  const query = {
    date: {
      $gte: new Date(dateFrom),
      $lte: new Date(dateTo)
    }
  };
  
  if (clubId) {
    query.clubId = clubId;
  }
  
  const events = await Event.find(query)
    .populate('clubId', 'name');
    // Removed .populate('registeredUsers.userId', ...); to avoid schema error; manual population below
  
  // SAFE FIX: Ensure registeredUsers is always an array
  events.forEach(event => {
    if (!event.registeredUsers || !Array.isArray(event.registeredUsers)) {
      event.registeredUsers = [];
    }
  });
  
  // Manual population for registeredUsers.userId to avoid strict populate error
  let allUserIds = new Set();
  events.forEach(event => {
    event.registeredUsers.forEach(registration => {
      if (registration.userId) {
        allUserIds.add(registration.userId.toString());
      }
    });
  });
  
  const users = await User.find({
    _id: { $in: Array.from(allUserIds) }
  }).select('name username email');
  
  const userMap = new Map(users.map(user => [user._id.toString(), user]));
  
  let attendanceData = [];
  
  events.forEach(event => {
    (event.registeredUsers || []).forEach(registration => {  // FIX: Null-coalesce to prevent undefined.forEach error
      const user = userMap.get(registration.userId ? registration.userId.toString() : null);
      attendanceData.push({
        'Event Name': event.title || 'Untitled Event',
        'Event Date': event.date ? event.date.toLocaleDateString() : 'N/A',
        Club: event.clubId ? event.clubId.name : 'N/A',
        'Participant Name': user ? user.name : 'Unknown',
        'Participant Email': user ? user.email : 'N/A',
        'Registration Date': registration.registeredAt ? new Date(registration.registeredAt).toLocaleDateString() : 'N/A',
        'Attendance Status': registration.attended ? 'Attended' : 'Not Attended'
      });
    });
  });
  
  return attendanceData;
}

async function generateActivityReport(dateFrom, dateTo, clubId) {
  const userCount = await User.countDocuments(clubId ? { club: clubId } : {});
  const clubCount = clubId ? 1 : await Club.countDocuments();
  const eventCount = await Event.countDocuments({
    date: {
      $gte: new Date(dateFrom),
      $lte: new Date(dateTo)
    },
    ...(clubId && { clubId })
  });

  return [
    {
      'Date': new Date(dateFrom).toLocaleDateString(),
      'Activity': 'System Activities Report',
      'Details': `Activities from ${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`,
      'User Count': userCount,
      'Club Count': clubCount,
      'Event Count': eventCount
    }
  ];
}

async function generateFeedbackReport(dateFrom, dateTo, clubId) {
  return [
    {
      'Date': new Date().toLocaleDateString(),
      'Feedback Type': 'Event Feedback',
      'Average Rating': '4.2/5',
      'Total Responses': '42',
      'Report Period': `${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`
    }
  ];
}

async function generateMembershipReport(dateFrom, dateTo, clubId) {
  const club = await Club.findById(clubId).populate('members._id', 'name email role joinDate');
  
  if (!club) {
    return {
      totalMembers: 0,
      activeMembers: 0,
      inactiveMembers: 0,
      membersByRole: {},
      membershipTrend: []
    };
  }
  
  const totalMembers = club.members ? club.members.length : 0;
  const activeMembers = club.members ? club.members.filter(m => m.status === 'active').length : 0;
  const inactiveMembers = club.members ? club.members.filter(m => m.status === 'inactive').length : 0;
  
  const membersByRole = {};
  if (club.members) {
    club.members.forEach(member => {
      const role = member.role || 'Member';
      membersByRole[role] = (membersByRole[role] || 0) + 1;
    });
  }
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const membershipTrend = months.map(month => ({
    month,
    count: Math.floor(Math.random() * 20) + 30
  }));
  
  return {
    totalMembers,
    activeMembers,
    inactiveMembers,
    membersByRole,
    membershipTrend
  };
}

async function generateFinancialReport(dateFrom, dateTo, clubId) {
  return {
    totalIncome: 2500,
    totalExpenses: 1800,
    netBalance: 700,
    incomeBySource: {
      'Membership Fees': 1000,
      'Event Tickets': 800,
      'Sponsorships': 700
    },
    expensesByCategory: {
      'Venue': 800,
      'Food': 500,
      'Materials': 300,
      'Marketing': 200
    }
  };
}

// Updated generateCSV function
async function generateCSV(filePath, data) {
  let csv;
  try {
    csv = require('csv-writer');
  } catch (e) {
    throw new Error('CSV generation not available');
  }
  
  return new Promise((resolve, reject) => {
    try {
      let csvContent;
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(header => {
            const cell = row[header] || '';
            return cell.toString().includes(',') ? `"${cell.toString().replace(/"/g, '""')}"` : cell;
          }).join(','))
        ].join('\n');
      } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        // Flatten object to simple key-value array (skip nested objects)
        const dataArray = [];
        Object.keys(data).forEach(key => {
          if (typeof data[key] !== 'object' || data[key] === null) {
            dataArray.push({ 
              Metric: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
              Value: data[key]
            });
          }
        });
        if (dataArray.length > 0) {
          const headers = Object.keys(dataArray[0]);
          csvContent = [
            headers.join(','),
            ...dataArray.map(row => headers.map(header => {
              const cell = row[header] || '';
              return cell.toString().includes(',') ? `"${cell.toString().replace(/"/g, '""')}"` : cell;
            }).join(','))
          ].join('\n');
        } else {
          csvContent = 'No data available';
        }
      } else {
        csvContent = 'No data available';
      }
      
      fs.writeFile(filePath, csvContent, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Updated generateExcel function
async function generateExcel(filePath, data) {
  let ExcelJS;
  try {
    ExcelJS = require('exceljs');
  } catch (e) {
    throw new Error('Excel generation not available');
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');
      
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        worksheet.addRow(headers);
        
        data.forEach(row => {
          const values = headers.map(header => row[header] || '');
          worksheet.addRow(values);
        });
      } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        // Flatten object to simple key-value array (skip nested objects)
        const dataArray = [];
        Object.keys(data).forEach(key => {
          if (typeof data[key] !== 'object' || data[key] === null) {
            dataArray.push({ 
              Metric: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
              Value: data[key]
            });
          }
        });
        
        if (dataArray.length > 0) {
          const headers = Object.keys(dataArray[0]);
          worksheet.addRow(headers);
          
          dataArray.forEach(row => {
            const values = headers.map(header => row[header] || '');
            worksheet.addRow(values);
          });
        } else {
          worksheet.addRow(['No data available']);
        }
      } else {
        worksheet.addRow(['No data available']);
      }
      
      // Apply styling (headers bold, gray fill, auto-width)
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      
      worksheet.columns.forEach(column => {
        if (column.header) {
          column.width = column.header.length < 15 ? 15 : column.header.length;
        }
      });
      
      await workbook.xlsx.writeFile(filePath);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function generatePDF(filePath, data, title) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch (e) {
    throw new Error('PDF generation not available');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      
      doc.pipe(stream);
      
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]);
        const tableWidth = 500;
        const cellWidth = tableWidth / headers.length;
        const cellHeight = 30;
        
        headers.forEach((header, i) => {
          doc
            .rect(50 + i * cellWidth, 100, cellWidth, cellHeight)
            .stroke();
          doc
            .fontSize(10)
            .text(header, 50 + i * cellWidth + 5, 110, {
              width: cellWidth - 10,
              align: 'center'
            });
        });
        
        data.forEach((row, rowIndex) => {
          const yPos = 100 + cellHeight * (rowIndex + 1);
          
          headers.forEach((header, colIndex) => {
            doc
              .rect(50 + colIndex * cellWidth, yPos, cellWidth, cellHeight)
              .stroke();
            doc
              .fontSize(8)
              .text(row[header] || '', 50 + colIndex * cellWidth + 5, yPos + 10, {
                width: cellWidth - 10,
                align: 'left'
              });
          });
        });
      } else if (data && typeof data === 'object') {
        const dataArray = [];
        
        Object.keys(data).forEach(key => {
          if (typeof data[key] !== 'object' || data[key] === null) {
            dataArray.push({ 
              'Metric': key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
              'Value': data[key]
            });
          }
        });
        
        if (dataArray.length > 0) {
          const headers = Object.keys(dataArray[0]);
          const tableWidth = 500;
          const cellWidth = tableWidth / headers.length;
          const cellHeight = 30;
          
          headers.forEach((header, i) => {
            doc
              .rect(50 + i * cellWidth, 100, cellWidth, cellHeight)
              .stroke();
            doc
              .fontSize(10)
              .text(header, 50 + i * cellWidth + 5, 110, {
                width: cellWidth - 10,
                align: 'center'
              });
          });
          
          dataArray.forEach((row, rowIndex) => {
            const yPos = 100 + cellHeight * (rowIndex + 1);
            
            headers.forEach((header, colIndex) => {
              doc
                .rect(50 + colIndex * cellWidth, yPos, cellWidth, cellHeight)
                .stroke();
              doc
                .fontSize(8)
                .text(row[header] || '', 50 + colIndex * cellWidth + 5, yPos + 10, {
                  width: cellWidth - 10,
                  align: 'left'
                });
            });
          });
        } else {
          doc.fontSize(12).text('No data available');
        }
      } else {
        doc.fontSize(12).text('No data available');
      }
      
      doc.end();
      
      stream.on('finish', () => {
        console.log('PDF file stream finished');
        resolve();
      });
      
      stream.on('error', (error) => {
        console.error('PDF file stream error:', error);
        reject(error);
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      reject(error);
    }
  });
}

// @desc    Get all club-submitted reports (for admin/faculty review)
// @route   GET /api/club-reports
// @access  Private (Admin, Faculty)
router.get('/club-reports', protect, authorize('admin,faculty'), async (req, res) => {
  try {
    const { page = 1, limit = 10, club, status, type, date } = req.query;
    const user = await User.findById(req.user.id);
    
    // Build query
    const query = {};
    if (club && club !== 'all') query.club = club;
    if (status && status !== 'all') query.status = status;
    if (type && type !== 'all') query.type = type;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setMonth(endDate.getMonth() + 1);
      query.submittedDate = { $gte: startDate, $lt: endDate };
    }
    
    // Faculty filter: only their monitored clubs
    if (user.systemRole === 'faculty') {
      const facultyClubs = await Club.find({ faculty: user._id });
      const clubIds = facultyClubs.map(c => c._id);
      query.club = { $in: clubIds };
    }
    
    const skip = (page - 1) * limit;
    const reports = await ClubActivityReport.find(query)
      .populate('club', 'name')
      .populate('submittedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ submittedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await ClubActivityReport.countDocuments(query);
    
    res.json({
      reports,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching club reports:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Generate a new club activity report
// @route   POST /api/clubactivityreports/generate
// @access  Private (Club Leader, Admin, Faculty)
router.post('/generate', protect, authorize('clubLeader,admin,faculty'), async (req, res) => {
  try {
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    if (!req.body) {
      return res.status(400).json({ message: 'Request body is missing or invalid' });
    }
    
    const { type, name, dateFrom, dateTo, format, parameters, clubId } = req.body;
    
    if (!type) {
      return res.status(400).json({ message: 'Report type is required' });
    }
    if (!name) {
      return res.status(400).json({ message: 'Report name is required' });
    }
    if (!dateFrom) {
      return res.status(400).json({ message: 'Date from is required' });
    }
    if (!dateTo) {
      return res.status(400).json({ message: 'Date to is required' });
    }
    if (!format) {
      return res.status(400).json({ message: 'Report format is required' });
    }
    if (!clubId) {
      return res.status(400).json({ message: 'Club ID is required' });
    }
    
    // Check optional dependencies (warn but don't fail early)
    let csv, ExcelJS, PDFDocument;
    try { csv = require('csv-writer'); } catch (e) { console.warn('csv-writer module not found, CSV generation will be disabled'); }
    try { ExcelJS = require('exceljs'); } catch (e) { console.warn('exceljs module not found, Excel generation will be disabled'); }
    try { PDFDocument = require('pdfkit'); } catch (e) { console.warn('pdfkit module not found, PDF generation will be disabled'); }
    
    if (format === 'csv' && !csv) {
      return res.status(500).json({ message: 'CSV generation not available. Please install csv-writer package.' });
    }
    
    if (format === 'excel' && !ExcelJS) {
      return res.status(500).json({ message: 'Excel generation not available. Please install exceljs package.' });
    }
    
    if (format === 'pdf' && !PDFDocument) {
      return res.status(500).json({ message: 'PDF generation not available. Please install pdfkit package.' });
    }
    
    const reportsDir = path.join(__dirname, '../public/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      console.log('Created reports directory:', reportsDir);
    }
    
    const sanitizedName = name.replace(/[\/\\:*?"<>|]/g, '_');
    const timestamp = Date.now();
    const fileName = `${sanitizedName}_${timestamp}.${format}`;
    const filePath = path.join(reportsDir, fileName);
    const fileUrl = `/reports/${fileName}`;
    
    console.log('Generating report file:', filePath);
    
    let data = [];
    
    switch (type) {
      case 'users':
        console.log('Generating users report...');
        data = await generateUsersReport(dateFrom, dateTo, clubId);
        console.log(`Generated data for ${data.length} users`);
        break;
      case 'clubs':
        console.log('Generating clubs report...');
        data = await generateClubsReport(dateFrom, dateTo);
        console.log(`Generated data for ${data.length} clubs`);
        break;
      case 'events':
        console.log('Generating events report...');
        data = await generateEventsReport(dateFrom, dateTo, clubId);
        console.log(`Generated data for ${data.length} events`);
        break;
      case 'attendance':
        console.log('Generating attendance report...');
        data = await generateAttendanceReport(dateFrom, dateTo, clubId);
        console.log(`Generated data for ${data.length} attendance records`);
        break;
      case 'activity':
        console.log('Generating activity report...');
        data = await generateActivityReport(dateFrom, dateTo, clubId);
        console.log('Generated activity data');
        break;
      case 'feedback':
        console.log('Generating feedback report...');
        data = await generateFeedbackReport(dateFrom, dateTo, clubId);
        console.log('Generated feedback data');
        break;
      case 'membership':
        console.log('Generating membership report...');
        data = await generateMembershipReport(dateFrom, dateTo, clubId);
        console.log('Generated membership data');
        break;
      case 'financial':
        console.log('Generating financial report...');
        data = await generateFinancialReport(dateFrom, dateTo, clubId);
        console.log('Generated financial data');
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
    
    console.log('Data type:', Array.isArray(data) ? 'array' : typeof data);
    
    let fileSize = 'Unknown';
    
    try {
      console.log(`Generating ${format} file...`);
      if (format === 'csv') {
        await generateCSV(filePath, data);
        const stats = fs.statSync(filePath);
        fileSize = formatFileSize(stats.size);
        console.log(`CSV file generated successfully. Size: ${fileSize}`);
      } else if (format === 'excel') {
        await generateExcel(filePath, data);
        const stats = fs.statSync(filePath);
        fileSize = formatFileSize(stats.size);
        console.log(`Excel file generated successfully. Size: ${fileSize}`);
      } else if (format === 'pdf') {
        await generatePDF(filePath, data, name);
        const stats = fs.statSync(filePath);
        fileSize = formatFileSize(stats.size);
        console.log(`PDF file generated successfully. Size: ${fileSize}`);
      }
    } catch (fileError) {
      console.error('Error generating file:', fileError);
      return res.status(500).json({ message: 'Error generating report file', error: fileError.message });
    }
    
    let clubActivityReportType;
    switch (type) {
      case 'users':
      case 'clubs':
      case 'events':
      case 'attendance':
      case 'activity':
      case 'feedback':
      case 'membership':
        clubActivityReportType = 'monthly';
        break;
      case 'financial':
        clubActivityReportType = 'financial';
        break;
      default:
        clubActivityReportType = 'monthly';
    }
    
    try {
      console.log('Saving report to database...');
      const report = await ClubActivityReport.create({
        title: name,
        description: `Generated ${type} report for the period ${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`,
        club: clubId,
        type: clubActivityReportType,
        submittedBy: req.user.id,
        status: 'approved', // Auto-approved for generated reports
        content: JSON.stringify(data),
        attachments: [{
          filename: fileName,
          path: fileUrl,
          mimetype: format === 'pdf' ? 'application/pdf' : 
                   format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                   'text/csv',
          size: fs.statSync(filePath).size
        }]
      });
      
      console.log('Report saved to database successfully:', report);
      res.status(201).json(report);
    } catch (dbError) {
      console.error('Error saving report to database:', dbError);
      
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Deleted file after database error');
        }
      } catch (deleteError) {
        console.error('Error deleting file after database error:', deleteError);
      }
      
      return res.status(500).json({ message: 'Error saving report to database', error: dbError.message });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Upload a new club activity report
// @route   POST /api/clubactivityreports/upload
// @access  Private (Club Leader, Admin, Faculty)
router.post('/upload', protect, authorize('clubLeader,admin,faculty'), upload.single('file'), async (req, res) => {
  try {
    const { title, description, type } = req.body;
    const clubId = req.body.club; // From frontend (club leader's club)
    
    if (!title || !type || !clubId || !req.file) {
      return res.status(400).json({ message: 'Missing required fields: title, type, club, or file' });
    }
    
    // Validate club exists and user has access
    const club = await Club.findById(clubId);
    if (!club || (req.user.club && req.user.club.toString() !== clubId.toString())) {
      return res.status(403).json({ message: 'Not authorized for this club' });
    }
    
    // Save to ClubActivityReport (unified with generated reports)
    const report = await ClubActivityReport.create({
      title,
      description: description || `Uploaded ${type} report`,
      club: clubId,
      type, // e.g., 'event', 'monthly'
      submittedBy: req.user.id,
      status: 'pending', // Starts as pending for faculty review
      attachments: [{
        filename: req.file.filename,
        path: `/uploads/reports/${req.file.filename}`, // Public URL
        mimetype: req.file.mimetype,
        size: req.file.size
      }]
    });
    
    // Populate for response
    await report.populate('club submittedBy');
    
    res.status(201).json(report);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Approve a report
// @route   PUT /api/clubactivityreports/:id/approve
// @access  Private (Faculty, Admin)
router.put('/:id/approve', protect, authorize('faculty,admin'), async (req, res) => {
  try {
    const report = await ClubActivityReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    
    // Check if faculty monitors the club
    const user = await User.findById(req.user.id);
    if (user.systemRole === 'faculty') {
      const facultyClubs = await Club.find({ faculty: user._id });
      const clubIds = facultyClubs.map(c => c._id.toString());
      if (!clubIds.includes(report.club.toString())) {
        return res.status(403).json({ message: 'Not authorized for this club' });
      }
    }
    
    report.status = 'approved';
    report.approvedBy = req.user.id;
    report.approvedDate = new Date();
    await report.save();
    
    await report.populate('approvedBy', 'name');
    res.json(report);
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Reject a report
// @route   PUT /api/clubactivityreports/:id/reject
// @access  Private (Faculty, Admin)
router.put('/:id/reject', protect, authorize('faculty,admin'), async (req, res) => {
  try {
    const report = await ClubActivityReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    
    // Check if faculty monitors the club
    const user = await User.findById(req.user.id);
    if (user.systemRole === 'faculty') {
      const facultyClubs = await Club.find({ faculty: user._id });
      const clubIds = facultyClubs.map(c => c._id.toString());
      if (!clubIds.includes(report.club.toString())) {
        return res.status(403).json({ message: 'Not authorized for this club' });
      }
    }
    
    report.status = 'rejected';
    report.approvedBy = req.user.id; // Who rejected
    report.approvedDate = new Date();
    await report.save();
    
    await report.populate('approvedBy', 'name');
    res.json(report);
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get reports for a specific club
// @route   GET /api/clubactivityreports/club/:clubId
// @access  Private (Club Leader, Faculty, Admin)
router.get('/club/:clubId', protect, async (req, res) => {
  try {
    const { clubId } = req.params;
    
    console.log(`[DEBUG] Fetching reports for clubId: ${clubId} by user: ${req.user.id}`);
    
    const user = await User.findById(req.user.id).populate('club clubs');  // Ensure populated for safety
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    console.log(`[DEBUG] User role: ${user.systemRole}, club: ${JSON.stringify(user.club)}, clubs: ${JSON.stringify(user.clubs)}`);
    
    // FIXED: Robustly extract club IDs (handle string/ObjectId/object or array)
    let userClubIds = [];
    
    // Handle single 'club'
    if (user.club) {
      const singleClubId = typeof user.club === 'object' 
        ? (user.club._id || user.club)  // Populated object or raw
        : user.club;
      if (singleClubId) {
        userClubIds.push(singleClubId.toString());
      }
    }
    
    // Handle 'clubs' array (fallback/multi-club support)
    if (user.clubs && Array.isArray(user.clubs)) {
      user.clubs.forEach(club => {
        const clubIdStr = typeof club === 'object' 
          ? (club._id || club) 
          : club;
        if (clubIdStr) {
          userClubIds.push(clubIdStr.toString());
        }
      });
    }
    
    userClubIds = [...new Set(userClubIds)];  // Dedupe
    
    const hasPermission = 
      user.systemRole === 'admin' || 
      user.systemRole === 'faculty' ||
      userClubIds.includes(clubId);
    
    console.log(`[DEBUG] Extracted userClubIds: ${userClubIds}, hasPermission: ${hasPermission}`);
    
    if (!hasPermission) {
      return res.status(403).json({ message: 'Not authorized to view these reports' });
    }
    
    const reports = await ClubActivityReport.find({ 
      club: clubId 
    })
    .populate('club', 'name')
    .populate('submittedBy', 'name')
    .populate('approvedBy', 'name')
    .sort({ submittedDate: -1 });
    
    console.log(`[DEBUG] Fetched ${reports.length} reports for club ${clubId}`);
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching club reports:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Download a report attachment
// @route   GET /api/clubactivityreports/:id/attachment
// @access  Private
router.get('/:id/attachment', protect, async (req, res) => {
  try {
    let token;
    
    if (req.query.token) {
      token = req.query.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    
    const report = await ClubActivityReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    if (user.systemRole !== 'admin' && 
        report.submittedBy.toString() !== user.id &&
        (!user.club || report.club.toString() !== user.club.toString())) {
      return res.status(403).json({ message: 'Not authorized to download this report' });
    }
    
    if (!report.attachments || report.attachments.length === 0) {
      return res.status(404).json({ message: 'No attachments found for this report' });
    }
    
    const attachment = report.attachments[0];
    const filePath = path.join(__dirname, '../public', attachment.path);
    
    console.log('Attempting to download file from:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ message: 'Report file not found on server' });
    }
    
    const stats = fs.statSync(filePath);
    
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    let contentType = 'application/octet-stream';
    if (attachment.mimetype) {
      contentType = attachment.mimetype;
    } else {
      const ext = path.extname(attachment.filename).toLowerCase();
      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.xlsx':
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case '.xls':
          contentType = 'application/vnd.ms-excel';
          break;
        case '.csv':
          contentType = 'text/csv';
          break;
      }
    }
    
    res.setHeader('Content-Type', contentType);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      res.status(500).json({ message: 'Error streaming file' });
    });
    
  } catch (error) {
    console.error('Error downloading report attachment:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Download a report
// @route   GET /api/clubactivityreports/:id/download
// @access  Private
router.get('/:id/download', async (req, res) => {
  try {
    let token;
    
    if (req.query.token) {
      token = req.query.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    
    const report = await ClubActivityReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    if (user.systemRole !== 'admin' && 
        report.submittedBy.toString() !== user.id &&
        (!user.club || report.club.toString() !== user.club.toString())) {
      return res.status(403).json({ message: 'Not authorized to download this report' });
    }
    
    if (!report.attachments || report.attachments.length === 0) {
      return res.status(404).json({ message: 'No attachments found for this report' });
    }
    
    const attachment = report.attachments[0];
    const filePath = path.join(__dirname, '../public', attachment.path);
    
    console.log('Attempting to download file from:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ message: 'Report file not found on server' });
    }
    
    const stats = fs.statSync(filePath);
    
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    let contentType = 'application/octet-stream';
    if (attachment.mimetype) {
      contentType = attachment.mimetype;
    } else {
      const ext = path.extname(attachment.filename).toLowerCase();
      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.xlsx':
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case '.xls':
          contentType = 'application/vnd.ms-excel';
          break;
        case '.csv':
          contentType = 'text/csv';
          break;
      }
    }
    
    res.setHeader('Content-Type', contentType);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      res.status(500).json({ message: 'Error streaming file' });
    });
    
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Delete a report
// @route   DELETE /api/clubactivityreports/:id
// @access  Private (Owner or Admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const report = await ClubActivityReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Authorization: owner or admin
    if (report.submittedBy.toString() !== req.user.id && req.user.systemRole !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this report' });
    }

    // Delete file if exists
    if (report.attachments && report.attachments.length > 0) {
      const filePath = path.join(__dirname, '../public', report.attachments[0].path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await report.remove();
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;