/**
 * shivclassroom - Main Application Controller
 * Handles Supabase database connections, user sessions, unified dashboard mode toggles,
 * real-time feedback listeners, and AI Report generation.
 */

class ShivClassroomApp {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        
        // Active states
        this.activeClassroom = null; // Currently viewed classroom
        this.recentClassrooms = JSON.parse(localStorage.getItem('student_recent_classes') || '[]');
        this.realtimeChannel = null; // Listener subscription
        
        // Emoji counts for teacher dashboard
        this.emojiCounts = { '😎': 0, '🤔': 0, '🤯': 0, '😴': 0, '🙋‍♂️': 0 };

        // Bind event listeners on page load
        window.addEventListener('DOMContentLoaded', () => this.init());
    }

    // 1. INITIALIZATION & SETUP
    async init() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupDashboardToggle();
        
        // Check if database is configured
        const isConfigured = this.loadDatabaseConfig();
        
        if (!isConfigured) {
            this.showView('view-config');
            this.toast('info', 'Please configure your Supabase database credentials to start.');
            return;
        }

        // Test connection and auto-authenticate
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
        const url = localStorage.getItem('supabase_url');
        const anonKey = localStorage.getItem('supabase_anon_key');
        
        if (url && anonKey) {
            try {
                // Initialize Supabase Client
                this.supabase = window.supabase.createClient(url, anonKey);
                return true;
            } catch (e) {
                console.error("Initialization error:", e);
                return false;
            }
        }
        return false;
    }

    async checkSession() {
        this.showView('view-loading');
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) throw error;

            if (session) {
                this.currentUser = session.user;
                this.updateUserUI();
                this.navigateHome();
            } else {
                this.showView('view-auth');
            }
        } catch (e) {
            console.error("Session check failed:", e);
            this.toast('error', 'Connection failed. Please verify your database settings.');
            this.showView('view-config');
        }
    }

    updateUserUI() {
        const userMenu = document.getElementById('user-menu');
        const emailDisplay = document.getElementById('user-email-display');

        if (this.currentUser) {
            userMenu.classList.remove('hidden');
            emailDisplay.textContent = this.currentUser.email;
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
        
        // Refresh icons on view changes
        lucide.createIcons();
    }

    setupDashboardToggle() {
        const btnStudent = document.getElementById('btn-mode-student');
        const btnTeacher = document.getElementById('btn-mode-teacher');
        const panelStudent = document.getElementById('panel-student');
        const panelTeacher = document.getElementById('panel-teacher');

        if (btnStudent && btnTeacher) {
            btnStudent.addEventListener('click', () => {
                btnStudent.classList.add('active');
                btnTeacher.classList.remove('active');
                panelStudent.classList.remove('hidden');
                panelTeacher.classList.add('hidden');
                this.loadStudentRecentClasses();
            });

            btnTeacher.addEventListener('click', () => {
                btnTeacher.classList.add('active');
                btnStudent.classList.remove('active');
                panelTeacher.classList.remove('hidden');
                panelStudent.classList.add('hidden');
                this.loadTeacherClassrooms();
            });
        }
    }

    navigateHome() {
        if (!this.currentUser) {
            this.showView('view-auth');
            return;
        }

        // Clean up real-time listener if leaving active classroom dashboard
        this.unsubscribeRealtime();

        // Show unified dashboard
        this.showView('view-dashboard');
        
        // Refresh whichever tab is active
        const btnTeacher = document.getElementById('btn-mode-teacher');
        if (btnTeacher && btnTeacher.classList.contains('active')) {
            this.loadTeacherClassrooms();
        } else {
            this.loadStudentRecentClasses();
        }
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
        }, 4000);
    }

    // 4. EVENT LISTENERS BINDING
    setupEventListeners() {
        // DB Setup Submit
        document.getElementById('config-form').addEventListener('submit', (e) => this.handleSaveConfig(e));
        document.getElementById('modal-config-form').addEventListener('submit', (e) => this.handleSaveConfig(e, true));

        // DB Header Toggle
        document.getElementById('config-btn').addEventListener('click', () => {
            const modal = document.getElementById('config-modal');
            const urlInput = document.getElementById('modal-config-url');
            const keyInput = document.getElementById('modal-config-anon-key');
            
            urlInput.value = localStorage.getItem('supabase_url') || '';
            keyInput.value = localStorage.getItem('supabase_anon_key') || '';
            
            modal.classList.remove('hidden');
            lucide.createIcons();
        });

        // Close Config Modal
        document.getElementById('close-config-modal-btn').addEventListener('click', () => {
            document.getElementById('config-modal').classList.add('hidden');
        });

        document.getElementById('disconnect-btn').addEventListener('click', () => {
            localStorage.removeItem('supabase_url');
            localStorage.removeItem('supabase_anon_key');
            location.reload();
        });

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

    // 5. DATABASE CONFIG ACTIONS
    async handleSaveConfig(e, isModal = false) {
        e.preventDefault();
        const prefix = isModal ? 'modal-' : '';
        const url = document.getElementById(`${prefix}config-url`).value.trim();
        const anonKey = document.getElementById(`${prefix}config-anon-key`).value.trim();

        try {
            // Test connection with keys
            const tempClient = window.supabase.createClient(url, anonKey);
            const { error } = await tempClient.auth.getSession();
            
            if (error) throw error;

            localStorage.setItem('supabase_url', url);
            localStorage.setItem('supabase_anon_key', anonKey);
            
            if (isModal) {
                document.getElementById('config-modal').classList.add('hidden');
            }

            this.toast('success', 'Database connected successfully!');
            setTimeout(() => location.reload(), 1000);
        } catch (e) {
            console.error("Config save failed:", e);
            this.toast('error', 'Failed to connect. Check URL and Anon Key credentials.');
        }
    }

    // 6. AUTHENTICATION LOGIC
    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        this.toast('info', 'Logging you in...');
        
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            this.currentUser = data.user;
            this.toast('success', 'Welcome back!');
            this.updateUserUI();
            this.navigateHome();
        } catch (e) {
            this.toast('error', e.message || 'Log in failed.');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        this.toast('info', 'Creating secure account...');

        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password
            });

            if (error) throw error;

            this.toast('success', 'Signup successful! Welcome to shivclassroom.');
            
            // Sign in directly
            this.currentUser = data.user;
            this.updateUserUI();
            this.navigateHome();
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

    // 7. TEACHER ACTIONS & CLASSROOM CREATION
    async handleCreateClass(e) {
        e.preventDefault();
        const name = document.getElementById('create-class-name').value.trim();
        const code = document.getElementById('create-class-code').value.trim().toUpperCase();

        try {
            const { data, error } = await this.supabase
                .from('classrooms')
                .insert({
                    name,
                    code,
                    teacher_id: this.currentUser.id
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    throw new Error('This Classroom Code is already taken. Please choose another.');
                }
                throw error;
            }

            this.toast('success', `Classroom "${name}" created!`);
            document.getElementById('create-class-form').reset();
            
            // Celebrate with confetti!
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            this.loadTeacherClassrooms();
        } catch (e) {
            this.toast('error', e.message || 'Failed to create classroom.');
        }
    }

    async loadTeacherClassrooms() {
        try {
            const { data, error } = await this.supabase
                .from('classrooms')
                .select('*')
                .eq('teacher_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const emptyState = document.getElementById('teacher-classes-empty');
            const listGrid = document.getElementById('teacher-classes-list');

            if (!data || data.length === 0) {
                emptyState.classList.remove('hidden');
                listGrid.classList.add('hidden');
            } else {
                emptyState.classList.add('hidden');
                listGrid.classList.remove('hidden');
                
                listGrid.innerHTML = '';
                data.forEach(classroom => {
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
        } catch (e) {
            console.error("Load classes failed:", e);
            this.toast('error', 'Error loading classrooms.');
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

    // 8. STUDENT ACTIONS
    async handleJoinClass(e) {
        e.preventDefault();
        const code = document.getElementById('class-code-input').value.trim().toUpperCase();

        this.toast('info', 'Searching for classroom...');

        try {
            const { data, error } = await this.supabase
                .from('classrooms')
                .select('*')
                .eq('code', code)
                .single();

            if (error || !data) {
                throw new Error('Classroom code not found. Check the code with your teacher.');
            }

            // Save in recent classes (max 6)
            this.saveRecentClassroom(data);

            // Open student classroom view
            this.openStudentClassroom(data);
        } catch (e) {
            this.toast('error', e.message || 'Failed to join classroom.');
        }
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

    // 9. REALTIME LISTENERS
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

    // 10. AI GENERATION (Gemini API Integration vs Local Heuristic engine)
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
