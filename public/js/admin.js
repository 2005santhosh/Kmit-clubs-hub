// Admin panel JavaScript

class AdminManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
        this.init();
    }

    init() {
        this.checkAdminAccess();
        this.setupNavigation();
        this.loadDashboardStats();
        this.setupEventHandlers();
    }

    checkAdminAccess() {
        if (!this.token || (this.user.role !== 'admin' && this.user.role !== 'faculty')) {
            window.location.href = '/login';
            return;
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
                const sectionTitle = document.getElementById('adminSectionTitle');
                if (sectionTitle) {
                    sectionTitle.textContent = this.getSectionTitle(sectionName);
                }

                // Load section-specific data
                this.loadSectionData(sectionName);
            });
        });
    }

    setupEventHandlers() {
        // Create club buttons
        const createClubBtns = document.querySelectorAll('#createClubBtn, #createClubBtnHeader');
        createClubBtns.forEach(btn => {
            btn.addEventListener('click', () => this.showCreateClubModal());
        });

        // Filters
        const roleFilter = document.getElementById('roleFilter');
        const departmentFilter = document.getElementById('departmentFilter');

        if (roleFilter) {
            roleFilter.addEventListener('change', () => this.loadUsers());
        }

        if (departmentFilter) {
            departmentFilter.addEventListener('change', () => this.loadUsers());
        }
    }

    async loadDashboardStats() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/admin/stats');
            if (!response.ok) throw new Error('Failed to fetch stats');

            const data = await response.json();
            this.updateStatsDisplay(data.stats);
            this.renderClubsChart(data.clubsByCategory);
            this.renderRecentActivity(data.recentEvents);
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    updateStatsDisplay(stats) {
        const elements = {
            'totalUsers': stats.totalUsers,
            'totalClubs': stats.totalClubs,
            'totalEvents': stats.totalEvents,
            'pendingApprovals': stats.pendingEvents
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value || 0;
            }
        });
    }

    renderClubsChart(clubsByCategory) {
        const chartContainer = document.getElementById('clubsChart');
        if (!chartContainer || !clubsByCategory) return;

        const maxCount = Math.max(...clubsByCategory.map(item => item.count));
        
        chartContainer.innerHTML = `
            <div class="chart-bar">
                ${clubsByCategory.map(item => `
                    <div class="chart-item">
                        <div class="chart-bar-fill" style="height: ${(item.count / maxCount) * 100}%"></div>
                        <div class="chart-label">
                            <div class="chart-value">${item.count}</div>
                            <div>${this.formatCategory(item._id)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderRecentActivity(recentEvents) {
        const activityContainer = document.getElementById('adminRecentActivity');
        if (!activityContainer || !recentEvents) return;

        if (recentEvents.length === 0) {
            activityContainer.innerHTML = '<p class="text-center text-gray-500">No recent activity</p>';
            return;
        }

        activityContainer.innerHTML = recentEvents.map(event => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-calendar"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${event.title}</div>
                    <div class="activity-meta">
                        by ${event.clubId ? event.clubId.name : 'Unknown Club'} • 
                        ${this.getTimeAgo(event.createdAt)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                await this.loadDashboardStats();
                break;
            case 'clubs-management':
                await this.loadClubsManagement();
                break;
            case 'events-approval':
                await this.loadPendingEvents();
                break;
            case 'users-management':
                await this.loadUsers();
                break;
        }
    }

    async loadClubsManagement() {
        const clubsList = document.getElementById('clubsManagementList');
        if (!clubsList) return;

        try {
            const response = await this.makeAuthenticatedRequest('/api/clubs');
            if (!response.ok) throw new Error('Failed to fetch clubs');

            const clubs = await response.json();
            
            clubsList.innerHTML = clubs.map(club => this.createClubManagementItem(club)).join('');
        } catch (error) {
            console.error('Error loading clubs:', error);
            clubsList.innerHTML = '<div class="error-state">Failed to load clubs</div>';
        }
    }

    async loadPendingEvents() {
        const pendingList = document.getElementById('pendingEventsList');
        if (!pendingList) return;

        try {
            const response = await this.makeAuthenticatedRequest('/api/admin/pending');
            if (!response.ok) throw new Error('Failed to fetch pending items');

            const data = await response.json();
            
            if (data.pendingEvents.length === 0) {
                pendingList.innerHTML = this.getEmptyState('No pending events for approval');
                return;
            }

            pendingList.innerHTML = data.pendingEvents.map(event => 
                this.createPendingEventItem(event)
            ).join('');
        } catch (error) {
            console.error('Error loading pending events:', error);
            pendingList.innerHTML = '<div class="error-state">Failed to load pending events</div>';
        }
    }

    async loadUsers() {
        const usersList = document.getElementById('usersManagementList');
        if (!usersList) return;

        try {
            const roleFilter = document.getElementById('roleFilter')?.value || '';
            const departmentFilter = document.getElementById('departmentFilter')?.value || '';
            
            let url = '/api/admin/users?';
            if (roleFilter) url += `role=${roleFilter}&`;
            if (departmentFilter) url += `department=${departmentFilter}&`;

            const response = await this.makeAuthenticatedRequest(url);
            if (!response.ok) throw new Error('Failed to fetch users');

            const users = await response.json();
            
            usersList.innerHTML = users.map(user => this.createUserItem(user)).join('');
        } catch (error) {
            console.error('Error loading users:', error);
            usersList.innerHTML = '<div class="error-state">Failed to load users</div>';
        }
    }

    createClubManagementItem(club) {
        const memberCount = club.members ? club.members.length : 0;
        
        return `
            <div class="management-item">
                <div class="management-info">
                    <h4>${club.name}</h4>
                    <p>${this.formatCategory(club.category)} • ${memberCount} members</p>
                    <p class="text-sm">Coordinator: ${club.facultyCoordinator ? club.facultyCoordinator.name : 'Not assigned'}</p>
                </div>
                <div class="management-actions">
                    <button class="btn btn-outline" onclick="adminManager.viewClub('${club._id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-primary" onclick="adminManager.editClub('${club._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `;
    }

    createPendingEventItem(event) {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString();
        
        return `
            <div class="approval-item">
                <div class="approval-header">
                    <div class="approval-title">${event.title}</div>
                    <span class="approval-status pending">Pending</span>
                </div>
                <div class="approval-details">
                    <p>${event.description}</p>
                </div>
                <div class="approval-meta">
                    <span>Club: ${event.clubId ? event.clubId.name : 'Unknown'}</span>
                    <span>Date: ${formattedDate}</span>
                    <span>Venue: ${event.venue}</span>
                    <span>Budget: ₹${event.budget ? event.budget.requested : 0}</span>
                </div>
                <div class="approval-actions">
                    <button class="btn btn-success" onclick="adminManager.approveEvent('${event._id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-error" onclick="adminManager.rejectEvent('${event._id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    <button class="btn btn-outline" onclick="adminManager.viewEventDetails('${event._id}')">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </div>
            </div>
        `;
    }

    createUserItem(user) {
        return `
            <div class="user-item">
                <img src="https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop" 
                     alt="${user.name}" class="user-avatar">
                <div class="user-info">
                    <div class="user-name">${user.name}</div>
                    <div class="user-details">
                        ${user.email} • ${user.department}
                        ${user.year ? ` • Year ${user.year}` : ''}
                    </div>
                    <div class="user-clubs">
                        Clubs: ${user.clubs ? user.clubs.length : 0}
                    </div>
                </div>
                <span class="user-role ${user.role}">${this.formatRole(user.role)}</span>
            </div>
        `;
    }

    async approveEvent(eventId) {
        const budgetInput = prompt('Enter approved budget amount (leave empty for 0):');
        const approvedBudget = budgetInput ? parseInt(budgetInput) : 0;
        const notes = prompt('Add approval notes (optional):') || '';

        try {
            const response = await this.makeAuthenticatedRequest(`/api/events/${eventId}/approve`, {
                method: 'PATCH',
                body: JSON.stringify({
                    approvedBudget,
                    approvalNotes: notes
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Event approved successfully!', 'success');
                this.loadPendingEvents();
            } else {
                this.showMessage(data.message || 'Failed to approve event', 'error');
            }
        } catch (error) {
            console.error('Error approving event:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async rejectEvent(eventId) {
        const reason = prompt('Enter rejection reason:');
        if (!reason) return;

        try {
            const response = await this.makeAuthenticatedRequest(`/api/events/${eventId}/reject`, {
                method: 'PATCH',
                body: JSON.stringify({
                    rejectionReason: reason
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Event rejected', 'info');
                this.loadPendingEvents();
            } else {
                this.showMessage(data.message || 'Failed to reject event', 'error');
            }
        } catch (error) {
            console.error('Error rejecting event:', error);
            this.showMessage('Network error. Please try again.', 'error');
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

    getSectionTitle(sectionName) {
        const titles = {
            'dashboard': 'Admin Dashboard',
            'clubs-management': 'Clubs Management',
            'events-approval': 'Event Approvals',
            'users-management': 'Users Management',
            'reports': 'Reports & Analytics'
        };
        return titles[sectionName] || 'Admin Panel';
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

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }

    getEmptyState(message) {
        return `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>${message}</p>
            </div>
        `;
    }

    getErrorState(message) {
        return `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    showMessage(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'message-toast';
        toast.innerHTML = `
            <div class="message message-${type}">
                <i class="fas ${this.getMessageIcon(type)}"></i>
                <p>${message}</p>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
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

    showCreateClubModal() {
        this.showMessage('Create club functionality will be implemented in the next version', 'info');
    }

    viewClub(clubId) {
        window.open(`/clubs?id=${clubId}`, '_blank');
    }

    editClub(clubId) {
        this.showMessage('Edit club functionality will be implemented in the next version', 'info');
    }

    viewEventDetails(eventId) {
        window.open(`/events?id=${eventId}`, '_blank');
    }
}

// Initialize admin manager
let adminManager;
document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminManager();
});