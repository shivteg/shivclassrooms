/**
 * shivclassroom - Main Application Controller
 * Handles Supabase database connections, user sessions, unified dashboard mode toggles,
 * real-time feedback listeners, and AI Report generation.
 */

class ShivClassroomApp {
    constructor() {
        this.supabase = null;
        this.currentUser = JSON.parse(localStorage.getItem('shivclassroom_user') || 'null');
        this.isPlaceholderConfig = true;
        
        // Active states
        this.activeClassroom = null; // Currently viewed classroom
        this.recentClassrooms = JSON.parse(localStorage.getItem('student_recent_classes') || '[]');
        this.realtimeChannel = null; // Listener subscription
        
        // Emoji counts for teacher dashboard
        this.emojiCounts = { '😎': 0, '🤔': 0, '🤯': 0, '😴': 0, '🙋‍♂️': 0 };

        // Seed Roster Storage
        this.initDefaultRosters();

        // Bind event listeners on page load
        window.addEventListener('DOMContentLoaded', () => this.init());
    }

    initDefaultRosters() {
        if (!localStorage.getItem('shivclassroom_school_roster')) {
            const initialRoster = [
                { name: 'Shivteg', email: 'shivteg@admin.com', role: 'super_admin', dept: 'System Super Admin' },
                { name: 'Dr. Sarah', email: 'admin@school.edu', role: 'school_admin', dept: 'Main Campus Admin' },
                { name: 'Prof. Oak', email: 'teacher@school.edu', role: 'teacher', dept: 'Biology Dept' },
                { name: 'Mrs. Davis', email: 'davis@school.edu', role: 'teacher', dept: 'Math Dept' },
                { name: 'Alex Johnson', email: 'student@school.edu', role: 'student', dept: 'Grade 6' },
                { name: 'Emma Watson', email: 'emma@school.edu', role: 'student', dept: 'Grade 6' },
                { name: 'Leo Smith', email: 'leo@school.edu', role: 'student', dept: 'Grade 7' }
            ];
            localStorage.setItem('shivclassroom_school_roster', JSON.stringify(initialRoster));
        }

        if (!localStorage.getItem('shivclassroom_teacher_students')) {
            const initialTeacherStudents = [
                { name: 'Alex Johnson', email: 'student@school.edu', grade: 'Grade 6B' },
                { name: 'Emma Watson', email: 'emma@school.edu', grade: 'Grade 6B' },
                { name: 'Leo Smith', email: 'leo@school.edu', grade: 'Grade 7A' }
            ];
            localStorage.setItem('shivclassroom_teacher_students', JSON.stringify(initialTeacherStudents));
        }
    }

    // 1. INITIALIZATION & SETUP
    async init() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupDashboardToggle();
        
        // Load database configuration
        this.loadDatabaseConfig();
        
