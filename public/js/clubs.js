// Mobile Navigation Toggle
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

    // DOM elements
    const clubsGrid = document.getElementById('clubsGrid');
    const clubSearch = document.getElementById('clubSearch');
    const categoryFilter = document.getElementById('categoryFilter');

    let allClubs = []; // To store fetched clubs

    // Debounce function for search input
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    // Render clubs with optimized performance
    function renderClubs(clubs) {
        // Clear existing content
        clubsGrid.innerHTML = '';
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Create and append club cards
        clubs.forEach(club => {
            const clubCard = document.createElement('div');
            clubCard.className = 'club-card fade-in';
            clubCard.onclick = () => window.location.href = `club-detail.html?id=${club._id}`;
            
            clubCard.innerHTML = `
                <div class="club-image">
                    <img src="${club.bannerImage || club.logo || 'https://via.placeholder.com/400x200?text=No+Image'}" alt="${club.name}" loading="lazy">
                </div>
                <div class="club-info">
                    <h3 class="club-name">${club.name}</h3>
                    <p class="club-description">${(club.description || '').substring(0, 150)}${(club.description && club.description.length > 150) ? '...' : ''}</p>
                    <div class="club-members">
                        <i class="fas fa-users"></i> ${club.members ? club.members.length : 0}+ Members
                    </div>
                </div>
            `;
            
            fragment.appendChild(clubCard);
        });
        
        // Append all cards at once
        clubsGrid.appendChild(fragment);
        
        // Initialize fade-in animation for new elements
        setTimeout(() => {
            document.querySelectorAll('.fade-in').forEach(el => {
                observer.observe(el);
            });
        }, 100);
    }
    
    // Filter clubs with debounced search
    const filterClubs = debounce(function() {
        const searchTerm = clubSearch.value.toLowerCase();
        const category = categoryFilter.value;
        
        const filteredClubs = allClubs.filter(club => {
            const matchesSearch = club.name.toLowerCase().includes(searchTerm) || 
                                 (club.description || '').toLowerCase().includes(searchTerm);
            // Assume backend has 'category' field; fallback to 'type' if not
            const clubCategory = club.category || club.type || 'general';
            const matchesCategory = category === 'all' || clubCategory === category;
            
            return matchesSearch && matchesCategory;
        });
        
        renderClubs(filteredClubs);
    }, 300);
    
    // Event listeners
    clubSearch.addEventListener('input', filterClubs);
    categoryFilter.addEventListener('change', filterClubs);

    // Function to load clubs from backend
    async function loadClubs() {
        try {
            const response = await fetch('/api/clubs');
            if (!response.ok) {
                throw new Error('Failed to fetch clubs');
            }
            const clubs = await response.json();
            allClubs = clubs; // Store for filtering
            renderClubs(allClubs); // Initial render
        } catch (error) {
            console.error('Error loading clubs:', error);
            clubsGrid.innerHTML = '<div class="error">Failed to load clubs. Please try again later.</div>';
        }
    }

    // Load real data on page load
    loadClubs();
    
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
    
    // Observe initial fade-in elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
});