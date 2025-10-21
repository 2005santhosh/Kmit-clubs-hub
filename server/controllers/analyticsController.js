const Club = require('../models/Club');
const User = require('../models/User');
const Event = require('../models/Event');
const mongoose = require('mongoose');

// @desc    Get club analytics
// @route   GET /api/analytics/clubs/:id
// @access  Private (Club Leader)
const getClubAnalytics = async (req, res) => {
  try {
    const clubId = req.params.id;
    const timeRange = req.query.timeRange || 'last-month';
    const dataType = req.query.dataType || 'all';

    // Validate club ID
    if (!mongoose.Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID' });
    }

    // Get club details
    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    // Check if user is authorized (club leader or admin)
    if (req.user.systemRole !== 'admin' && 
        club.leader && club.leader.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view analytics for this club' });
    }

    // Calculate date range based on timeRange
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'last-week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'last-quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case 'last-year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'all-time':
      default:
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Get all club members with their details
    const clubMembers = await Club.findById(clubId)
      .populate({
        path: 'members.user',
        select: 'name username systemRole clubRole joinDate status'
      })
      .then(club => club.members);

    // Get all club events
    const clubEvents = await Event.find({ 
      club: clubId,
      date: { $gte: startDate, $lte: now }
    }).populate('attendees.user', 'name username');

    // Calculate key metrics
    const totalMembers = clubMembers.length;
    
    // Calculate new members in the time range
    const newMembers = clubMembers.filter(member => 
      new Date(member.joinDate) >= startDate
    ).length;

    // Calculate retention rate (simplified - members who joined before the time range and are still active)
    const existingMembers = clubMembers.filter(member => 
      new Date(member.joinDate) < startDate && member.user.status === 'active'
    );
    const retentionRate = existingMembers.length > 0 
      ? Math.round((existingMembers.length / (existingMembers.length + newMembers)) * 100) 
      : 100;

    // Calculate events metrics
    const eventsOrganized = clubEvents.length;
    
    // Calculate average attendance
    let totalAttendance = 0;
    let totalExpected = 0;
    clubEvents.forEach(event => {
      const attendance = event.attendees ? event.attendees.length : 0;
      totalAttendance += attendance;
      totalExpected += event.expectedAttendees || 0;
    });
    const averageAttendance = eventsOrganized > 0 
      ? Math.round(totalAttendance / eventsOrganized) 
      : 0;

    // Calculate engagement rate (simplified - percentage of active members who attended at least one event)
    const activeMembers = clubMembers.filter(member => member.user.status === 'active');
    const engagedMembers = new Set();
    clubEvents.forEach(event => {
      if (event.attendees) {
        event.attendees.forEach(attendee => {
          engagedMembers.add(attendee.user.toString());
        });
      }
    });
    const engagementRate = activeMembers.length > 0 
      ? Math.round((engagedMembers.size / activeMembers.length) * 100) 
      : 0;

    // Calculate changes (simplified - comparing with previous period)
    const prevStartDate = new Date(startDate);
    switch (timeRange) {
      case 'last-week':
        prevStartDate.setDate(prevStartDate.getDate() - 7);
        break;
      case 'last-month':
        prevStartDate.setMonth(prevStartDate.getMonth() - 1);
        break;
      case 'last-quarter':
        prevStartDate.setMonth(prevStartDate.getMonth() - 3);
        break;
      case 'last-year':
        prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
        break;
      case 'all-time':
      default:
        prevStartDate.setFullYear(0);
        break;
    }

    // Get previous period members
    const prevPeriodMembers = clubMembers.filter(member => 
      new Date(member.joinDate) >= prevStartDate && new Date(member.joinDate) < startDate
    ).length;

    // Get previous period events
    const prevPeriodEvents = await Event.find({ 
      club: clubId,
      date: { $gte: prevStartDate, $lt: startDate }
    });

    // Calculate changes
    const membersChange = prevPeriodMembers > 0 
      ? Math.round(((totalMembers - prevPeriodMembers) / prevPeriodMembers) * 100) 
      : 0;
    
    const newMembersChange = prevPeriodMembers > 0 
      ? Math.round(((newMembers - prevPeriodMembers) / prevPeriodMembers) * 100) 
      : 0;
    
    const retentionChange = 0; // Simplified for now
    const eventsChange = prevPeriodEvents.length > 0 
      ? Math.round(((eventsOrganized - prevPeriodEvents.length) / prevPeriodEvents.length) * 100) 
      : 0;
    
    const attendanceChange = 0; // Simplified for now
    const engagementChange = 0; // Simplified for now

    // Prepare key metrics
    const keyMetrics = {
      totalMembers,
      membersChange,
      newMembers,
      newMembersChange,
      retentionRate,
      retentionChange,
      eventsOrganized,
      eventsChange,
      averageAttendance,
      attendanceChange,
      engagementRate,
      engagementChange
    };

    // Prepare membership analytics
    const membership = {
      growth: generateMembershipGrowth(clubMembers, startDate, now),
      retention: generateMembershipRetention(clubMembers, startDate, now),
      demographics: generateMembershipDemographics(clubMembers)
    };

    // Prepare event analytics
    const events = {
      attendance: generateEventAttendance(clubEvents),
      popularity: generateEventPopularity(clubEvents),
      satisfaction: generateEventSatisfaction(clubEvents)
    };

    // Prepare engagement analytics
    const engagement = {
      trend: generateEngagementTrend(clubMembers, clubEvents, startDate, now),
      mostActiveMembers: generateMostActiveMembers(clubMembers, clubEvents),
      byRole: generateEngagementByRole(clubMembers, clubEvents)
    };

    // Return analytics data
    res.json({
      keyMetrics,
      membership,
      events,
      engagement
    });

  } catch (error) {
    console.error('Error fetching club analytics:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Helper function to generate membership growth data
const generateMembershipGrowth = (members, startDate, endDate) => {
  // Generate monthly membership growth data
  const months = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    months.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return months.map(month => {
    const monthStr = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const total = members.filter(member => 
      new Date(member.joinDate) <= month
    ).length;
    
    const newThisMonth = members.filter(member => {
      const joinDate = new Date(member.joinDate);
      return joinDate.getMonth() === month.getMonth() && 
             joinDate.getFullYear() === month.getFullYear();
    }).length;
    
    return {
      month: monthStr,
      count: total,
      new: newThisMonth
    };
  });
};

// Helper function to generate membership retention data
const generateMembershipRetention = (members, startDate, endDate) => {
  // Generate monthly retention rate data
  const months = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    months.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return months.map(month => {
    const monthStr = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    // Calculate retention rate for this month (simplified)
    const activeMembers = members.filter(member => 
      member.user.status === 'active' && new Date(member.joinDate) <= month
    ).length;
    
    const totalMembers = members.filter(member => 
      new Date(member.joinDate) <= month
    ).length;
    
    const rate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 100;
    
    return {
      month: monthStr,
      rate: rate
    };
  });
};

// Helper function to generate membership demographics data
const generateMembershipDemographics = (members) => {
  // Generate demographics data (simplified - by role)
  const demographics = {};
  
  members.forEach(member => {
    const role = member.role || 'member';
    demographics[role] = (demographics[role] || 0) + 1;
  });
  
  return demographics;
};

// Helper function to generate event attendance data
const generateEventAttendance = (events) => {
  // Generate event attendance data
  return events.map(event => ({
    event: event.title,
    count: event.attendees ? event.attendees.length : 0,
    expected: event.expectedAttendees || 0
  }));
};

// Helper function to generate event popularity data
const generateEventPopularity = (events) => {
  // Generate event popularity data (attendance rate)
  const popularity = {};
  
  events.forEach(event => {
    const attendance = event.attendees ? event.attendees.length : 0;
    const expected = event.expectedAttendees || 1;
    const rate = Math.round((attendance / expected) * 100);
    popularity[event.title] = rate;
  });
  
  return popularity;
};

// Helper function to generate event satisfaction data
const generateEventSatisfaction = (events) => {
  // Generate event satisfaction data (simplified - random for now)
  return events.map(event => ({
    event: event.title,
    score: Math.floor(Math.random() * 2) + 3 // Random score between 3-5
  }));
};

// Helper function to generate engagement trend data
const generateEngagementTrend = (members, events, startDate, endDate) => {
  // Generate monthly engagement trend data
  const months = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    months.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return months.map(month => {
    const monthStr = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    // Calculate engagement rate for this month (simplified)
    const monthEvents = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() === month.getMonth() && 
             eventDate.getFullYear() === month.getFullYear();
    });
    
    const activeMembers = members.filter(member => 
      member.user.status === 'active'
    ).length;
    
    const engagedMembers = new Set();
    monthEvents.forEach(event => {
      if (event.attendees) {
        event.attendees.forEach(attendee => {
          engagedMembers.add(attendee.user.toString());
        });
      }
    });
    
    const rate = activeMembers > 0 
      ? Math.round((engagedMembers.size / activeMembers) * 100) 
      : 0;
    
    return {
      month: monthStr,
      rate: rate
    };
  });
};

// Helper function to generate most active members data
const generateMostActiveMembers = (members, events) => {
  // Calculate event attendance per member
  const memberAttendance = {};
  
  events.forEach(event => {
    if (event.attendees) {
      event.attendees.forEach(attendee => {
        const memberId = attendee.user.toString();
        if (!memberAttendance[memberId]) {
          memberAttendance[memberId] = {
            id: memberId,
            name: attendee.user.name,
            count: 0
          };
        }
        memberAttendance[memberId].count++;
      });
    }
  });
  
  // Sort by attendance count and return top 5
  return Object.values(memberAttendance)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(member => ({
      name: member.name,
      score: Math.min(100, Math.round((member.count / events.length) * 100))
    }));
};

// Helper function to generate engagement by role data
const generateEngagementByRole = (members, events) => {
  // Calculate engagement by role
  const roleEngagement = {};
  const roleCounts = {};
  
  // Initialize role counts
  members.forEach(member => {
    const role = member.role || 'member';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
    roleEngagement[role] = 0;
  });
  
  // Calculate attendance by role
  events.forEach(event => {
    if (event.attendees) {
      event.attendees.forEach(attendee => {
        const member = members.find(m => m.user._id.toString() === attendee.user.toString());
        if (member) {
          const role = member.role || 'member';
          roleEngagement[role]++;
        }
      });
    }
  });
  
  // Calculate engagement rate by role
  const result = {};
  Object.keys(roleEngagement).forEach(role => {
    const count = roleEngagement[role];
    const total = roleCounts[role];
    result[role] = total > 0 ? Math.round((count / total) * 100) : 0;
  });
  
  return result;
};

module.exports = {
  getClubAnalytics
};