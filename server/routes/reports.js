const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const ClubActivityReport = require('../models/ClubActivityReport');
const User = require('../models/User');
const Club = require('../models/Club');
const Event = require('../models/Event');
const fs = require('fs');
const path = require('path');

// Try to import optional dependencies
let csv, ExcelJS, PDFDocument;
try {
  csv = require('csv-writer');
} catch (e) {
  console.warn('csv-writer module not found, CSV generation will be disabled');
}

try {
  ExcelJS = require('exceljs');
} catch (e) {
  console.warn('exceljs module not found, Excel generation will be disabled');
}

try {
  PDFDocument = require('pdfkit');
} catch (e) {
  console.warn('pdfkit module not found, PDF generation will be disabled');
}

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
    Members: club.members.length
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
  
  return events.map(event => ({
    Title: event.title,
    Description: event.description,
    Club: event.clubId ? event.clubId.name : 'N/A',
    Organizer: event.organizer ? event.organizer.name : 'N/A',
    Venue: event.venue,
    Date: event.date.toLocaleDateString(),
    Time: event.time,
    Status: event.status,
    'Max Participants': event.maxParticipants,
    'Registered Participants': event.registeredUsers.length
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
    .populate('clubId', 'name')
    .populate('registeredUsers.userId', 'name username email');
  
  let attendanceData = [];
  
  events.forEach(event => {
    event.registeredUsers.forEach(registration => {
      attendanceData.push({
        'Event Name': event.title,
        'Event Date': event.date.toLocaleDateString(),
        Club: event.clubId ? event.clubId.name : 'N/A',
        'Participant Name': registration.userId.name,
        'Participant Email': registration.userId.email,
        'Registration Date': new Date(registration.registeredAt).toLocaleDateString(),
        'Attendance Status': registration.attended ? 'Attended' : 'Not Attended'
      });
    });
  });
  
  return attendanceData;
}

async function generateActivityReport(dateFrom, dateTo, clubId) {
  return [
    {
      'Date': new Date(dateFrom).toLocaleDateString(),
      'Activity': 'System Activities Report',
      'Details': `Activities from ${new Date(dateFrom).toLocaleDateString()} to ${new Date(dateTo).toLocaleDateString()}`,
      'User Count': await User.countDocuments(clubId ? { club: clubId } : {}),
      'Club Count': clubId ? 1 : await Club.countDocuments(),
      'Event Count': await Event.countDocuments({
        date: {
          $gte: new Date(dateFrom),
          $lte: new Date(dateTo)
        },
        ...(clubId && { clubId })
      })
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
    return [];
  }
  
  const totalMembers = club.members.length;
  const activeMembers = club.members.filter(m => m.status === 'active').length;
  const inactiveMembers = club.members.filter(m => m.status === 'inactive').length;
  
  const membersByRole = {};
  club.members.forEach(member => {
    const role = member.role || 'Member';
    membersByRole[role] = (membersByRole[role] || 0) + 1;
  });
  
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

// Helper functions to generate files in different formats
async function generateCSV(filePath, data) {
  if (!csv) {
    throw new Error('CSV generation not available');
  }
  
  return new Promise((resolve, reject) => {
    try {
      if (data.length === 0) {
        fs.writeFileSync(filePath, 'No data available');
        resolve();
        return;
      }
      
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
          const cell = row[header] || '';
          return cell.toString().includes(',') ? `"${cell.toString().replace(/"/g, '""')}"` : cell;
        }).join(','))
      ].join('\n');
      
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

async function generateExcel(filePath, data) {
  if (!ExcelJS) {
    throw new Error('Excel generation not available');
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');
      
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        worksheet.addRow(headers);
        
        data.forEach(row => {
          const values = headers.map(header => row[header] || '');
          worksheet.addRow(values);
        });
        
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
      } else {
        worksheet.addRow(['No data available']);
      }
      
      await workbook.xlsx.writeFile(filePath);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function generatePDF(filePath, data, title) {
  if (!PDFDocument) {
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
        
        if (data.totalMembers !== undefined || data.totalEvents !== undefined) {
          Object.keys(data).forEach(key => {
            if (typeof data[key] !== 'object' || data[key] === null) {
              dataArray.push({ 
                'Metric': key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
                'Value': data[key]
              });
            }
          });
        }
        
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
router.get('/club-reports', protect, async (req, res) => {
  try {
    // Manual authorization check since authorize middleware isn't imported
    const user = await User.findById(req.user.id);
    if (user.systemRole !== 'admin' && user.systemRole !== 'faculty') {
      return res.status(403).json({ message: 'Not authorized to view club reports' });
    }

    const { page = 1, limit = 10, club, status, type, date } = req.query;
    
    // Build query
    const query = {};
    
    if (club && club !== 'all') {
      query.club = club;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setMonth(endDate.getMonth() + 1);
      
      query.submittedDate = {
        $gte: startDate,
        $lt: endDate
      };
    }
    
    // For faculty: Only show reports from clubs this faculty monitors
    if (user.systemRole === 'faculty') {
      const facultyClubs = await Club.find({ faculty: user._id });
      const clubIds = facultyClubs.map(c => c._id);
      query.club = { $in: clubIds };
    }
    // For admin: No additional filter (sees all)
    
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
// @access  Private (Admin, Faculty, Club Leader)
router.post('/generate', protect, async (req, res) => {
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
        status: 'approved',
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

// @desc    Get reports for a specific club
// @route   GET /api/clubactivityreports/club/:clubId
// @access  Private (Club Leader, Faculty, Admin)
router.get('/club/:clubId', protect, async (req, res) => {
  try {
    const { clubId } = req.params;
    
    const user = await User.findById(req.user.id);
    const hasPermission = 
      user.systemRole === 'admin' || 
      user.systemRole === 'faculty' ||
      (user.club && user.club.toString() === clubId);
    
    if (!hasPermission) {
      return res.status(403).json({ message: 'Not authorized to view these reports' });
    }
    
    const reports = await ClubActivityReport.find({ 
      club: clubId 
    })
    .populate('submittedBy', 'name')
    .populate('approvedBy', 'name')
    .sort({ submittedDate: -1 });
    
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

module.exports = router;