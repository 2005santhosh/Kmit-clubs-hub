const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Club = require('../models/Club');
const Event = require('../models/Event');

// @desc    Get analytics data
// @route   GET /api/analytics
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo, clubId } = req.query;
    
    // Parse date filters
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const endDate = dateTo ? new Date(dateTo) : new Date();
    
    // Set end time to end of day
    endDate.setHours(23, 59, 59, 999);
    
    console.log(`Fetching analytics from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get overall stats
    const totalUsers = await User.countDocuments();
    const totalClubs = await Club.countDocuments();
    const totalEvents = await Event.countDocuments({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    // Calculate average attendance
    const events = await Event.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    let totalAttendance = 0;
    let totalCapacity = 0;
    let attendedEvents = 0;
    
    events.forEach(event => {
      if (event.registeredParticipants && event.registeredParticipants.length > 0) {
        attendedEvents++;
        const attended = event.registeredParticipants.filter(reg => reg.attended).length;
        totalAttendance += attended;
        totalCapacity += event.registeredParticipants.length;
      }
    });
    
    const avgAttendance = totalCapacity > 0 ? Math.round((totalAttendance / totalCapacity) * 100) : 0;
    
    // User growth data (new users per day)
    const userGrowthData = await getUserGrowthData(startDate, endDate);
    
    // User distribution by role
    const userDistributionData = await getUserDistributionData();
    
    // Club memberships data
    const clubMembershipsData = await getClubMembershipsData(clubId);
    
    // Club activities data
    const clubActivitiesData = await getClubActivitiesData(startDate, endDate, clubId);
    
    // Events over time data
    const eventsOverTimeData = await getEventsOverTimeData(startDate, endDate, clubId);
    
    // Event attendance data
    const eventAttendanceData = await getEventAttendanceData(startDate, endDate, clubId);
    
    // Return analytics data
    res.json({
      stats: {
        totalUsers,
        totalClubs,
        totalEvents,
        avgAttendance
      },
      userGrowth: userGrowthData,
      userDistribution: userDistributionData,
      clubMemberships: clubMembershipsData,
      clubActivities: clubActivitiesData,
      eventsOverTime: eventsOverTimeData,
      eventAttendance: eventAttendanceData
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc    Get club analytics data
// @route   GET /api/analytics/clubs/:clubId
// @access  Private (Club Leader, Admin)
router.get('/clubs/:clubId', protect, authorize('clubLeader', 'admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const { clubId } = req.params;
    
    // Check if user is authorized to access this club's analytics
    if (req.user.systemRole === 'clubLeader') {
      const club = await Club.findOne({ _id: clubId, leader: req.user._id });
      if (!club) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    // Parse date filters
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const endDate = dateTo ? new Date(dateTo) : new Date();
    
    // Set end time to end of day
    endDate.setHours(23, 59, 59, 999);
    
    console.log(`Fetching club analytics for ${clubId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get club-specific stats
    const club = await Club.findById(clubId).populate('members.user');
    
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }
    
    const totalMembers = club.members ? club.members.length : 0;
    const totalEvents = await Event.countDocuments({
      clubId: clubId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    // Calculate average attendance
    const events = await Event.find({
      clubId: clubId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });
    
    let totalAttendance = 0;
    let totalCapacity = 0;
    let attendedEvents = 0;
    
    events.forEach(event => {
      if (event.registeredParticipants && event.registeredParticipants.length > 0) {
        attendedEvents++;
        const attended = event.registeredParticipants.filter(reg => reg.attended).length;
        totalAttendance += attended;
        totalCapacity += event.registeredParticipants.length;
      }
    });
    
    const avgAttendance = totalCapacity > 0 ? Math.round((totalAttendance / totalCapacity) * 100) : 0;
    
    // Get membership growth data
    const membershipGrowthData = await getMembershipGrowthData(clubId, startDate, endDate);
    
    // Get event attendance data
    const eventAttendanceData = await getClubEventAttendanceData(clubId, startDate, endDate);
    
    // Get engagement data
    const engagementData = await getClubEngagementData(clubId, startDate, endDate);
    
    // Return analytics data
    res.json({
      keyMetrics: {
        totalMembers,
        newMembers: membershipGrowthData.newMembers,
        activeMembers: Math.round(totalMembers * 0.85), // Placeholder
        retentionRate: 85, // Placeholder
        eventsOrganized: totalEvents,
        averageAttendance: avgAttendance,
        engagementRate: 78, // Placeholder
        satisfactionScore: 4.2 // Placeholder
      },
      membership: {
        growth: membershipGrowthData.growth,
        retention: [], // Placeholder
        demographics: {} // Placeholder
      },
      events: {
        attendance: eventAttendanceData,
        popularity: {}, // Placeholder
        satisfaction: [] // Placeholder
      },
      engagement: {
        trend: engagementData.trend,
        mostActiveMembers: engagementData.mostActiveMembers,
        byRole: engagementData.byRole
      }
    });
  } catch (error) {
    console.error('Error fetching club analytics data:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Helper function to get user growth data
async function getUserGrowthData(startDate, endDate) {
  try {
    const users = await User.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('createdAt');
    
    // Group users by day
    const userCountByDay = {};
    
    users.forEach(user => {
      const date = new Date(user.createdAt).toISOString().split('T')[0];
      userCountByDay[date] = (userCountByDay[date] || 0) + 1;
    });
    
    // Generate all dates in range
    const labels = [];
    const data = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      labels.push(formatDateLabel(currentDate));
      data.push(userCountByDay[dateStr] || 0);
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return { labels, data };
  } catch (error) {
    console.error('Error getting user growth data:', error);
    return { labels: [], data: [] };
  }
}

// Helper function to get user distribution data
async function getUserDistributionData() {
  try {
    const userDistribution = await User.aggregate([
      {
        $group: {
          _id: "$systemRole",
          count: { $sum: 1 }
        }
      }
    ]);
    
    const labels = [];
    const data = [];
    
    userDistribution.forEach(item => {
      labels.push(item._id.charAt(0).toUpperCase() + item._id.slice(1));
      data.push(item.count);
    });
    
    return { labels, data };
  } catch (error) {
    console.error('Error getting user distribution data:', error);
    return { labels: [], data: [] };
  }
}

// Helper function to get club memberships data
async function getClubMembershipsData(clubId) {
  try {
    const filter = clubId ? { _id: clubId } : {};
    const clubs = await Club.find(filter).populate('members.user');
    
    const labels = [];
    const data = [];
    
    clubs.forEach(club => {
      labels.push(club.name);
      data.push(club.members ? club.members.length : 0);
    });
    
    // Sort by membership count (descending)
    const combined = labels.map((label, i) => ({ label, value: data[i] }));
    combined.sort((a, b) => b.value - a.value);
    
    // Take top 10 clubs
    const top10 = combined.slice(0, 10);
    
    return {
      labels: top10.map(item => item.label),
      data: top10.map(item => item.value)
    };
  } catch (error) {
    console.error('Error getting club memberships data:', error);
    return { labels: [], data: [] };
  }
}

// Helper function to get club activities data
async function getClubActivitiesData(startDate, endDate, clubId) {
  try {
    const filter = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (clubId) {
      filter.clubId = clubId;
    }
    
    const events = await Event.find(filter).populate('clubId');
    
    // Group events by club
    const clubActivities = {};
    
    events.forEach(event => {
      const clubName = event.clubId ? event.clubId.name : 'Unknown';
      if (!clubActivities[clubName]) {
        clubActivities[clubName] = 0;
      }
      clubActivities[clubName]++;
    });
    
    const labels = Object.keys(clubActivities);
    const data = Object.values(clubActivities);
    
    return { labels, data };
  } catch (error) {
    console.error('Error getting club activities data:', error);
    return { labels: [], data: [] };
  }
}

// Helper function to get events over time data
async function getEventsOverTimeData(startDate, endDate, clubId) {
  try {
    const filter = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (clubId) {
      filter.clubId = clubId;
    }
    
    const events = await Event.find(filter).select('date');
    
    // Group events by week
    const eventsByWeek = {};
    
    events.forEach(event => {
      const date = new Date(event.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Set to Sunday of the week
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!eventsByWeek[weekKey]) {
        eventsByWeek[weekKey] = 0;
      }
      eventsByWeek[weekKey]++;
    });
    
    // Generate all weeks in range
    const labels = [];
    const data = [];
    const currentDate = new Date(startDate);
    
    // Set to Sunday of the week
    currentDate.setDate(startDate.getDate() - startDate.getDay());
    
    while (currentDate <= endDate) {
      const weekKey = currentDate.toISOString().split('T')[0];
      labels.push(formatDateLabel(currentDate, 'week'));
      data.push(eventsByWeek[weekKey] || 0);
      
      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return { labels, data };
  } catch (error) {
    console.error('Error getting events over time data:', error);
    return { labels: [], data: [] };
  }
}

// Helper function to get event attendance data
async function getEventAttendanceData(startDate, endDate, clubId) {
  try {
    const filter = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (clubId) {
      filter.clubId = clubId;
    }
    
    const events = await Event.find(filter)
      .populate('clubId', 'name')
      .select('title clubId registeredParticipants');
    
    const labels = [];
    const data = [];
    
    // Calculate attendance percentage for each event
    events.forEach(event => {
      if (event.registeredParticipants && event.registeredParticipants.length > 0) {
        const attended = event.registeredParticipants.filter(reg => reg.attended).length;
        const attendance = Math.round((attended / event.registeredParticipants.length) * 100);
        
        labels.push(event.title);
        data.push(attendance);
      }
    });
    
    // Sort by attendance percentage (descending) and take top 10
    const combined = labels.map((label, i) => ({ label, value: data[i] }));
    combined.sort((a, b) => b.value - a.value);
    
    const top10 = combined.slice(0, 10);
    
    return {
      labels: top10.map(item => item.label.length > 15 ? item.label.substring(0, 15) + '...' : item.label),
      data: top10.map(item => item.value)
    };
  } catch (error) {
    console.error('Error getting event attendance data:', error);
    return { labels: [], data: [] };
  }
}

// Helper function to get membership growth data
async function getMembershipGrowthData(clubId, startDate, endDate) {
  try {
    const club = await Club.findById(clubId).populate('members.user');
    if (!club) {
      return { growth: [], newMembers: 0 };
    }
    
    // Group members by join date
    const membersByMonth = {};
    let newMembers = 0;
    
    club.members.forEach(member => {
      if (member.user && member.joinDate) {
        const joinDate = new Date(member.joinDate);
        if (joinDate >= startDate && joinDate <= endDate) {
          const monthKey = joinDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          if (!membersByMonth[monthKey]) {
            membersByMonth[monthKey] = 0;
          }
          membersByMonth[monthKey]++;
          newMembers++;
        }
      }
    });
    
    // Generate growth data
    const growth = [];
    const months = Object.keys(membersByMonth).sort();
    let cumulativeCount = 0;
    
    months.forEach(month => {
      cumulativeCount += membersByMonth[month];
      growth.push({
        month: month,
        count: cumulativeCount,
        new: membersByMonth[month]
      });
    });
    
    return { growth, newMembers };
  } catch (error) {
    console.error('Error getting membership growth data:', error);
    return { growth: [], newMembers: 0 };
  }
}

// Helper function to get event attendance data
async function getClubEventAttendanceData(clubId, startDate, endDate) {
  try {
    const events = await Event.find({
      clubId: clubId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('title registeredParticipants');
    
    const attendanceData = [];
    
    events.forEach(event => {
      if (event.registeredParticipants && event.registeredParticipants.length > 0) {
        const attended = event.registeredParticipants.filter(reg => reg.attended).length;
        const expected = event.registeredParticipants.length;
        
        attendanceData.push({
          event: event.title,
          count: attended,
          expected: expected
        });
      }
    });
    
    return attendanceData;
  } catch (error) {
    console.error('Error getting event attendance data:', error);
    return [];
  }
}

// Helper function to get engagement data
async function getClubEngagementData(clubId, startDate, endDate) {
  try {
    const club = await Club.findById(clubId).populate('members.user');
    if (!club) {
      return { trend: [], mostActiveMembers: [], byRole: {} };
    }
    
    // Generate trend data (placeholder)
    const trend = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      trend.push({
        month: currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        rate: Math.floor(Math.random() * 20) + 70 // Random data between 70-90
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Get most active members (placeholder)
    const mostActiveMembers = [];
    const members = club.members.slice(0, 5); // Take first 5 members
    
    members.forEach(member => {
      if (member.user) {
        mostActiveMembers.push({
          name: member.user.name,
          score: Math.floor(Math.random() * 20) + 80 // Random data between 80-100
        });
      }
    });
    
    // Get engagement by role (placeholder)
    const byRole = {
      'President': 95,
      'Vice President': 90,
      'Secretary': 85,
      'Treasurer': 80,
      'Member': 75
    };
    
    return { trend, mostActiveMembers, byRole };
  } catch (error) {
    console.error('Error getting engagement data:', error);
    return { trend: [], mostActiveMembers: [], byRole: {} };
  }
}

// Helper function to format date labels
function formatDateLabel(date, type = 'day') {
  if (type === 'week') {
    return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

module.exports = router;