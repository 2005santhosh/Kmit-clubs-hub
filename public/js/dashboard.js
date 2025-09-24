// Dashboard JavaScript

class DashboardManager {
    constructor() {
        this.user = null;
        this.token = localStorage.getItem('authToken');
        this.init();
    }

    async init() {
        if (!this.token) {
            window.location.href = '/login';
            return;
        }

        await this.loadUserData();
        this.setupNavigation();
        this.setupEventHandlers();
        this.loadDashboardData();
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return;
            }

            this.user = await response.json();
            this.updateUserDisplay();
        } catch (error) {
            console.error('Error loading user data:', error);
            window.location.href = '/login';
        }
    }

    updateUserDisplay() {
        const userName = document.getElementById('userName');
        const profileName = document.getElementById('profileName');
        const profileRole = document.getElementById('profileRole');
        const profileDepartment = document.getElementById('profileDepartment');

        if (userName) userName.textContent = this.user.name;
        if (profileName) profileName.textContent = this.user.name;
        if (profileRole) profileRole.textContent = this.formatRole(this.user.role);
        if (profileDepartment) profileDepartment.textContent = this.user.department;

        // Populate profile form
        this.populateProfileForm();
    }

    populateProfileForm() {
        const fields = {
            'profileFullName': this.user.name,
            'profileEmail': this.user.email,
            'profileDepartmentSelect': this.user.department,
            'profileYear': this.user.year
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value) {
                element.value = value;
            }
        });

        // Hide year field for non-students
        const yearGroup = document.getElementById('yearGroup');
        if (yearGroup && this.user.role !== 'student') {
            yearGroup.style.display = 'none';
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.dashboard-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionName = item.getAttribute('data-section');
                
                // Update active nav item
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Show corresponding section
                sections.forEach(section => {
                    section.classList.remove('active');
                    if (section.id === sectionName) {
                        section.classList.add('active');
                    }
                });

                // Update section title
                const sectionTitle = document.getElementById('sectionTitle');
                if (sectionTitle) {
                    sectionTitle.textContent = this.getSectionTitle(sectionName);
                }

                // Load section-specific data
                this.loadSectionData(sectionName);
            });
        });
    }

    setupEventHandlers() {
        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Create event buttons
        const createEventBtns = document.querySelectorAll('#createEventBtn, #createEventBtnHeader');
        createEventBtns.forEach(btn => {
            btn.addEventListener('click', () => this.showCreateEventModal());
        });

        // Create event form
        const createEventForm = document.getElementById('createEventForm');
        if (createEventForm) {
            createEventForm.addEventListener('submit', (e) => this.handleCreateEvent(e));
        }

        // Profile form
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Event tabs
        const eventTabs = document.querySelectorAll('[data-event-tab]');
        eventTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                eventTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadEvents(tab.getAttribute('data-event-tab'));
            });
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = closeBtn.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    async loadDashboardData() {
        await Promise.all([
            this.loadOverviewStats(),
            this.loadMyClubs(),
            this.loadEvents('registered'),
            this.loadNotifications()
        ]);
    }

    async loadOverviewStats() {
        try {
            // Load user's clubs and events for stats
            const clubsCount = this.user.clubs ? this.user.clubs.length : 0;
            
            document.getElementById('myClubsCount').textContent = clubsCount;
            
            // Load upcoming events count
            const eventsResponse = await this.makeAuthenticatedRequest('/api/events?upcoming=true');
            if (eventsResponse.ok) {
                const events = await eventsResponse.json();
                document.getElementById('upcomingEventsCount').textContent = events.length;
            }
        } catch (error) {
            console.error('Error loading overview stats:', error);
        }
    }

    async loadMyClubs() {
        const clubsList = document.getElementById('myClubsList');
        if (!clubsList) return;

        try {
            if (!this.user.clubs || this.user.clubs.length === 0) {
                clubsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>You haven't joined any clubs yet</p>
                        <a href="/clubs" class="btn btn-primary">Discover Clubs</a>
                    </div>
                `;
                return;
            }

            const clubsHtml = this.user.clubs.map(club => this.createMyClubCard(club)).join('');
            clubsList.innerHTML = clubsHtml;
        } catch (error) {
            console.error('Error loading my clubs:', error);
            clubsList.innerHTML = '<div class="error-state">Failed to load clubs</div>';
        }
    }

    async loadEvents(type = 'registered') {
        const eventsList = document.getElementById('eventsList');
        if (!eventsList) return;

        try {
            let url = '/api/events';
            if (type === 'registered') {
                // Load events user is registered for
                url += '?upcoming=true';
            } else if (type === 'organized') {
                // Load events user organized
                url += `?organizer=${this.user._id}`;
            }

            const response = await this.makeAuthenticatedRequest(url);
            if (!response.ok) throw new Error('Failed to fetch events');

            const events = await response.json();
            
            if (events.length === 0) {
                eventsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-calendar"></i>
                        <p>No ${type} events found</p>
                    </div>
                `;
                return;
            }

            eventsList.innerHTML = events.map(event => this.createEventCard(event)).join('');
        } catch (error) {
            console.error('Error loading events:', error);
            eventsList.innerHTML = '<div class="error-state">Failed to load events</div>';
        }
    }

    async loadNotifications() {
        const notificationsList = document.getElementById('notificationsList');
        const notificationBadge = document.getElementById('notificationBadge');
        
        if (!notificationsList) return;

        try {
            // Mock notifications for demo
            const notifications = [
                {
                    id: '1',
                    title: 'Event Approved',
                    message: 'Your event "Tech Talk 2025" has been approved by faculty.',
                    type: 'success',
                    read: false,
                    timestamp: new Date()
                },
                {
                    id: '2',
                    title: 'New Club Member',
                    message: 'John Doe has joined your club "Coding Club".',
                    type: 'info',
                    read: false,
                    timestamp: new Date(Date.now() - 86400000)
                }
            ];

            const unreadCount = notifications.filter(n => !n.read).length;
            if (notificationBadge) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }

            if (notifications.length === 0) {
                notificationsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-bell"></i>
                        <p>No notifications yet</p>
                    </div>
                `;
                return;
            }

            notificationsList.innerHTML = notifications.map(notification => 
                this.createNotificationItem(notification)
            ).join('');
        } catch (error) {
            console.error('Error loading notifications:', error);
            notificationsList.innerHTML = '<div class="error-state">Failed to load notifications</div>';
        }
    }

    async showCreateEventModal() {
        const modal = document.getElementById('createEventModal');
        const clubSelect = document.getElementById('eventClub');
        
        if (!modal || !clubSelect) return;

        // Load user's clubs for the dropdown
        try {
            if (this.user.clubs && this.user.clubs.length > 0) {
                clubSelect.innerHTML = '<option value="">Select Club</option>' +
                    this.user.clubs.map(club => 
                        `<option value="${club.clubId._id}">${club.clubId.name}</option>`
                    ).join('');
            } else {
                clubSelect.innerHTML = '<option value="">No clubs available</option>';
            }

            modal.style.display = 'block';
        } catch (error) {
            console.error('Error loading clubs for event creation:', error);
        }
    }

    async handleCreateEvent(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('eventTitle').value,
            description: document.getElementById('eventDescription').value,
            clubId: document.getElementById('eventClub').value,
            eventType: document.getElementById('eventType').value,
            venue: document.getElementById('eventVenue').value,
            date: document.getElementById('eventDate').value,
            startTime: document.getElementById('startTime').value,
            endTime: document.getElementById('endTime').value,
            maxParticipants: parseInt(document.getElementById('maxParticipants').value) || 0,
            budget: parseInt(document.getElementById('eventBudget').value) || 0
        };

        try {
            const response = await this.makeAuthenticatedRequest('/api/events', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Event created successfully! Awaiting approval.', 'success');
                document.getElementById('createEventModal').style.display = 'none';
                document.getElementById('createEventForm').reset();
                this.loadEvents('organized');
            } else {
                this.showMessage(data.message || 'Failed to create event', 'error');
            }
        } catch (error) {
            console.error('Error creating event:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('profileFullName').value,
            department: document.getElementById('profileDepartmentSelect').value
        };

        if (this.user.role === 'student') {
            formData.year = parseInt(document.getElementById('profileYear').value);
        }

        try {
            const response = await this.makeAuthenticatedRequest(`/api/auth/profile`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Profile updated successfully!', 'success');
                // Update local user data
                Object.assign(this.user, formData);
                localStorage.setItem('user', JSON.stringify(this.user));
                this.updateUserDisplay();
            } else {
                this.showMessage(data.message || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    createMyClubCard(clubMembership) {
        const club = clubMembership.clubId;
        const role = clubMembership.role;
        
        return `
            <div class="club-card">
                <div class="club-header">
                    <div class="club-logo">
                        ${club.logo ? `<img src="${club.logo}" alt="${club.name}">` : club.name.charAt(0)}
                    </div>
                    <div class="club-info">
                        <h3>${club.name}</h3>
                        <span class="club-category">${this.formatCategory(club.category)}</span>
                        <span class="member-role">${this.formatRole(role)}</span>
                    </div>
                </div>
                <p class="club-description">${club.description}</p>
                <div class="club-actions">
                    <a href="/clubs" class="btn btn-outline btn-sm">View Details</a>
                </div>
            </div>
        `;
    }

    createEventCard(event) {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString();
        const statusClass = this.getStatusClass(event.status);
        
        return `
            <div class="event-card">
                <div class="event-header">
                    <div>
                        <h3 class="event-title">${event.title}</h3>
                        <p class="event-club">by ${event.clubId ? event.clubId.name : 'Unknown Club'}</p>
                    </div>
                    <span class="event-status ${statusClass}">${event.status}</span>
                </div>
                <p class="event-description">${event.description}</p>
                <div class="event-details">
                    <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                    <span><i class="fas fa-clock"></i> ${event.startTime}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${event.venue}</span>
                </div>
            </div>
        `;
    }

    createNotificationItem(notification) {
        const readClass = notification.read ? '' : 'unread';
        const timeAgo = this.getTimeAgo(notification.timestamp);
        
        return `
            <div class="notification-item ${readClass}" data-id="${notification.id}">
                <div class="notification-content">
                    <div class="notification-icon">
                        <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-text">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-meta">${timeAgo}</div>
                    </div>
                </div>
            </div>
        `;
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'overview':
                this.loadOverviewStats();
                break;
            case 'my-clubs':
                this.loadMyClubs();
                break;
            case 'events':
                this.loadEvents('registered');
                break;
            case 'notifications':
                this.loadNotifications();
                break;
        }
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        return fetch(url, mergedOptions);
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    showMessage(message, type = 'info') {
        // Create and show message modal
        const modal = document.createElement('div');
        modal.className = 'message-toast';
        modal.innerHTML = `
            <div class="message message-${type}">
                <i class="fas ${this.getMessageIcon(type)}"></i>
                <p>${message}</p>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            modal.remove();
        }, 3000);
    }

    getSectionTitle(sectionName) {
        const titles = {
            'overview': 'Dashboard Overview',
            'my-clubs': 'My Clubs',
            'events': 'My Events',
            'notifications': 'Notifications',
            'profile': 'Profile Settings'
        };
        return titles[sectionName] || 'Dashboard';
    }

    formatCategory(category) {
        return category.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatRole(role) {
        return role.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    getStatusClass(status) {
        const classes = {
            'pending': 'status-warning',
            'approved': 'status-success',
            'rejected': 'status-error',
            'completed': 'status-info',
            'cancelled': 'status-error'
        };
        return classes[status] || 'status-info';
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle',
            'error': 'fa-exclamation-circle'
        };
        return icons[type] || 'fa-bell';
    }

    getMessageIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    new DashboardManager();
});

// Global modal functions
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Add dashboard-specific styles
const dashboardStyles = document.createElement('style');
dashboardStyles.textContent = `
    .member-role {
        background: var(--accent-color);
        color: white;
        padding: 0.25rem var(--space-1);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-xs);
        font-weight: 500;
        margin-left: var(--space-2);
    }
    
    .event-status {
        padding: 0.25rem var(--space-2);
        border-radius: var(--radius);
        font-size: var(--font-size-xs);
        font-weight: 500;
        text-transform: uppercase;
    }
    
    .status-success { background: var(--success-color); color: white; }
    .status-warning { background: var(--warning-color); color: white; }
    .status-error { background: var(--error-color); color: white; }
    .status-info { background: var(--info-color); color: white; }
    
    .message-toast {
        position: fixed;
        top: var(--space-4);
        right: var(--space-4);
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    .btn-sm {
        padding: var(--space-1) var(--space-2);
        font-size: var(--font-size-sm);
    }
`;
document.head.appendChild(dashboardStyles);