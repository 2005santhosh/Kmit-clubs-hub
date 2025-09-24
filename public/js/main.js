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
            
            // Club data (top 3 clubs by members)
            const topClubs = [
                {
                    id: 8,
                    name: "Kreeda (Sports Club)",
                    description: "Promote sportsmanship and physical fitness through various athletic activities and competitions.",
                    members: 180,
                    image: "https://images.pexels.com/photos/845987/pexels-photo-845987.jpeg?auto=compress&cs=tinysrgb&w=800"
                },
                {
                    id: 13,
                    name: "Recurse (Technical Club)",
                    description: "Dive into the world of technology, coding, and innovation through workshops and projects.",
                    members: 130,
                    image: "https://images.pexels.com/photos/5386754/pexels-photo-5386754.jpeg?auto=compress&cs=tinysrgb&w=800"
                },
                {
                    id: 14,
                    name: "Mudra (Dance Club)",
                    description: "Express yourself through various dance forms and participate in energetic performances.",
                    members: 125,
                    image: "https://images.pexels.com/photos/2647626/pexels-photo-2647626.jpeg?auto=compress&cs=tinysrgb&w=800"
                }
            ];
            
            // Events data
            const eventsData = [
                {
                    id: 1,
                    title: "TechFest 2025",
                    description: "Annual technical festival featuring competitions, workshops, and exhibitions.",
                    date: "15 March 2025",
                    club: "Recurse (Technical Club)"
                },
                {
                    id: 2,
                    title: "Fashion Show",
                    description: "Annual showcase of latest trends and creative designs by Riti club members.",
                    date: "22 March 2025",
                    club: "Riti (Fashion Club)"
                },
                {
                    id: 3,
                    title: "Community Service Drive",
                    description: "Join NSS and StreetCause for a day of community service and social impact.",
                    date: "5 April 2025",
                    club: "NSS & StreetCause"
                }
            ];
            
            // Render top clubs
            const clubsPreview = document.getElementById('clubsPreview');
            clubsPreview.innerHTML = topClubs.map(club => `
                <div class="club-card" onclick="window.location.href='club-detail.html?id=${club.id}'">
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
            
            // Render events
            const eventsPreview = document.getElementById('eventsPreview');
            eventsPreview.innerHTML = eventsData.map(event => {
                const [day, month, year] = event.date.split(' ');
                return `
                <div class="event-card">
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