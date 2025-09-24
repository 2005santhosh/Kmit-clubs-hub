// Events page JavaScript

class EventsManager {
    constructor() {
        this.events = [];
        this.filteredEvents = [];
        this.currentFilters = {
            status: 'all',
            type: 'all'
        };
        this.searchTerm = '';
        this.token = localStorage.getItem('authToken');
        this.init();
    }

    init() {
        this.setupAuthentication();
        this.setupFilters();
        this.setupSearch();
        this.setupModal();
        this.loadEvents();
    }

    setupAuthentication() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
            });
        }

        if (!this.token) {
            window.location.href = '/login';
        }
    }

    setupFilters() {
        const statusFilter = document.getElementById('eventStatusFilter');
        const typeFilter = document.getElementById('eventTypeFilter');

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.currentFilters.status = e.target.value;
                this.filterEvents();
            });
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.currentFilters.type = e.target.value;
                this.filterEvents();
            });
        }
    }

    setupSearch() {
        const searchInput = document.getElementById('eventSearchInput');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterEvents();
            });
        }
    }

    setupModal() {
        const modal = document.getElementById('eventModal');
        const closeBtn = modal?.querySelector('.close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    async loadEvents() {
        const eventsGrid = document.getElementById('eventsGrid');
        if (!eventsGrid) return;

        try {
            const response = await fetch('/api/events', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch events');

            this.events = await response.json();
            this.filteredEvents = [...this.events];
            this.renderEvents();
        } catch (error) {
            console.error('Error loading events:', error);
            eventsGrid.innerHTML = this.getErrorState('Failed to load events');
        }
    }

    filterEvents() {
        this.filteredEvents = this.events.filter(event => {
            const matchesStatus = this.currentFilters.status === 'all' || 
                (this.currentFilters.status === 'upcoming' ? new Date(event.date) >= new Date() : event.status === this.currentFilters.status);
            
            const matchesType = this.currentFilters.type === 'all' || event.eventType === this.currentFilters.type;
            
            const matchesSearch = this.searchTerm === '' || 
                event.title.toLowerCase().includes(this.searchTerm) ||
                event.description.toLowerCase().includes(this.searchTerm) ||
                (event.clubId && event.clubId.name.toLowerCase().includes(this.searchTerm));
            
            return matchesStatus && matchesType && matchesSearch;
        });

        this.renderEvents();
    }

    renderEvents() {
        const eventsGrid = document.getElementById('eventsGrid');
        if (!eventsGrid) return;

        if (this.filteredEvents.length === 0) {
            eventsGrid.innerHTML = this.getEmptyState('No events found matching your criteria');
            return;
        }

        eventsGrid.innerHTML = this.filteredEvents.map(event => this.createEventCard(event)).join('');
    }

    createEventCard(event) {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        const statusClass = this.getStatusClass(event.status);
        const isUpcoming = eventDate >= new Date();
        const canRegister = isUpcoming && event.status === 'approved' && !this.isUserRegistered(event);
        
        return `
            <div class="event-card" onclick="eventsManager.showEventDetails('${event._id}')">
                <div class="event-header">
                    <div class="event-info">
                        <h3 class="event-title">${event.title}</h3>
                        <p class="event-club">
                            <i class="fas fa-users"></i> 
                            ${event.clubId ? event.clubId.name : 'Unknown Club'}
                        </p>
                        <span class="event-type">${this.formatEventType(event.eventType)}</span>
                    </div>
                    <div class="event-status-container">
                        <div class="event-date-badge">
                            <div class="date-day">${eventDate.getDate()}</div>
                            <div class="date-month">${eventDate.toLocaleDateString('en-US', { month: 'short' })}</div>
                        </div>
                        <span class="event-status ${statusClass}">${event.status}</span>
                    </div>
                </div>
                
                <p class="event-description">${this.truncateText(event.description, 120)}</p>
                
                <div class="event-details">
                    <div class="event-detail-item">
                        <i class="fas fa-clock"></i>
                        <span>${event.startTime} - ${event.endTime}</span>
                    </div>
                    <div class="event-detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${event.venue}</span>
                    </div>
                    ${event.maxParticipants > 0 ? `
                        <div class="event-detail-item">
                            <i class="fas fa-user-friends"></i>
                            <span>${event.registeredParticipants.length}/${event.maxParticipants} registered</span>
                        </div>
                    ` : ''}
                </div>
                
                ${canRegister ? `
                    <div class="event-actions">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); eventsManager.registerForEvent('${event._id}')">
                            <i class="fas fa-calendar-plus"></i> Register
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async showEventDetails(eventId) {
        const modal = document.getElementById('eventModal');
        const modalTitle = document.getElementById('eventModalTitle');
        const modalContent = document.getElementById('eventModalContent');

        if (!modal || !modalContent) return;

        modal.style.display = 'block';
        modalTitle.textContent = 'Loading...';
        modalContent.innerHTML = '<div class="loading">Loading event details...</div>';

        try {
            const response = await fetch(`/api/events/${eventId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch event details');

            const event = await response.json();
            modalTitle.textContent = event.title;
            modalContent.innerHTML = this.createEventDetailsHTML(event);
        } catch (error) {
            console.error('Error loading event details:', error);
            modalContent.innerHTML = this.getErrorState('Failed to load event details');
        }
    }

    createEventDetailsHTML(event) {
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const isUpcoming = eventDate >= new Date();
        const isRegistered = this.isUserRegistered(event);
        const canRegister = isUpcoming && event.status === 'approved' && !isRegistered;
        const statusClass = this.getStatusClass(event.status);
        
        return `
            <div class="event-details">
                <div class="event-detail-header">
                    <div class="event-detail-info">
                        <h2>${event.title}</h2>
                        <p class="event-club-name">
                            <i class="fas fa-users"></i> 
                            ${event.clubId ? event.clubId.name : 'Unknown Club'}
                        </p>
                        <span class="event-status ${statusClass}">${event.status}</span>
                        <span class="event-type-badge">${this.formatEventType(event.eventType)}</span>
                    </div>
                </div>
                
                <div class="event-detail-content">
                    <div class="detail-section">
                        <h4>Description</h4>
                        <p>${event.description}</p>
                    </div>
                    
                    <div class="detail-grid">
                        <div class="detail-item">
                            <h4>Date & Time</h4>
                            <p><i class="fas fa-calendar"></i> ${formattedDate}</p>
                            <p><i class="fas fa-clock"></i> ${event.startTime} - ${event.endTime}</p>
                        </div>
                        <div class="detail-item">
                            <h4>Venue</h4>
                            <p><i class="fas fa-map-marker-alt"></i> ${event.venue}</p>
                        </div>
                        <div class="detail-item">
                            <h4>Organizer</h4>
                            <p><i class="fas fa-user"></i> ${event.organizer ? event.organizer.name : 'Unknown'}</p>
                        </div>
                        ${event.maxParticipants > 0 ? `
                            <div class="detail-item">
                                <h4>Capacity</h4>
                                <p><i class="fas fa-user-friends"></i> ${event.registeredParticipants.length}/${event.maxParticipants}</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${event.budget && event.budget.requested > 0 ? `
                        <div class="detail-section">
                            <h4>Budget Information</h4>
                            <p>Requested: ₹${event.budget.requested}</p>
                            ${event.budget.approved > 0 ? `<p>Approved: ₹${event.budget.approved}</p>` : ''}
                        </div>
                    ` : ''}
                    
                    ${event.registeredParticipants && event.registeredParticipants.length > 0 ? `
                        <div class="detail-section">
                            <h4>Registered Participants (${event.registeredParticipants.length})</h4>
                            <div class="participants-list">
                                ${event.registeredParticipants.slice(0, 10).map(participant => `
                                    <div class="participant-item">
                                        <span>${participant.userId ? participant.userId.name : 'Unknown User'}</span>
                                    </div>
                                `).join('')}
                                ${event.registeredParticipants.length > 10 ? '<p>... and more</p>' : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="event-actions">
                    ${canRegister ? `
                        <button class="btn btn-primary" onclick="eventsManager.registerForEvent('${event._id}')">
                            <i class="fas fa-calendar-plus"></i> Register for Event
                        </button>
                    ` : isRegistered ? `
                        <span class="registration-status">
                            <i class="fas fa-check-circle"></i> You are registered
                        </span>
                    ` : ''}
                    <button class="btn btn-outline" onclick="closeModal('eventModal')">Close</button>
                </div>
            </div>
        `;
    }

    async registerForEvent(eventId) {
        try {
            const response = await fetch(`/api/events/${eventId}/register`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Successfully registered for event!', 'success');
                document.getElementById('eventModal').style.display = 'none';
                this.loadEvents(); // Refresh events data
            } else {
                this.showMessage(data.message || 'Failed to register for event', 'error');
            }
        } catch (error) {
            console.error('Error registering for event:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    isUserRegistered(event) {
        if (!this.token || !event.registeredParticipants) return false;
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return event.registeredParticipants.some(participant => 
            participant.userId._id === user.id || participant.userId === user.id
        );
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

    formatEventType(type) {
        return type.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    getEmptyState(message) {
        return `
            <div class="empty-state">
                <i class="fas fa-calendar"></i>
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
}

// Initialize events manager
let eventsManager;
document.addEventListener('DOMContentLoaded', () => {
    eventsManager = new EventsManager();
});

// Add events page specific styles
const eventsStyles = document.createElement('style');
eventsStyles.textContent = `
    .events-page {
        margin-top: 80px;
        padding: var(--space-6) 0;
    }
    
    .event-filters {
        display: flex;
        gap: var(--space-4);
        margin-bottom: var(--space-6);
        background: white;
        padding: var(--space-4);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow);
        flex-wrap: wrap;
        align-items: center;
    }
    
    .filter-group {
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }
    
    .filter-group label {
        font-weight: 500;
        color: var(--gray-700);
        white-space: nowrap;
    }
    
    .filter-group select {
        min-width: 150px;
    }
    
    .event-date-badge {
        background: var(--primary-color);
        color: white;
        padding: var(--space-2);
        border-radius: var(--radius);
        text-align: center;
        min-width: 60px;
    }
    
    .date-day {
        font-size: var(--font-size-lg);
        font-weight: 700;
        line-height: 1;
    }
    
    .date-month {
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        opacity: 0.9;
    }
    
    .event-status-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
    }
    
    .event-type {
        background: var(--accent-color);
        color: white;
        padding: 0.25rem var(--space-2);
        border-radius: var(--radius);
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        font-weight: 500;
    }
    
    .event-type-badge {
        background: var(--accent-color);
        color: white;
        padding: 0.25rem var(--space-2);
        border-radius: var(--radius);
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        font-weight: 500;
        margin-left: var(--space-2);
    }
    
    .event-detail-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--gray-600);
        font-size: var(--font-size-sm);
    }
    
    .event-actions {
        margin-top: var(--space-3);
        padding-top: var(--space-3);
        border-top: 1px solid var(--gray-200);
    }
    
    .event-modal {
        max-width: 900px;
    }
    
    .event-details {
        padding: var(--space-2);
    }
    
    .event-detail-header {
        margin-bottom: var(--space-4);
    }
    
    .event-club-name {
        color: var(--accent-color);
        font-weight: 500;
        margin-bottom: var(--space-2);
    }
    
    .participants-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-2);
        max-height: 200px;
        overflow-y: auto;
    }
    
    .participant-item {
        background: var(--gray-50);
        padding: var(--space-2);
        border-radius: var(--radius);
        font-size: var(--font-size-sm);
    }
    
    .registration-status {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--success-color);
        font-weight: 500;
    }
    
    @media (max-width: 768px) {
        .event-filters {
            flex-direction: column;
            align-items: stretch;
        }
        
        .filter-group {
            justify-content: space-between;
        }
        
        .filter-group select {
            min-width: auto;
            flex: 1;
        }
        
        .event-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-3);
        }
        
        .event-status-container {
            align-self: flex-end;
        }
    }
`;
document.head.appendChild(eventsStyles);