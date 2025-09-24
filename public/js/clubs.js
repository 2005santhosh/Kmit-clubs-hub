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
            
            // All clubs data
            const clubsData = [
                {
                    id: 1,
                    name: "Riti (Fashion Club)",
                    description: "Explore the world of fashion, design, and style with creative workshops and shows.",
                    members: 95,
                    category: "cultural",
                    image: "https://images.pexels.com/photos/298863/pexels-photo-298863.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 2,
                    name: "NSS (Social Service Club)",
                    description: "Engage in community service and social welfare activities to make a positive impact.",
                    members: 150,
                    category: "social",
                    image: "https://images.pexels.com/photos/6646904/pexels-photo-6646904.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 3,
                    name: "StreetCause (Social Impact)",
                    description: "Drive social change through innovative projects and community initiatives.",
                    members: 75,
                    category: "social",
                    image: "https://images.pexels.com/photos/4145350/pexels-photo-4145350.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 4,
                    name: "Rotaract (Community Service)",
                    description: "Part of a global organization dedicated to community service and leadership development.",
                    members: 110,
                    category: "social",
                    image: "https://images.pexels.com/photos/853489/pexels-photo-853489.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 5,
                    name: "Kaivalya (Yoga Club)",
                    description: "Promote physical and mental well-being through yoga and meditation practices.",
                    members: 65,
                    category: "cultural",
                    image: "https://images.pexels.com/photos/3822920/pexels-photo-3822920.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 6,
                    name: "PR (Public Relations)",
                    description: "Develop communication skills and manage public image for college events and activities.",
                    members: 55,
                    category: "technical",
                    image: "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 7,
                    name: "OC (Organising Committee)",
                    description: "Plan and execute college events, fests, and programs with precision and creativity.",
                    members: 120,
                    category: "technical",
                    image: "https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 8,
                    name: "Kreeda (Sports Club)",
                    description: "Promote sportsmanship and physical fitness through various athletic activities and competitions.",
                    members: 180,
                    category: "sports",
                    image: "https://images.pexels.com/photos/845987/pexels-photo-845987.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 9,
                    name: "Abhinaya (Drama Club)",
                    description: "Express creativity through theatrical performances and acting workshops.",
                    members: 70,
                    category: "cultural",
                    image: "https://images.pexels.com/photos/2647626/pexels-photo-2647626.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 10,
                    name: "Vachan (Speakers Club)",
                    description: "Enhance public speaking, debating, and presentation skills through regular practice.",
                    members: 85,
                    category: "cultural",
                    image: "https://images.pexels.com/photos/5386754/pexels-photo-5386754.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 11,
                    name: "TOL (Traces of Lens)",
                    description: "Capture moments and express creativity through the art of photography.",
                    members: 90,
                    category: "arts",
                    image: "https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 12,
                    name: "Aakarshan (Arts Club)",
                    description: "Explore various art forms and express creativity through painting, crafts, and design.",
                    members: 100,
                    category: "arts",
                    image: "https://images.pexels.com/photos/1560932/pexels-photo-1560932.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 13,
                    name: "Recurse (Technical Club)",
                    description: "Dive into the world of technology, coding, and innovation through workshops and projects.",
                    members: 130,
                    category: "technical",
                    image: "https://images.pexels.com/photos/5386754/pexels-photo-5386754.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 14,
                    name: "Mudra (Dance Club)",
                    description: "Express yourself through various dance forms and participate in energetic performances.",
                    members: 125,
                    category: "cultural",
                    image: "https://images.pexels.com/photos/2647626/pexels-photo-2647626.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 15,
                    name: "Aalap (Singing Club)",
                    description: "Nurture vocal talents and explore various genres of music through singing sessions.",
                    members: 80,
                    category: "cultural",
                    image: "https://images.pexels.com/photos/1646931/pexels-photo-1646931.jpeg?auto=compress&cs=tinysrgb&w=500"
                },
                {
                    id: 16,
                    name: "Kmitra (Magazine Club)",
                    description: "Develop writing, editing, and publishing skills while creating the college magazine.",
                    members: 60,
                    category: "arts",
                    image: "https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=500"
                }
            ];
            
            // DOM elements
            const clubsGrid = document.getElementById('clubsGrid');
            const clubSearch = document.getElementById('clubSearch');
            const categoryFilter = document.getElementById('categoryFilter');
            
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
                    clubCard.onclick = () => window.location.href = `clubs_detail.html?id=${club.id}`;
                    
                    clubCard.innerHTML = `
                        <div class="club-image">
                            <img src="${club.image}" alt="${club.name}" loading="lazy">
                        </div>
                        <div class="club-info">
                            <h3 class="club-name">${club.name}</h3>
                            <p class="club-description">${club.description}</p>
                            <div class="club-members">
                                <i class="fas fa-users"></i> ${club.members}+ Members
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
                
                const filteredClubs = clubsData.filter(club => {
                    const matchesSearch = club.name.toLowerCase().includes(searchTerm) || 
                                         club.description.toLowerCase().includes(searchTerm);
                    const matchesCategory = category === 'all' || club.category === category;
                    
                    return matchesSearch && matchesCategory;
                });
                
                renderClubs(filteredClubs);
            }, 300);
            
            // Event listeners
            clubSearch.addEventListener('input', filterClubs);
            categoryFilter.addEventListener('change', filterClubs);
            
            // Initial render with a small delay to ensure DOM is ready
            setTimeout(() => {
                renderClubs(clubsData);
            }, 100);
            
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