        // Auto-authenticate or direct to Auth Screen
        await this.checkSession();
        lucide.createIcons();
    }

    setupTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        this.updateThemeIcon(currentTheme);

        themeToggle.addEventListener('click', () => {
            const nextTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('theme', nextTheme);
            this.updateThemeIcon(nextTheme);
        });
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('#theme-toggle i');
        if (icon) {
            icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
            lucide.createIcons();
        }
    }

    loadDatabaseConfig() {
        // Load from config.js
        let url = window.SHIVCLASSROOM_CONFIG?.SUPABASE_URL;
        let anonKey = window.SHIVCLASSROOM_CONFIG?.SUPABASE_ANON_KEY;
        
        const isPlaceholder = (u, k) => {
            return !u || !k || u.includes("your-project") || k === "your-anon-key";
        };

        // Fallback to localStorage if config.js is not configured
        if (isPlaceholder(url, anonKey)) {
            const localUrl = localStorage.getItem('supabase_url');
            const localKey = localStorage.getItem('supabase_anon_key');
            if (localUrl && localKey) {
                url = localUrl;
                anonKey = localKey;
            }
        }

        if (url && anonKey) {
            try {
                this.supabase = window.supabase.createClient(url, anonKey);
                this.isPlaceholderConfig = isPlaceholder(url, anonKey);
                return true;
            } catch (e) {
                console.error("Supabase initialization error:", e);
                return false;
            }
        }
        return false;
    }

    async checkSession() {
        if (this.currentUser) {
            this.updateUserUI();
            this.navigateHome();
            return;
        }

        this.showView('view-loading');
        
        // If config is placeholder, redirect directly to Auth
        if (this.isPlaceholderConfig) {
            setTimeout(() => {
                this.showView('view-auth');
            }, 400);
            return;
        }

        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            if (error) throw error;

            if (session) {
                const userEmail = session.user.email;
                let userRole = 'student';

                try {
                    const { data: profile } = await this.supabase
                        .from('profiles')
                        .select('role, username')
                        .eq('id', session.user.id)
                        .single();
                    if (profile && profile.role) {
                        userRole = profile.role;
                    }
                } catch (pe) {
                    console.warn("Using fallback metadata/email heuristics for role:", pe);
                }

                if (!userRole || userRole === 'student') {
                    if (userEmail.toLowerCase().includes('shivteg') || userEmail.toLowerCase().includes('superadmin')) userRole = 'super_admin';
                    else if (userEmail.toLowerCase().includes('school')) userRole = 'school_admin';
                    else if (userEmail.toLowerCase().includes('teacher')) userRole = 'teacher';
                    else if (session.user.user_metadata?.role) userRole = session.user.user_metadata.role;
                }

                this.currentUser = {
                    id: session.user.id,
                    email: userEmail,
                    role: userRole,
                    name: session.user.user_metadata?.name || userEmail.split('@')[0]
                };
                localStorage.setItem('shivclassroom_user', JSON.stringify(this.currentUser));
                this.updateUserUI();
                this.navigateHome();
            } else {
                this.showView('view-auth');
            }
        } catch (e) {
            console.error("Session check failed:", e);
            this.showView('view-auth');
        }
    }

    quickLogin(role) {
        const roleUsers = {
            super_admin: { id: 'sa-shivteg', email: 'shivteg@admin.com', name: 'Shivteg (Super Admin)', role: 'super_admin' },
            school_admin: { id: 'sa-school', email: 'admin@school.edu', name: 'Dr. Sarah (School Admin)', role: 'school_admin' },
            teacher: { id: 'teacher-1', email: 'teacher@school.edu', name: 'Prof. Oak (Teacher)', role: 'teacher' },
            student: { id: 'student-1', email: 'student@school.edu', name: 'Alex Johnson (Student)', role: 'student' }
        };

        this.currentUser = roleUsers[role] || roleUsers.student;
        localStorage.setItem('shivclassroom_user', JSON.stringify(this.currentUser));
        this.updateUserUI();
        this.toast('success', `Signed in as ${this.currentUser.name}`);
        this.navigateHome();
    }

    updateUserUI() {
        const userMenu = document.getElementById('user-menu');
        const emailDisplay = document.getElementById('user-email-display');
        const roleBadge = document.getElementById('user-role-badge');

        if (this.currentUser) {
            userMenu.classList.remove('hidden');
            emailDisplay.textContent = this.currentUser.email;

            const roleLabels = {
                super_admin: '👑 Super Admin (Shivteg)',
                school_admin: '🏛️ School Admin',
                teacher: '🎓 Teacher',
                student: '🎒 Student'
            };
            if (roleBadge) {
                roleBadge.textContent = roleLabels[this.currentUser.role] || '🎒 Student';
            }
        } else {
            userMenu.classList.add('hidden');
        }
    }

    // 2. ROUTING & VIEWS CONTROLLER
    showView(viewId) {
        document.querySelectorAll('.view-section').forEach(view => {
            view.classList.add('hidden');
            view.classList.remove('active');
        });
        const activeView = document.getElementById(viewId);
        if (activeView) {
            activeView.classList.remove('hidden');
            activeView.classList.add('active');
        }
        lucide.createIcons();
    }

    setupDashboardToggle() {
        const buttons = {
            superadmin: document.getElementById('btn-mode-superadmin'),
            schooladmin: document.getElementById('btn-mode-schooladmin'),
            teacher: document.getElementById('btn-mode-teacher'),
            student: document.getElementById('btn-mode-student')
        };

        const panels = {
            superadmin: document.getElementById('panel-superadmin'),
            schooladmin: document.getElementById('panel-schooladmin'),
            teacher: document.getElementById('panel-teacher'),
            student: document.getElementById('panel-student')
        };

        const switchTab = (modeKey) => {
            Object.keys(buttons).forEach(k => {
                if (buttons[k]) buttons[k].classList.remove('active');
                if (panels[k]) panels[k].classList.add('hidden');
            });

            if (buttons[modeKey]) buttons[modeKey].classList.add('active');
            if (panels[modeKey]) panels[modeKey].classList.remove('hidden');

            if (modeKey === 'superadmin') this.loadSuperAdminPanel();
            if (modeKey === 'schooladmin') this.loadSchoolAdminRoster();
            if (modeKey === 'teacher') {
                this.loadTeacherClassrooms();
                this.loadTeacherStudentRoster();
            }
            if (modeKey === 'student') this.loadStudentRecentClasses();
        };

        if (buttons.superadmin) buttons.superadmin.addEventListener('click', () => switchTab('superadmin'));
        if (buttons.schooladmin) buttons.schooladmin.addEventListener('click', () => switchTab('schooladmin'));
        if (buttons.teacher) buttons.teacher.addEventListener('click', () => switchTab('teacher'));
        if (buttons.student) buttons.student.addEventListener('click', () => switchTab('student'));
    }

    applyRolePermissions() {
        if (!this.currentUser) return;

        const role = this.currentUser.role || 'student';
        const toggleWrapper = document.getElementById('dashboard-toggle-wrapper');
        const studentBanner = document.getElementById('student-notice-header');
        
        const btnSuper = document.getElementById('btn-mode-superadmin');
        const btnSchool = document.getElementById('btn-mode-schooladmin');
        const btnTeacher = document.getElementById('btn-mode-teacher');
        const btnStudent = document.getElementById('btn-mode-student');

        const panels = {
            superadmin: document.getElementById('panel-superadmin'),
            schooladmin: document.getElementById('panel-schooladmin'),
            teacher: document.getElementById('panel-teacher'),
            student: document.getElementById('panel-student')
        };

        // Reset visibility
        [btnSuper, btnSchool, btnTeacher, btnStudent].forEach(b => b && b.classList.add('hidden'));
        Object.values(panels).forEach(p => p && p.classList.add('hidden'));

        if (role === 'student') {
            // Students get NO management dashboard toggle!
            if (toggleWrapper) toggleWrapper.classList.add('hidden');
            if (studentBanner) studentBanner.classList.remove('hidden');
            if (panels.student) panels.student.classList.remove('hidden');
            this.loadStudentRecentClasses();
        } else {
            if (toggleWrapper) toggleWrapper.classList.remove('hidden');
            if (studentBanner) studentBanner.classList.add('hidden');

            if (role === 'teacher') {
                if (btnTeacher) btnTeacher.classList.remove('hidden');
                if (btnStudent) btnStudent.classList.remove('hidden');
                if (btnTeacher) btnTeacher.classList.add('active');
                if (btnStudent) btnStudent.classList.remove('active');
                if (panels.teacher) panels.teacher.classList.remove('hidden');
                this.loadTeacherClassrooms();
                this.loadTeacherStudentRoster();
            } else if (role === 'school_admin') {
                if (btnSchool) btnSchool.classList.remove('hidden');
                if (btnTeacher) btnTeacher.classList.remove('hidden');
                if (btnStudent) btnStudent.classList.remove('hidden');
                if (btnSchool) btnSchool.classList.add('active');
                if (panels.schooladmin) panels.schooladmin.classList.remove('hidden');
                this.loadSchoolAdminRoster();
            } else if (role === 'super_admin') {
                if (btnSuper) btnSuper.classList.remove('hidden');
                if (btnSchool) btnSchool.classList.remove('hidden');
                if (btnTeacher) btnTeacher.classList.remove('hidden');
                if (btnStudent) btnStudent.classList.remove('hidden');
                if (btnSuper) btnSuper.classList.add('active');
                if (panels.superadmin) panels.superadmin.classList.remove('hidden');
                this.loadSuperAdminPanel();
            }
        }
        lucide.createIcons();
    }

    navigateHome() {
        if (!this.currentUser) {
            this.showView('view-auth');
            return;
        }

        this.unsubscribeRealtime();
        this.showView('view-dashboard');
        this.applyRolePermissions();
    }

    // 3. TOAST NOTIFICATIONS
    toast(type, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'error') iconName = 'alert-triangle';

        toast.innerHTML = `
            <i data-lucide="${iconName}" class="toast-icon"></i>
            <div class="toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        lucide.createIcons();

        // Animate out and remove
        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 5000);
    }

    // 4. EVENT LISTENERS BINDING
    setupEventListeners() {
        // Auth Tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                
                e.target.classList.add('active');
                const formId = `${e.target.dataset.tab}-form`;
                document.getElementById(formId).classList.add('active');
            });
        });

        // Authentication Forms Submission
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form').addEventListener('submit', (e) => this.handleSignup(e));
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Teacher Actions
        document.getElementById('create-class-form').addEventListener('submit', (e) => this.handleCreateClass(e));
        document.getElementById('generate-code-btn').addEventListener('click', () => {
            document.getElementById('create-class-code').value = this.generateRandomCode();
        });
        document.getElementById('reset-class-btn').addEventListener('click', () => this.handleResetClassroom());

        // Student Actions
        document.getElementById('join-class-form').addEventListener('submit', (e) => this.handleJoinClass(e));

        // Emoji Feedback buttons click
        document.querySelectorAll('.emoji-feedback-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const emoji = button.dataset.emoji;
                this.handleSendFeedback(emoji, button);
            });
        });

        // AI Reporting
        document.getElementById('generate-ai-report-btn').addEventListener('click', () => this.generateAIReport());
        document.getElementById('regenerate-ai-report-btn').addEventListener('click', () => this.generateAIReport());
        
        document.getElementById('ai-settings-btn').addEventListener('click', () => {
            const modal = document.getElementById('ai-settings-modal');
            const keyInput = document.getElementById('gemini-api-key');
            keyInput.value = localStorage.getItem('gemini_api_key') || '';
            modal.classList.remove('hidden');
        });

        document.getElementById('close-ai-modal-btn').addEventListener('click', () => {
            document.getElementById('ai-settings-modal').classList.add('hidden');
        });

        document.getElementById('ai-settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const key = document.getElementById('gemini-api-key').value.trim();
            if (key) {
                localStorage.setItem('gemini_api_key', key);
                this.toast('success', 'Gemini API Key saved successfully.');
            } else {
                localStorage.removeItem('gemini_api_key');
                this.toast('info', 'AI configured to run locally (heuristic model).');
            }
            document.getElementById('ai-settings-modal').classList.add('hidden');
        });

        document.getElementById('clear-ai-key-btn').addEventListener('click', () => {
            document.getElementById('gemini-api-key').value = '';
            localStorage.removeItem('gemini_api_key');
            this.toast('info', 'Gemini API Key removed. Local analysis mode active.');
        });
        
        // Copy share link button
        document.getElementById('copy-code-btn').addEventListener('click', () => {
            if (this.activeClassroom) {
                navigator.clipboard.writeText(this.activeClassroom.code);
                this.toast('success', 'Classroom code copied to clipboard!');
            }
        });
    }

    // 5. AUTHENTICATION LOGIC
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;

        this.toast('info', 'Logging you in...');

        const roleFallbacks = {
            'shivteg@admin.com': { id: 'sa-shivteg', email: 'shivteg@admin.com', password: 'teg2172014', name: 'Shivteg (Super Admin)', role: 'super_admin' },
            'admin@school.edu': { id: 'sa-school', email: 'admin@school.edu', password: 'SchoolAdmin123!', name: 'Dr. Sarah (School Admin)', role: 'school_admin' },
            'teacher@school.edu': { id: 'teacher-1', email: 'teacher@school.edu', password: 'Teacher123!', name: 'Prof. Oak (Teacher)', role: 'teacher' },
            'student@school.edu': { id: 'student-1', email: 'student@school.edu', password: 'Student123!', name: 'Alex Johnson (Student)', role: 'student' }
        };

        // Check if user exists in Super Admin created local roster
        const roster = JSON.parse(localStorage.getItem('shivclassroom_school_roster') || '[]');
        const rosterMatch = roster.find(u => u.email.toLowerCase() === email);

        if (this.isPlaceholderConfig || !this.supabase) {
            if (email === 'shivteg@admin.com') {
                if (password !== 'teg2172014') {
                    this.toast('error', 'Invalid password for Super Admin shivteg@admin.com.');
                    return;
                }
                this.currentUser = roleFallbacks[email];
            } else if (rosterMatch) {
                if (rosterMatch.password && rosterMatch.password !== password) {
                    this.toast('error', 'Invalid password for this account.');
                    return;
                }
                this.currentUser = { id: 'user-' + Date.now(), email: rosterMatch.email, name: rosterMatch.name, role: rosterMatch.role };
            } else if (roleFallbacks[email]) {
                this.currentUser = roleFallbacks[email];
            } else {
                // Public unregistered emails default to student role
                this.currentUser = { id: 'user-' + Date.now(), email, name: email.split('@')[0], role: 'student' };
            }
            localStorage.setItem('shivclassroom_user', JSON.stringify(this.currentUser));
            this.toast('success', `Signed in as ${this.currentUser.name}`);
            this.updateUserUI();
            this.navigateHome();
            return;
        }

        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            this.currentUser = data.user;
            this.toast('success', 'Welcome back!');
            this.updateUserUI();
            this.navigateHome();
        } catch (err) {
            if (email === 'shivteg@admin.com' && password === 'teg2172014') {
                this.currentUser = roleFallbacks[email];
                localStorage.setItem('shivclassroom_user', JSON.stringify(this.currentUser));
                this.toast('success', `Signed in as ${this.currentUser.name}`);
                this.updateUserUI();
                this.navigateHome();
            } else if (rosterMatch && (!rosterMatch.password || rosterMatch.password === password)) {
                this.currentUser = { id: 'user-' + Date.now(), email: rosterMatch.email, name: rosterMatch.name, role: rosterMatch.role };
                localStorage.setItem('shivclassroom_user', JSON.stringify(this.currentUser));
                this.toast('success', `Signed in as ${this.currentUser.name}`);
                this.updateUserUI();
                this.navigateHome();
            } else {
                this.toast('error', err.message || 'Log in failed. Invalid credentials.');
            }
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        
        if (this.isPlaceholderConfig) {
            this.toast('error', 'Cannot connect to database. Please fill in your actual credentials in "config.js" in the root directory.');
            return;
        }

        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const roleSelect = document.getElementById('signup-role');
        const role = roleSelect ? roleSelect.value : 'student';

        this.toast('info', 'Creating secure account...');

        try {
            const redirectUrl = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
                ? window.location.origin
                : 'https://shivclassrooms.vercel.app/';

            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: redirectUrl,
                    data: {
                        role: role,
                        username: email.split('@')[0]
                    }
                }
            });

            if (error) throw error;

            if (data.session) {
                this.currentUser = {
                    id: data.user.id,
                    email: email,
                    role: role,
                    name: email.split('@')[0]
                };
                localStorage.setItem('shivclassroom_user', JSON.stringify(this.currentUser));
                this.updateUserUI();
                this.navigateHome();
                this.toast('success', 'Signup successful! Welcome to shivclassroom.');
            } else {
                document.getElementById('verify-email-display').textContent = email;
                this.showView('view-verify-email');
                this.toast('success', 'Signup successful! Verification email sent.');
            }
        } catch (e) {
            this.toast('error', e.message || 'Registration failed.');
        }
    }

    async handleLogout() {
        try {
            await this.supabase.auth.signOut();
            this.currentUser = null;
            this.activeClassroom = null;
            this.updateUserUI();
            this.showView('view-auth');
            this.toast('info', 'Logged out. See you next time!');
        } catch (e) {
            this.toast('error', 'Logout failed.');
        }
    }

    generateUUID() {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 6. TEACHER ACTIONS & CLASSROOM CREATION
    async handleCreateClass(e) {
        e.preventDefault();
        const name = document.getElementById('create-class-name').value.trim();
        const code = document.getElementById('create-class-code').value.trim().toUpperCase();

        if (!this.currentUser) return;

        // Ensure teacher ID is a valid UUID
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.currentUser.id);
        const teacherId = isValidUUID ? this.currentUser.id : this.generateUUID();

        const newClassroom = {
            id: this.generateUUID(),
            name,
            code,
            teacher_id: teacherId,
            created_at: new Date().toISOString()
        };

        let supabaseSuccess = false;

        if (this.supabase && !this.isPlaceholderConfig) {
            try {
                const { data, error } = await this.supabase
                    .from('classrooms')
                    .insert({
                        name,
                        code,
                        teacher_id: teacherId
                    })
                    .select()
                    .single();

                if (!error && data) {
                    supabaseSuccess = true;
                    newClassroom.id = data.id;
                } else if (error && error.code === '23505') {
                    this.toast('error', 'This Classroom Code is already taken. Please choose another.');
                    return;
                }
            } catch (err) {
                console.warn("Supabase classroom insert failed, saving to local state:", err);
            }
        }

        // Always save to local state as fallback
        let localClasses = JSON.parse(localStorage.getItem('shivclassroom_local_classes') || '[]');
        if (localClasses.some(c => c.code === code)) {
            this.toast('error', 'This Classroom Code is already taken. Please choose another.');
            return;
        }

        localClasses.unshift(newClassroom);
        localStorage.setItem('shivclassroom_local_classes', JSON.stringify(localClasses));

        this.toast('success', `Classroom "${name}" created successfully!`);
        document.getElementById('create-class-form').reset();
        
        // Celebrate with confetti!
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        this.loadTeacherClassrooms();
    }

    async loadTeacherClassrooms() {
        let remoteClasses = [];
        let localClasses = JSON.parse(localStorage.getItem('shivclassroom_local_classes') || '[]');

        if (this.supabase && !this.isPlaceholderConfig && this.currentUser) {
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.currentUser.id);
            if (isValidUUID) {
                try {
                    const { data, error } = await this.supabase
                        .from('classrooms')
                        .select('*')
                        .eq('teacher_id', this.currentUser.id)
                        .order('created_at', { ascending: false });

                    if (!error && data) {
                        remoteClasses = data;
                    }
                } catch (e) {
                    console.warn("Could not load classrooms from Supabase, loading local classes:", e);
                }
            }
        }

        // Merge remote and local classrooms without duplicates
        const combined = [...remoteClasses];
        localClasses.forEach(lc => {
            if (!combined.some(rc => rc.code === lc.code)) {
                combined.push(lc);
            }
        });

        const emptyState = document.getElementById('teacher-classes-empty');
        const listGrid = document.getElementById('teacher-classes-list');

        if (!combined || combined.length === 0) {
            emptyState.classList.remove('hidden');
            listGrid.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            listGrid.classList.remove('hidden');
            
            listGrid.innerHTML = '';
            combined.forEach(classroom => {
                const card = document.createElement('div');
                card.className = 'class-card';
                card.innerHTML = `
                    <div class="class-card-header">
                        <h4>${classroom.name}</h4>
                        <span class="code">Code: ${classroom.code}</span>
                    </div>
                    <div class="class-card-footer">
                        <span><i data-lucide="calendar"></i> ${new Date(classroom.created_at).toLocaleDateString()}</span>
                        <span class="btn-text">Open Dashboard →</span>
                    </div>
                `;
                card.addEventListener('click', () => this.openTeacherClassroom(classroom));
                listGrid.appendChild(card);
            });
            lucide.createIcons();
        }
    }

    async openTeacherClassroom(classroom) {
        this.activeClassroom = classroom;
        
        // Update dashboard details
        document.getElementById('teacher-class-name-display').textContent = classroom.name;
        document.getElementById('teacher-class-code-badge').textContent = classroom.code;
        
        this.showView('view-teacher-class');
        
        // Fetch current responses
        await this.fetchClassroomResponses();
        
        // Subscribe to real-time additions/deletions
        this.subscribeRealtime();
    }

    async fetchClassroomResponses() {
        if (!this.activeClassroom) return;
        
        try {
            const { data, error } = await this.supabase
                .from('emoji_responses')
                .select('emoji')
                .eq('classroom_id', this.activeClassroom.id);

            if (error) throw error;

            // Reset counts
            this.emojiCounts = { '😎': 0, '🤔': 0, '🤯': 0, '😴': 0, '🙋‍♂️': 0 };
            
            if (data) {
                data.forEach(resp => {
                    if (this.emojiCounts[resp.emoji] !== undefined) {
                        this.emojiCounts[resp.emoji]++;
                    }
                });
            }
            
            this.updateAnalyticsUI();
        } catch (e) {
            console.error("Error fetching responses:", e);
            this.toast('error', 'Failed to retrieve responses.');
        }
    }

    updateAnalyticsUI() {
        const total = Object.values(this.emojiCounts).reduce((a, b) => a + b, 0);
        document.getElementById('total-response-counter').textContent = total;

        for (const [emoji, count] of Object.entries(this.emojiCounts)) {
            const countEl = document.getElementById(`count-${emoji}`);
            const percentEl = document.getElementById(`percent-${emoji}`);
            const progressEl = document.querySelector(`.progress-${emoji}`);
            
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            
            countEl.textContent = count;
            percentEl.textContent = `${percent}%`;
            progressEl.style.width = `${percent}%`;
        }

        // Hide AI report view if counts change, requiring a fresh generation
        if (total === 0) {
            document.getElementById('ai-report-empty').classList.remove('hidden');
            document.getElementById('ai-report-content-view').classList.add('hidden');
        }
    }

    async handleResetClassroom() {
        if (!this.activeClassroom) return;
        if (!confirm('Are you sure you want to reset this classroom session? This deletes all current emoji responses.')) return;

        try {
            const { error } = await this.supabase
                .from('emoji_responses')
                .delete()
                .eq('classroom_id', this.activeClassroom.id);

            if (error) throw error;

            this.toast('success', 'Classroom check-in reset!');
            this.emojiCounts = { '😎': 0, '🤔': 0, '🤯': 0, '😴': 0, '🙋‍♂️': 0 };
            this.updateAnalyticsUI();
        } catch (e) {
            this.toast('error', 'Failed to reset classroom.');
        }
    }

    // 7. STUDENT ACTIONS
    async handleJoinClass(e) {
        e.preventDefault();
        const code = document.getElementById('class-code-input').value.trim().toUpperCase();

        this.toast('info', 'Searching for classroom...');

        let foundClassroom = null;

        if (this.supabase && !this.isPlaceholderConfig) {
            try {
                const { data, error } = await this.supabase
                    .from('classrooms')
                    .select('*')
                    .eq('code', code)
                    .single();

                if (!error && data) {
                    foundClassroom = data;
                }
            } catch (err) {
                console.warn("Supabase classroom lookup failed:", err);
            }
        }

        // Fallback to local classrooms if not found in Supabase
        if (!foundClassroom) {
            const localClasses = JSON.parse(localStorage.getItem('shivclassroom_local_classes') || '[]');
            foundClassroom = localClasses.find(c => c.code === code);
        }

        if (!foundClassroom) {
            this.toast('error', 'Classroom code not found. Check the code with your teacher.');
            return;
        }

        // Save in recent classes (max 6)
        this.saveRecentClassroom(foundClassroom);

        // Open student classroom view
        this.openStudentClassroom(foundClassroom);
    }

    saveRecentClassroom(classroom) {
        this.recentClassrooms = this.recentClassrooms.filter(c => c.id !== classroom.id);
        this.recentClassrooms.unshift({
            id: classroom.id,
            name: classroom.name,
            code: classroom.code,
            joinedAt: new Date().toISOString()
        });
        
        if (this.recentClassrooms.length > 6) {
            this.recentClassrooms.pop();
        }
        
        localStorage.setItem('student_recent_classes', JSON.stringify(this.recentClassrooms));
    }

    loadStudentRecentClasses() {
        const emptyState = document.getElementById('student-recent-empty');
        const gridList = document.getElementById('student-recent-list');

        if (this.recentClassrooms.length === 0) {
            emptyState.classList.remove('hidden');
            gridList.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            gridList.classList.remove('hidden');
            gridList.innerHTML = '';
            
            this.recentClassrooms.forEach(classroom => {
                const card = document.createElement('div');
                card.className = 'class-card';
                card.innerHTML = `
                    <div class="class-card-header">
                        <h4>${classroom.name}</h4>
                        <span class="code">Code: ${classroom.code}</span>
                    </div>
                    <div class="class-card-footer">
                        <span><i data-lucide="clock"></i> Last joined</span>
                        <span class="btn-text">Check-in →</span>
                    </div>
                `;
                card.addEventListener('click', () => this.openStudentClassroom(classroom));
                gridList.appendChild(card);
            });
            lucide.createIcons();
        }
    }

    openStudentClassroom(classroom) {
        this.activeClassroom = classroom;
        
        document.getElementById('student-class-name').textContent = classroom.name;
        document.getElementById('student-class-code-display').textContent = `Code: ${classroom.code}`;
        
        // Reset selected buttons
        document.querySelectorAll('.emoji-feedback-btn').forEach(btn => {
            btn.classList.remove('selected', 'disabled');
        });
        
        document.getElementById('feedback-status').innerHTML = `
            <div class="status-placeholder">Click an emoji above to submit your live check-in!</div>
        `;

        this.showView('view-student-class');
    }

    async handleSendFeedback(emoji, button) {
        if (!this.activeClassroom) return;

        // Visual feedback
        document.querySelectorAll('.emoji-feedback-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.classList.add('disabled');
        });
        button.classList.add('selected');
        button.classList.remove('disabled');

        const statusContainer = document.getElementById('feedback-status');
        statusContainer.innerHTML = `<div class="spinner spinner-sm"></div> <span style="margin-left: 10px;">Sending check-in...</span>`;

        try {
            const { error } = await this.supabase
                .from('emoji_responses')
                .insert({
                    classroom_id: this.activeClassroom.id,
                    emoji: emoji,
                    student_id: this.currentUser.id
                });

            if (error) throw error;

            // Re-enable other buttons after 2 seconds
            setTimeout(() => {
                document.querySelectorAll('.emoji-feedback-btn').forEach(btn => {
                    btn.classList.remove('disabled');
                });
            }, 3000);

            // Trigger Confetti!
            confetti({
                particleCount: 50,
                angle: 60,
                spread: 55,
                origin: { x: 0 }
            });
            confetti({
                particleCount: 50,
                angle: 120,
                spread: 55,
                origin: { x: 1 }
            });

            statusContainer.innerHTML = `
                <div class="status-success-message">
                    <i data-lucide="check-circle"></i>
                    <span>Response sent! You can change your response anytime.</span>
                </div>
            `;
            lucide.createIcons();
            this.toast('success', 'Emoji submitted!');
        } catch (e) {
            console.error("Emoji response failed:", e);
            this.toast('error', 'Failed to submit response.');
            
            // Re-enable on failure
            document.querySelectorAll('.emoji-feedback-btn').forEach(btn => {
                btn.classList.remove('disabled');
            });
            statusContainer.innerHTML = `
                <div class="status-placeholder" style="color: #ef4444;">Connection error. Try clicking again!</div>
            `;
        }
    }

    // 8. REALTIME LISTENERS
    subscribeRealtime() {
        if (!this.activeClassroom) return;
        
        this.unsubscribeRealtime(); // Clean up existing

        const classroomId = this.activeClassroom.id;
        
        this.realtimeChannel = this.supabase
            .channel(`emoji_responses:classroom=${classroomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'emoji_responses',
                    filter: `classroom_id=eq.${classroomId}`
                },
                (payload) => {
                    const newEmoji = payload.new.emoji;
                    if (this.emojiCounts[newEmoji] !== undefined) {
                        this.emojiCounts[newEmoji]++;
                        this.updateAnalyticsUI();
                        this.toast('info', `New response received!`);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'emoji_responses',
                    filter: `classroom_id=eq.${classroomId}`
                },
                () => {
                    // Refresh all on deletes to ensure correctness
                    this.fetchClassroomResponses();
                }
            )
            .subscribe((status) => {
                console.log("Realtime status:", status);
            });
    }

    unsubscribeRealtime() {
        if (this.realtimeChannel) {
            this.supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
    }

    // 9. AI GENERATION (Gemini API Integration vs Local Heuristic engine)
    async generateAIReport() {
        const total = Object.values(this.emojiCounts).reduce((a, b) => a + b, 0);
        if (total === 0) {
            this.toast('info', 'Need student check-ins before generating a report!');
            return;
        }

        const reportEmpty = document.getElementById('ai-report-empty');
        const reportLoading = document.getElementById('ai-report-loading');
        const reportContent = document.getElementById('ai-report-content-view');
        const reportText = document.getElementById('ai-report-text');

        reportEmpty.classList.add('hidden');
        reportLoading.classList.remove('hidden');
        reportContent.classList.add('hidden');

        const geminiKey = localStorage.getItem('gemini_api_key');
        
        try {
            let markdownReport = '';

            if (geminiKey) {
                // Call Gemini API
                markdownReport = await this.callGeminiAPI(geminiKey);
            } else {
                // Simulated rich heuristic AI report (runs offline instantly)
                markdownReport = await this.runLocalHeuristicModel();
            }

            // Render Markdown-like reports
            reportText.innerHTML = this.renderMarkdownHeuristics(markdownReport);
            
            reportLoading.classList.add('hidden');
            reportContent.classList.remove('hidden');
            this.toast('success', 'AI Class Report generated!');
        } catch (e) {
            console.error("AI Generation failed:", e);
            this.toast('error', 'Failed to generate AI report.');
            reportLoading.classList.add('hidden');
            reportEmpty.classList.remove('hidden');
        }
    }

    async callGeminiAPI(apiKey) {
        const total = Object.values(this.emojiCounts).reduce((a, b) => a + b, 0);
        const dataPrompt = `
            Classroom Name: ${this.activeClassroom.name}
            Total Responses: ${total}
            Emoji Response Counts:
            - 😎 Got It (Understood everything): ${this.emojiCounts['😎']}
            - 🤔 Bit Confused (Need clarification): ${this.emojiCounts['🤔']}
            - 🤯 Too Hard (Feeling overwhelmed): ${this.emojiCounts['🤯']}
            - 😴 Bored (Need a change of pace): ${this.emojiCounts['😴']}
            - 🙋‍♂️ Question (Has a question): ${this.emojiCounts['🙋‍♂️']}
        `;

        const systemInstructions = `
            You are an expert pedagogical AI teaching assistant. Analyze the classroom emoji breakdown. 
            Provide a warm, supportive, plain-English evaluation. Translate the emoji signals into a pedagogy-focused check-in read.
            Tell the teacher exactly what landed and what didn't. Give 2-3 specific, actionable recommendations (e.g., small group recap, zoom out to recap main term, dynamic team break).
            Use markdown. Keep it under 250 words, clean and scannable. Write directly, no intro/outro chatter.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemInstructions}\n\nHere is the class feedback data:\n${dataPrompt}`
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Gemini API connection error');
        }

        const resData = await response.json();
        return resData.candidates[0].content.parts[0].text;
    }

    runLocalHeuristicModel() {
        return new Promise((resolve) => {
            setTimeout(() => {
                const total = Object.values(this.emojiCounts).reduce((a, b) => a + b, 0);
                const pctGot = Math.round((this.emojiCounts['😎'] / total) * 100);
                const pctConf = Math.round((this.emojiCounts['🤔'] / total) * 100);
                const pctHard = Math.round((this.emojiCounts['🤯'] / total) * 100);
                const pctBored = Math.round((this.emojiCounts['😴'] / total) * 100);
                const pctQuest = Math.round((this.emojiCounts['🙋‍♂️'] / total) * 100);

                let toneTitle = 'Steady Sailing';
                let overview = '';
                let recommendation = '';
                
                if (pctGot >= 60) {
                    toneTitle = 'Strong Understanding! 🚀';
                    overview = `The classroom is showing high levels of confidence. With **${pctGot}% of students feeling great (😎)**, the core concepts of the lesson have successfully landed for the vast majority. There are minor pockets of curiosity or minor confusion, but nothing disrupting the general flow.`;
                    recommendation = `
- **Keep Moving Forward:** You can confidently introduce the next topic.
- **Enrichment Check:** Offer a quick stretch challenge or advanced riddle to students who answered (😎) to keep their minds buzzing.
- **Peer Support:** Group the few confused students with confident ones for a 2-minute quick pair-share discussion.
                    `;
                } else if (pctHard + pctConf >= 40) {
                    toneTitle = 'Adjustment Needed ⚠️';
                    overview = `A substantial block of the class (**${pctHard + pctConf}%**) is expressing difficulty. Specifically, **${pctHard}% indicate it is too hard (🤯)** and **${pctConf}% are confused (🤔)**. This signal suggests the explanation speed or current complexity level is pushing students past their optimal learning zone into frustration.`;
                    recommendation = `
- **Pump the Brakes:** Pause the current progression. Avoid presenting new terminology.
- **Simplify & Scaffolding:** Break down the last conceptual block into three atomic points. Use an analogy completely unrelated to school (like cooking, gaming, or movies).
- **Anonymous Board:** Do a quick verbal poll or write one confusing term on the board and ask, "Who can explain what we *think* this is?" to remove social friction.
                    `;
                } else if (pctBored >= 30) {
                    toneTitle = 'Engagement Drop 😴';
                    overview = `There is an energy lull in the classroom. **${pctBored}% of the class is reporting boredom (😴)**. This indicator usually means the pace has slowed down too much, or the instructional style has become passive (heavy listening, low participation).`;
                    recommendation = `
- **Interactive Shift:** Transition immediately from lecturing to active recall. Launch a quick quiz or run a "stand up if you agree" active exercise.
- **The 2-Minute Pivot:** Give students 2 minutes to explain the lesson's main theme in text emojis to a neighbor.
- **Speed Up:** Increase the pace of delivery or introduce a practical challenge task.
                    `;
                } else if (pctQuest >= 35) {
                    toneTitle = 'Active Curiosity 🙋‍♂️';
                    overview = `The class is highly engaged but has unanswered queries. **${pctQuest}% of students are holding active questions (🙋‍♂️)**. This is a very positive check-in signature; it indicates attentiveness, though they need dedicated space to clarify details before they can apply it independently.`;
                    recommendation = `
- **Open Floor Q&A:** Allocate the next 5 minutes entirely to clarification. 
- **Sticky-Note Questions:** If they are shy, have them type or write down their questions anonymously to answer as a group.
- **Concept Walkthrough:** Walk through one more comprehensive application example end-to-end.
                    `;
                } else {
                    toneTitle = 'Healthy Mixture 🌈';
                    overview = `The class response signature is diverse. We have confident students (**${pctGot}% 😎**), a few needing help (**${pctConf}% 🤔**), and a dynamic blend of questions. This represents a healthy, active classroom environment where different learning speeds are playing out.`;
                    recommendation = `
- **Segmented Support:** While independent working time starts, draw the students who selected (🤔) or (🤯) into a small 4-person table for targeted support.
- **Refocusing Exercise:** A quick 1-minute visual recap before opening up class activity time.
                    `;
                }

                const report = `
#### Heuristic Insight: ${toneTitle}

> ** pedagogical readout:**
> ${overview}

#### Classroom Recommendations:
${recommendation}

*Note: You are viewing local heuristic diagnostics. To get custom OpenAI/Gemini generative AI reports, add your API key in settings.*
`;
                resolve(report);
            }, 1000);
        });
    }

    renderMarkdownHeuristics(md) {
        return md
            .replace(/#### (.*)/g, '<h4>$1</h4>')
            .replace(/> \*\*(.*)\*\*/g, '<blockquote><strong>$1</strong>')
            .replace(/> (.*)/g, '$1</blockquote>')
            .replace(/- \*\*(.*)\*\*(.*)/g, '<li><strong>$1</strong>$2</li>')
            .replace(/- (.*)/g, '<li>$1</li>')
            .replace(/\n\n/g, '<br>')
            .replace(/\*Note: (.*)\*/g, '<p><small><em>Note: $1</em></small></p>');
    }

    // ROSTER & RBAC MANAGEMENT
    loadSuperAdminPanel() {
        const roster = JSON.parse(localStorage.getItem('shivclassroom_school_roster') || '[]');
        
        const schoolCount = roster.filter(u => u.role === 'school_admin').length;
        const teacherCount = roster.filter(u => u.role === 'teacher').length;
        const studentCount = roster.filter(u => u.role === 'student').length;

        const elSchool = document.getElementById('stat-count-schooladmins');
        const elTeacher = document.getElementById('stat-count-teachers');
        const elStudent = document.getElementById('stat-count-students');
        
        if (elSchool) elSchool.textContent = schoolCount || 1;
        if (elTeacher) elTeacher.textContent = teacherCount || 2;
        if (elStudent) elStudent.textContent = studentCount || 5;

        const tableBody = document.getElementById('superadmin-user-list');
        if (!tableBody) return;

        tableBody.innerHTML = roster.map(u => `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td><span class="role-pill-sm role-${u.role}">${(u.role || '').replace('_', ' ').toUpperCase()}</span></td>
                <td>${u.email}</td>
                <td>
                    ${u.email === 'shivteg@admin.com' 
                        ? '<span class="text-muted">Super Admin</span>' 
                        : `<button class="btn btn-danger btn-xs" onclick="app.handleSuperAdminDeleteUser('${u.email}')">Remove</button>`}
                </td>
            </tr>
        `).join('');
    }

    handleSuperAdminAddUser(e) {
        e.preventDefault();
        const name = document.getElementById('sa-user-name').value.trim();
        const email = document.getElementById('sa-user-email').value.trim().toLowerCase();
        const passwordInput = document.getElementById('sa-user-password');
        const password = passwordInput ? passwordInput.value : '';
        const role = document.getElementById('sa-user-role').value;

        let roster = JSON.parse(localStorage.getItem('shivclassroom_school_roster') || '[]');
        if (roster.some(u => u.email.toLowerCase() === email)) {
            this.toast('error', 'User with this email already exists in system.');
            return;
        }

        roster.push({ name, email, password, role, dept: 'Managed Account' });
        localStorage.setItem('shivclassroom_school_roster', JSON.stringify(roster));
        this.toast('success', `User ${name} created with role "${role}"`);
        document.getElementById('superadmin-add-user-form').reset();
        this.loadSuperAdminPanel();
    }

    handleSuperAdminDeleteUser(email) {
        let roster = JSON.parse(localStorage.getItem('shivclassroom_school_roster') || '[]');
        roster = roster.filter(u => u.email !== email);
        localStorage.setItem('shivclassroom_school_roster', JSON.stringify(roster));
        this.toast('info', `Removed ${email} from system.`);
        this.loadSuperAdminPanel();
    }

    handleSuperAdminSystemReset() {
        if (confirm('Are you sure you want to reset all demo data and restore initial system roster?')) {
            localStorage.removeItem('shivclassroom_school_roster');
            localStorage.removeItem('shivclassroom_teacher_students');
            this.initDefaultRosters();
            this.toast('success', 'System data restored to default state.');
            this.loadSuperAdminPanel();
        }
    }

    loadSchoolAdminRoster() {
        const roster = JSON.parse(localStorage.getItem('shivclassroom_school_roster') || '[]');
        const tableBody = document.getElementById('schooladmin-roster-list');
        if (!tableBody) return;

        const schoolUsers = roster.filter(u => u.role === 'teacher' || u.role === 'student');

        tableBody.innerHTML = schoolUsers.length ? schoolUsers.map(u => `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td><span class="role-pill-sm role-${u.role}">${(u.role || '').toUpperCase()}</span></td>
                <td>${u.dept || 'General'}</td>
                <td>
                    <button class="btn btn-danger btn-xs" onclick="app.handleSchoolAdminDelete('${u.email}')">Delete</button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="4" class="text-center text-muted">No school staff or students found.</td></tr>';
    }

    handleSchoolAdminAdd(e) {
        e.preventDefault();
        const name = document.getElementById('sa-entry-name').value.trim();
        const email = document.getElementById('sa-entry-email').value.trim();
        const role = document.getElementById('sa-entry-type').value;
        const dept = document.getElementById('sa-entry-dept').value.trim();

        let roster = JSON.parse(localStorage.getItem('shivclassroom_school_roster') || '[]');
        if (roster.some(u => u.email === email)) {
            this.toast('error', 'User already exists in directory.');
            return;
        }

        roster.push({ name, email, role, dept });
        localStorage.setItem('shivclassroom_school_roster', JSON.stringify(roster));
        this.toast('success', `Added ${name} as ${role} to school roster.`);
        document.getElementById('schooladmin-add-form').reset();
        this.loadSchoolAdminRoster();
    }

    handleSchoolAdminDelete(email) {
        let roster = JSON.parse(localStorage.getItem('shivclassroom_school_roster') || '[]');
        roster = roster.filter(u => u.email !== email);
        localStorage.setItem('shivclassroom_school_roster', JSON.stringify(roster));
        this.toast('info', `Removed ${email} from school directory.`);
        this.loadSchoolAdminRoster();
    }

    loadTeacherStudentRoster() {
        const students = JSON.parse(localStorage.getItem('shivclassroom_teacher_students') || '[]');
        const listEl = document.getElementById('teacher-student-roster-list');
        if (!listEl) return;

        listEl.innerHTML = students.length ? students.map(s => `
            <li class="student-roster-item">
                <div>
                    <strong>${s.name}</strong> <small>(${s.grade})</small>
                    <div class="text-muted text-xs">${s.email}</div>
                </div>
                <button class="btn btn-outline btn-xs" onclick="app.handleTeacherDeleteStudent('${s.email}')">Remove</button>
            </li>
        `).join('') : '<p class="text-xs text-muted">No enrolled students in your roster.</p>';
    }

    handleTeacherAddStudent(e) {
        e.preventDefault();
        const name = document.getElementById('t-student-name').value.trim();
        const email = document.getElementById('t-student-email').value.trim();
        const grade = document.getElementById('t-student-grade').value.trim();

        let students = JSON.parse(localStorage.getItem('shivclassroom_teacher_students') || '[]');
        if (students.some(s => s.email === email)) {
            this.toast('error', 'Student already in your roster.');
            return;
        }

        students.push({ name, email, grade });
        localStorage.setItem('shivclassroom_teacher_students', JSON.stringify(students));
        this.toast('success', `Enrolled ${name} into class roster.`);
        document.getElementById('teacher-add-student-form').reset();
        this.loadTeacherStudentRoster();
    }

    handleTeacherDeleteStudent(email) {
        let students = JSON.parse(localStorage.getItem('shivclassroom_teacher_students') || '[]');
        students = students.filter(s => s.email !== email);
        localStorage.setItem('shivclassroom_teacher_students', JSON.stringify(students));
        this.toast('info', `Removed student from roster.`);
        this.loadTeacherStudentRoster();
    }

    // UTILS
    generateRandomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

// Instantiate and expose the app
const app = new ShivClassroomApp();
window.app = app;
