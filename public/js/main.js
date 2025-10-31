document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
    
    // Active navigation link based on scroll position
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= sectionTop - 250) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });

    // Function to load top clubs from backend
    async function loadClubs() {
        try {
            const response = await fetch('/api/clubs');
            if (!response.ok) {
                throw new Error('Failed to fetch clubs');
            }
            const clubs = await response.json();

            // Sort by members count descending, take top 3
            const topClubs = clubs
                .sort((a, b) => (b.members ? b.members.length : 0) - (a.members ? a.members.length : 0))
                .slice(0, 3);

            // Format for display
            const formattedClubs = topClubs.map(club => ({
                id: club._id,
                name: club.name,
                description: (club.description || '').substring(0, 100) + '...',
                members: club.members ? club.members.length : 0,
                image: club.bannerImage || club.logo || 'https://via.placeholder.com/400x220?text=No+Image'
            }));

            // Render
            const clubsPreview = document.getElementById('clubsPreview');
            clubsPreview.innerHTML = formattedClubs.map(club => `
                <div class="club-card" onclick="window.location.href='clubs_detail.html?id=${club.id}'">
                    <div class="club-image">
                        <img src="${club.image}" alt="${club.name}">
                    </div>
                    <div class="club-info">
                        <h3 class="club-name">${club.name}</h3>
                        <p class="club-description">${club.description}</p>
                        <div class="club-members">
                            <i class="fas fa-users"></i> ${club.members}+ Members
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading clubs:', error);
            const clubsPreview = document.getElementById('clubsPreview');
            clubsPreview.innerHTML = '<div class="error">Failed to load clubs. Please try again later.</div>';
        }
    }

    // Function to load upcoming events from backend
    async function loadEvents() {
        try {
            const response = await fetch('/api/events');
            if (!response.ok) {
                throw new Error('Failed to fetch events');
            }
            const events = await response.json();

            // Filter upcoming events (use current date dynamically)
            const now = new Date();
            const upcoming = events
                .filter(event => new Date(event.date) > now)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(0, 3);

            // Format for display
            const formattedEvents = upcoming.map(event => ({
                id: event._id,
                title: event.title,
                description: (event.description || '').substring(0, 100) + '...',
                date: event.date,
                club: event.clubId ? event.clubId.name : 'Unknown Club'
            }));

            // Render
            const eventsPreview = document.getElementById('eventsPreview');
            eventsPreview.innerHTML = formattedEvents.map(event => {
                const eventDate = new Date(event.date);
                const day = eventDate.getDate();
                const month = eventDate.toLocaleString('default', { month: 'long' });
                return `
                    <div class="event-card" onclick="window.location.href='event-details.html?id=${event.id}'">
                        <div class="event-date">
                            <div class="event-day">${day}</div>
                            <div class="event-month">${month}</div>
                        </div>
                        <div class="event-info">
                            <h3 class="event-title">${event.title}</h3>
                            <p class="event-description">${event.description}</p>
                            <div class="event-club">
                                <i class="fas fa-users"></i> ${event.club}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error loading events:', error);
            const eventsPreview = document.getElementById('eventsPreview');
            eventsPreview.innerHTML = '<div class="error">Failed to load events. Please try again later.</div>';
        }
    }
    
    // Load real data on page load
    loadClubs();
    loadEvents();
    
    // Scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
    
    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
});