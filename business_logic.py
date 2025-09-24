import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import uuid

class UserRole(Enum):
    STUDENT = "student"
    FACULTY = "faculty"
    ADMIN = "admin"

class MembershipStatus(Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REJECTED = "rejected"

class EventStatus(Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class ClubManagementSystem:
    def __init__(self, db_connector, redis_client, jwt_secret):
        self.db = db_connector
        self.redis = redis_client
        self.jwt_secret = jwt_secret
        self.token_expiry = timedelta(hours=24)

    # ==================== USER MANAGEMENT ====================
    
    def register_user(self, user_data: Dict) -> Tuple[bool, Dict]:
        """Register a new user with role-based validation"""
        try:
            # Validate required fields
            required_fields = ['name', 'email', 'password', 'role']
            if not all(field in user_data for field in required_fields):
                return False, {"error": "Missing required fields"}
            
            # Check for existing user
            if self.db.users.find_one({"email": user_data['email']}):
                return False, {"error": "Email already exists"}
            
            # Role-specific validation
            if user_data['role'] == UserRole.STUDENT.value:
                if 'studentId' not in user_data or 'year' not in user_data:
                    return False, {"error": "Student ID and year required for students"}
                if self.db.users.find_one({"studentId": user_data['studentId']}):
                    return False, {"error": "Student ID already exists"}
            
            # Hash password
            hashed_password = bcrypt.hashpw(
                user_data['password'].encode('utf-8'), 
                bcrypt.gensalt()
            )
            
            # Create user document
            user = {
                "name": user_data['name'],
                "email": user_data['email'],
                "password": hashed_password,
                "role": user_data['role'],
                "isActive": True,
                "createdAt": datetime.utcnow()
            }
            
            # Add role-specific fields
            if user_data['role'] == UserRole.STUDENT.value:
                user.update({
                    "studentId": user_data['studentId'],
                    "year": user_data['year'],
                    "department": user_data.get('department', '')
                })
            else:
                user.update({
                    "department": user_data.get('department', '')
                })
            
            # Save to database
            result = self.db.users.insert_one(user)
            user['_id'] = str(result.inserted_id)
            
            # Generate token
            token = self._generate_token(user)
            
            return True, {
                "message": "User registered successfully",
                "token": token,
                "user": self._sanitize_user(user)
            }
            
        except Exception as e:
            return False, {"error": f"Registration failed: {str(e)}"}

    def login_user(self, credentials: Dict) -> Tuple[bool, Dict]:
        """Authenticate user and return JWT token"""
        try:
            user = self.db.users.find_one({"email": credentials['email']})
            
            if not user or not user['isActive']:
                return False, {"error": "Invalid credentials"}
            
            if not bcrypt.checkpw(
                credentials['password'].encode('utf-8'),
                user['password']
            ):
                return False, {"error": "Invalid credentials"}
            
            # Generate token
            token = self._generate_token(user)
            
            return True, {
                "message": "Login successful",
                "token": token,
                "user": self._sanitize_user(user)
            }
            
        except Exception as e:
            return False, {"error": f"Login failed: {str(e)}"}

    def get_user_profile(self, user_id: str) -> Tuple[bool, Dict]:
        """Get user profile with populated club relationships"""
        try:
            user = self.db.users.find_one(
                {"_id": ObjectId(user_id)},
                {"password": 0}  # Exclude password
            )
            
            if not user:
                return False, {"error": "User not found"}
            
            # Populate club memberships
            clubs = []
            for club_ref in user.get('clubs', []):
                club = self.db.clubs.find_one(
                    {"_id": ObjectId(club_ref['clubId'])},
                    {"name": 1, "category": 1}
                )
                if club:
                    clubs.append({
                        "clubId": str(club['_id']),
                        "name": club['name'],
                        "category": club['category'],
                        "role": club_ref['role']
                    })
            
            user['clubs'] = clubs
            user['_id'] = str(user['_id'])
            
            return True, user
            
        except Exception as e:
            return False, {"error": f"Failed to get profile: {str(e)}"}

    # ==================== CLUB MANAGEMENT ====================
    
    def create_club(self, club_data: Dict, creator_id: str) -> Tuple[bool, Dict]:
        """Create a new club with authorization checks"""
        try:
            # Get creator
            creator = self.db.users.find_one({"_id": ObjectId(creator_id)})
            if not creator or creator['role'] not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
                return False, {"error": "Unauthorized to create clubs"}
            
            # Validate required fields
            required_fields = ['name', 'description', 'category', 'mission', 'vision']
            if not all(field in club_data for field in required_fields):
                return False, {"error": "Missing required fields"}
            
            # Check for existing club
            if self.db.clubs.find_one({"name": club_data['name']}):
                return False, {"error": "Club name already exists"}
            
            # Create club document
            club = {
                "name": club_data['name'],
                "description": club_data['description'],
                "category": club_data['category'],
                "mission": club_data['mission'],
                "vision": club_data['vision'],
                "facultyCoordinator": ObjectId(creator_id),
                "establishedDate": club_data.get('establishedDate', datetime.utcnow()),
                "isActive": True,
                "members": [],
                "events": [],
                "createdAt": datetime.utcnow()
            }
            
            # Save to database
            result = self.db.clubs.insert_one(club)
            club['_id'] = str(result.inserted_id)
            
            # Publish notification
            self._publish_notification('club-updates', {
                "type": "club-created",
                "clubId": club['_id'],
                "clubName": club['name'],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return True, {
                "message": "Club created successfully",
                "club": club
            }
            
        except Exception as e:
            return False, {"error": f"Failed to create club: {str(e)}"}

    def join_club(self, club_id: str, user_id: str) -> Tuple[bool, Dict]:
        """Request membership to a club"""
        try:
            club = self.db.clubs.find_one({"_id": ObjectId(club_id)})
            if not club or not club['isActive']:
                return False, {"error": "Club not found"}
            
            # Check if already a member
            for member in club['members']:
                if str(member['userId']) == user_id:
                    return False, {"error": "Already a member of this club"}
            
            # Add membership request
            membership = {
                "userId": ObjectId(user_id),
                "role": "member",
                "status": MembershipStatus.PENDING.value,
                "joinedAt": datetime.utcnow()
            }
            
            self.db.clubs.update_one(
                {"_id": ObjectId(club_id)},
                {"$push": {"members": membership}}
            )
            
            # Add club to user's clubs
            self.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$push": {"clubs": {"clubId": club_id, "role": "member"}}}
            )
            
            # Get user name for notification
            user = self.db.users.find_one(
                {"_id": ObjectId(user_id)},
                {"name": 1}
            )
            
            # Publish notification
            self._publish_notification('club-updates', {
                "type": "membership-request",
                "clubId": club_id,
                "userId": user_id,
                "clubName": club['name'],
                "userName": user['name'],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return True, {"message": "Membership request sent successfully"}
            
        except Exception as e:
            return False, {"error": f"Failed to join club: {str(e)}"}

    def approve_membership(self, club_id: str, member_id: str, approver_id: str) -> Tuple[bool, Dict]:
        """Approve a club membership request"""
        try:
            club = self.db.clubs.find_one({"_id": ObjectId(club_id)})
            if not club:
                return False, {"error": "Club not found"}
            
            # Check permissions
            if not self._can_approve_membership(club, approver_id):
                return False, {"error": "Insufficient permissions"}
            
            # Find and update member
            updated = False
            for member in club['members']:
                if str(member['userId']) == member_id:
                    member['status'] = MembershipStatus.ACTIVE.value
                    updated = True
                    break
            
            if not updated:
                return False, {"error": "Member not found"}
            
            # Save changes
            self.db.clubs.replace_one(
                {"_id": ObjectId(club_id)},
                club
            )
            
            return True, {"message": "Membership approved successfully"}
            
        except Exception as e:
            return False, {"error": f"Failed to approve membership: {str(e)}"}

    def get_clubs(self, filters: Dict = None) -> Tuple[bool, List]:
        """Get clubs with optional filtering"""
        try:
            query = {"isActive": True}
            
            if filters:
                if filters.get('category') and filters['category'] != 'all':
                    query['category'] = filters['category']
                
                if filters.get('search'):
                    query['$or'] = [
                        {"name": {"$regex": filters['search'], "$options": "i"}},
                        {"description": {"$regex": filters['search'], "$options": "i"}}
                    ]
            
            clubs = list(self.db.clubs.find(query))
            
            # Sanitize and convert IDs
            for club in clubs:
                club['_id'] = str(club['_id'])
                club['facultyCoordinator'] = str(club['facultyCoordinator'])
                if 'president' in club and club['president']:
                    club['president'] = str(club['president'])
            
            return True, clubs
            
        except Exception as e:
            return False, {"error": f"Failed to get clubs: {str(e)}"}

    # ==================== EVENT MANAGEMENT ====================
    
    def create_event(self, event_data: Dict, creator_id: str) -> Tuple[bool, Dict]:
        """Create a new event with authorization checks"""
        try:
            # Validate required fields
            required_fields = ['title', 'description', 'clubId', 'eventType', 'venue', 'date', 'startTime', 'endTime']
            if not all(field in event_data for field in required_fields):
                return False, {"error": "Missing required fields"}
            
            # Check club exists and user has permission
            club = self.db.clubs.find_one({"_id": ObjectId(event_data['clubId'])})
            if not club or not club['isActive']:
                return False, {"error": "Club not found"}
            
            if not self._can_create_event(club, creator_id):
                return False, {"error": "Not authorized to create events for this club"}
            
            # Create event document
            event = {
                "title": event_data['title'],
                "description": event_data['description'],
                "clubId": ObjectId(event_data['clubId']),
                "organizer": ObjectId(creator_id),
                "eventType": event_data['eventType'],
                "venue": event_data['venue'],
                "date": datetime.strptime(event_data['date'], "%Y-%m-%d"),
                "startTime": event_data['startTime'],
                "endTime": event_data['endTime'],
                "maxParticipants": event_data.get('maxParticipants', 0),
                "budget": {
                    "requested": event_data.get('budget', 0),
                    "approved": 0
                },
                "status": EventStatus.PENDING.value,
                "registeredParticipants": [],
                "createdAt": datetime.utcnow()
            }
            
            # Save to database
            result = self.db.events.insert_one(event)
            event['_id'] = str(result.inserted_id)
            
            # Add event to club
            self.db.clubs.update_one(
                {"_id": ObjectId(event_data['clubId'])},
                {"$push": {"events": ObjectId(result.inserted_id)}}
            )
            
            # Get creator name for notification
            creator = self.db.users.find_one(
                {"_id": ObjectId(creator_id)},
                {"name": 1}
            )
            
            # Publish notification
            self._publish_notification('event-updates', {
                "type": "event-created",
                "eventId": event['_id'],
                "clubId": event_data['clubId'],
                "title": event['title'],
                "organizer": creator['name'],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return True, {
                "message": "Event created successfully",
                "event": event
            }
            
        except Exception as e:
            return False, {"error": f"Failed to create event: {str(e)}"}

    def register_for_event(self, event_id: str, user_id: str) -> Tuple[bool, Dict]:
        """Register a user for an event"""
        try:
            event = self.db.events.find_one({"_id": ObjectId(event_id)})
            if not event:
                return False, {"error": "Event not found"}
            
            # Check if already registered
            for participant in event['registeredParticipants']:
                if str(participant['userId']) == user_id:
                    return False, {"error": "Already registered for this event"}
            
            # Check capacity
            if event['maxParticipants'] > 0 and len(event['registeredParticipants']) >= event['maxParticipants']:
                return False, {"error": "Event is full"}
            
            # Add registration
            registration = {
                "userId": ObjectId(user_id),
                "registeredAt": datetime.utcnow()
            }
            
            self.db.events.update_one(
                {"_id": ObjectId(event_id)},
                {"$push": {"registeredParticipants": registration}}
            )
            
            return True, {"message": "Successfully registered for event"}
            
        except Exception as e:
            return False, {"error": f"Failed to register for event: {str(e)}"}

    def approve_event(self, event_id: str, approver_data: Dict, approver_id: str) -> Tuple[bool, Dict]:
        """Approve an event (faculty/admin only)"""
        try:
            approver = self.db.users.find_one({"_id": ObjectId(approver_id)})
            if not approver or approver['role'] not in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
                return False, {"error": "Unauthorized to approve events"}
            
            event = self.db.events.find_one({"_id": ObjectId(event_id)})
            if not event:
                return False, {"error": "Event not found"}
            
            # Update event
            update_data = {
                "status": EventStatus.APPROVED.value,
                "approvedBy": ObjectId(approver_id),
                "approvalNotes": approver_data.get('approvalNotes', ''),
                "budget.approved": approver_data.get('approvedBudget', 0)
            }
            
            self.db.events.update_one(
                {"_id": ObjectId(event_id)},
                {"$set": update_data}
            )
            
            # Get event details for notification
            club = self.db.clubs.find_one(
                {"_id": event['clubId']},
                {"name": 1}
            )
            
            # Publish notification
            self._publish_notification('event-updates', {
                "type": "event-approved",
                "eventId": event_id,
                "title": event['title'],
                "clubName": club['name'],
                "approvedBy": approver['name'],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return True, {"message": "Event approved successfully"}
            
        except Exception as e:
            return False, {"error": f"Failed to approve event: {str(e)}"}

    def get_events(self, filters: Dict = None) -> Tuple[bool, List]:
        """Get events with optional filtering"""
        try:
            query = {}
            
            if filters:
                if filters.get('status'):
                    query['status'] = filters['status']
                
                if filters.get('clubId'):
                    query['clubId'] = ObjectId(filters['clubId'])
                
                if filters.get('upcoming') == 'true':
                    query['date'] = {"$gte": datetime.utcnow()}
            
            events = list(self.db.events.find(query))
            
            # Sanitize and convert IDs
            for event in events:
                event['_id'] = str(event['_id'])
                event['clubId'] = str(event['clubId'])
                event['organizer'] = str(event['organizer'])
                if 'approvedBy' in event and event['approvedBy']:
                    event['approvedBy'] = str(event['approvedBy'])
            
            return True, events
            
        except Exception as e:
            return False, {"error": f"Failed to get events: {str(e)}"}

    # ==================== DASHBOARD OPERATIONS ====================
    
    def get_dashboard_stats(self) -> Tuple[bool, Dict]:
        """Get dashboard statistics"""
        try:
            # Get counts
            total_users = self.db.users.count_documents({"isActive": True})
            total_clubs = self.db.clubs.count_documents({"isActive": True})
            total_events = self.db.events.count_documents()
            pending_events = self.db.events.count_documents({"status": EventStatus.PENDING.value})
            upcoming_events = self.db.events.count_documents({
                "date": {"$gte": datetime.utcnow()},
                "status": EventStatus.APPROVED.value
            })
            
            # Get club distribution by category
            pipeline = [
                {"$match": {"isActive": True}},
                {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]
            clubs_by_category = list(self.db.clubs.aggregate(pipeline))
            
            # Get recent events
            recent_events = list(self.db.events.find()
                                 .sort("createdAt", -1)
                                 .limit(5))
            
            # Sanitize event data
            for event in recent_events:
                event['_id'] = str(event['_id'])
                event['clubId'] = str(event['clubId'])
                event['organizer'] = str(event['organizer'])
            
            return True, {
                "stats": {
                    "totalUsers": total_users,
                    "totalClubs": total_clubs,
                    "totalEvents": total_events,
                    "pendingEvents": pending_events,
                    "upcomingEvents": upcoming_events
                },
                "clubsByCategory": clubs_by_category,
                "recentEvents": recent_events
            }
            
        except Exception as e:
            return False, {"error": f"Failed to get stats: {str(e)}"}

    def get_pending_approvals(self) -> Tuple[bool, Dict]:
        """Get all pending approvals (events and memberships)"""
        try:
            # Get pending events
            pending_events = list(self.db.events.find({"status": EventStatus.PENDING.value}))
            for event in pending_events:
                event['_id'] = str(event['_id'])
                event['clubId'] = str(event['clubId'])
                event['organizer'] = str(event['organizer'])
            
            # Get pending memberships
            clubs_with_pending = self.db.clubs.find({
                "members.status": MembershipStatus.PENDING.value
            })
            
            pending_memberships = []
            for club in clubs_with_pending:
                club_id = str(club['_id'])
                club_name = club['name']
                
                for member in club['members']:
                    if member['status'] == MembershipStatus.PENDING.value:
                        user = self.db.users.find_one(
                            {"_id": member['userId']},
                            {"name": 1, "email": 1, "department": 1}
                        )
                        
                        if user:
                            pending_memberships.append({
                                "clubId": club_id,
                                "clubName": club_name,
                                "user": {
                                    "id": str(user['_id']),
                                    "name": user['name'],
                                    "email": user['email'],
                                    "department": user.get('department', '')
                                },
                                "requestDate": member['joinedAt'].isoformat()
                            })
            
            return True, {
                "pendingEvents": pending_events,
                "pendingMemberships": pending_memberships
            }
            
        except Exception as e:
            return False, {"error": f"Failed to get pending approvals: {str(e)}"}

    # ==================== HELPER METHODS ====================
    
    def _generate_token(self, user: Dict) -> str:
        """Generate JWT token for user"""
        payload = {
            "id": str(user['_id']),
            "email": user['email'],
            "role": user['role'],
            "exp": datetime.utcnow() + self.token_expiry
        }
        return jwt.encode(payload, self.jwt_secret, algorithm="HS256")
    
    def _sanitize_user(self, user: Dict) -> Dict:
        """Remove sensitive fields from user object"""
        sanitized = user.copy()
        sanitized.pop('password', None)
        sanitized['_id'] = str(sanitized['_id'])
        return sanitized
    
    def _can_approve_membership(self, club: Dict, user_id: str) -> bool:
        """Check if user can approve memberships for a club"""
        # Check if user is faculty/admin
        user = self.db.users.find_one({"_id": ObjectId(user_id)})
        if user and user['role'] in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
            return True
        
        # Check if user is a club officer
        for member in club['members']:
            if str(member['userId']) == user_id and member['status'] == MembershipStatus.ACTIVE.value:
                if member['role'] in ['president', 'vice-president', 'secretary']:
                    return True
        
        return False
    
    def _can_create_event(self, club: Dict, user_id: str) -> bool:
        """Check if user can create events for a club"""
        # Check if user is faculty/admin
        user = self.db.users.find_one({"_id": ObjectId(user_id)})
        if user and user['role'] in [UserRole.FACULTY.value, UserRole.ADMIN.value]:
            return True
        
        # Check if user is an active club member
        for member in club['members']:
            if str(member['userId']) == user_id and member['status'] == MembershipStatus.ACTIVE.value:
                return True
        
        return False
    
    def _publish_notification(self, channel: str, message: Dict):
        """Publish notification to Redis channel"""
        try:
            self.redis.publish(channel, str(message).replace("'", '"'))
        except Exception as e:
            print(f"Failed to publish notification: {str(e)}")