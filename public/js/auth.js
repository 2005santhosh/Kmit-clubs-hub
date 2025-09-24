// Authentication JavaScript

class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupForms();
        this.setupRoleChange();
        this.checkAuthStatus();
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const forms = document.querySelectorAll('.auth-form');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Update active tab
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Show corresponding form
                forms.forEach(form => {
                    form.classList.remove('active');
                    if (form.id === `${tabName}Form`) {
                        form.classList.add('active');
                    }
                });
            });
        });
    }

    setupForms() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Modal handling
        this.setupModal();
    }

    setupRoleChange() {
        const roleSelect = document.getElementById('registerRole');
        const studentFields = document.getElementById('studentFields');
        const studentIdField = document.getElementById('studentId');
        const yearField = document.getElementById('year');

        if (roleSelect && studentFields) {
            roleSelect.addEventListener('change', (e) => {
                if (e.target.value === 'student') {
                    studentFields.style.display = 'flex';
                    studentIdField.required = true;
                    yearField.required = true;
                } else {
                    studentFields.style.display = 'none';
                    studentIdField.required = false;
                    yearField.required = false;
                }
            });
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                this.showMessage('Login successful! Redirecting...', 'success');
                
                // Redirect based on role
                setTimeout(() => {
                    if (data.user.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/dashboard';
                    }
                }, 1000);
            } else {
                this.showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('registerName').value,
            email: document.getElementById('registerEmail').value,
            password: document.getElementById('registerPassword').value,
            role: document.getElementById('registerRole').value,
            department: document.getElementById('registerDepartment').value
        };

        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (formData.password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        if (formData.role === 'student') {
            formData.studentId = document.getElementById('studentId').value;
            formData.year = parseInt(document.getElementById('year').value);
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Store auth token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                this.showMessage('Registration successful! Redirecting...', 'success');
                
                // Redirect based on role
                setTimeout(() => {
                    if (data.user.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/dashboard';
                    }
                }, 1000);
            } else {
                this.showMessage(data.message || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        if (token) {
            // User is already logged in, redirect to dashboard
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.role === 'admin') {
                window.location.href = '/admin';
            } else {
                window.location.href = '/dashboard';
            }
        }
    }

    setupModal() {
        const modal = document.getElementById('messageModal');
        const closeBtn = modal?.querySelector('.close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    showMessage(message, type = 'info') {
        const modal = document.getElementById('messageModal');
        const messageDiv = document.getElementById('modalMessage');
        
        if (modal && messageDiv) {
            messageDiv.innerHTML = `
                <div class="message message-${type}">
                    <i class="fas ${this.getMessageIcon(type)}"></i>
                    <p>${message}</p>
                </div>
            `;
            modal.style.display = 'block';
        }
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

// Global functions
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Add message styles
const messageStyles = document.createElement('style');
messageStyles.textContent = `
    .message {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: var(--radius);
        margin-bottom: var(--space-2);
    }
    
    .message-success {
        background: var(--success-color);
        color: white;
    }
    
    .message-error {
        background: var(--error-color);
        color: white;
    }
    
    .message-warning {
        background: var(--warning-color);
        color: white;
    }
    
    .message-info {
        background: var(--info-color);
        color: white;
    }
    
    .message i {
        font-size: var(--font-size-lg);
    }
    
    .message p {
        margin: 0;
        font-weight: 500;
    }
`;
document.head.appendChild(messageStyles);