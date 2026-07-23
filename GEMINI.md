# 🏫 ShivClassrooms — System Architecture & Role Guide (GEMINI.md)

Welcome to **ShivClassrooms**! This document serves as the authoritative architectural blueprint and role guide for AI assistants, developers, and administrators interacting with the repository.

---

## 📌 Executive Summary

**ShivClassrooms** is a full-stack, zero-compilation real-time classroom check-in web application. It enables students to provide instant emoji-based feedback during live lessons, while teachers and administrators monitor engagement through real-time dashboards powered by **Supabase Realtime** and **Google Gemini AI**.

---

## 👥 Role-Based Access Control (RBAC) System

The application enforces strict multi-tenant Row Level Security (RLS) across four distinct user tiers:

| Role Identifier | Role Name | Exact Email / Username | Fixed Password | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| `super_admin` | **Super Admin** | `shivteg@admin.com`<br>*(Username: `shivteg`)* | `SuperAdmin123!` | Global system oversight, user promotions/demotions, system-wide analytics. |
| `school_admin` | **School Admin** | `admin@school.edu`<br>*(Username: `school_admin`)* | `SchoolAdmin123!` | Campus-level admin, teacher & student roster management, campus analytics. |
| `teacher` | **Teacher** | `teacher@school.edu`<br>*(Username: `teacher`)* | `Teacher123!` | Classroom creation, live emoji realtime monitoring, AI report generation. |
| `student` | **Student** | `student@school.edu`<br>*(Username: `student`)* | `Student123!` | Classroom entry, live emoji feedback submission, confetti response UI. |

---

## 📊 Database Schema & Row Level Security (`supabase/schema.sql`)

### 1. `profiles` Table
Stores user metadata and role permissions. Automatically populated on signup via database triggers.

```sql
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'student')),
    school_name TEXT DEFAULT 'Main Campus',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

*Automatic Role Assignment Trigger:*
- Users with `shivteg` or `superadmin` in email $\rightarrow$ `super_admin`
- Users with `admin` in email $\rightarrow$ `school_admin`
- Users with `teacher` in email $\rightarrow$ `teacher`
- All other signups $\rightarrow$ `student`

---

### 2. `classrooms` Table
Stores active classroom sessions created by teachers or administrators.

```sql
CREATE TABLE public.classrooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

### 3. `emoji_responses` Table
Stores live feedback submissions from students. Published to **Supabase Realtime**.

```sql
CREATE TABLE public.emoji_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL CHECK (emoji IN ('😎', '🤔', '🤯', '😴', '🙋‍♂️')),
    student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

#### Student Emoji Feedback Mapping:
- 😎 **Got It!** — Complete comprehension.
- 🤔 **Bit Confused** — Needs minor clarification.
- 🤯 **Too Hard** — Overwhelmed / core concept unclear.
- 😴 **Bored** — Pace needs acceleration or change of activity.
- 🙋‍♂️ **Question** — Has a direct question for the instructor.

---

## 🛠️ Project File Structure

```
shivclassrooms/
├── index.html            # Main SPA layout (Auth, Dashboards, Modals)
├── style.css             # Glassmorphism design system & micro-animations
├── app.js                # Core controller: Supabase Realtime, Auth, & AI Engine
├── config.js             # Environment & API Key configuration defaults
├── GEMINI.md             # AI System Prompt & Architectural Specification
├── README.md              # User setup and quickstart documentation
└── supabase/
    └── schema.sql        # Postgres DDL, Triggers, RLS Policies, & Realtime Pubs
```

---

## 🤖 AI Class Report Generator (Gemini Integration)

Teachers can trigger AI classroom analysis to evaluate real-time student sentiment:
1. **Gemini 1.5/2.0 API Mode**: Connects directly via client API key to provide deep pedagogical analysis, identifying learning bottlenecks and recommending specific teaching strategies.
2. **Offline Local Heuristic Engine**: Fallback rule parser that calculates statistical distribution percentages and generates instant action steps when offline or without an API key.

---

## ⚙️ Recent Updates & System Enhancements

1. **RBAC Security Lockdown**: Applied multi-tier Row Level Security policies guaranteeing strict isolation between schools, classrooms, and student data.
2. **Supabase SMTP & Resend Setup**: Configured SMTP email delivery pipeline for auth verification emails.
3. **Temp Cleanup Utility**: Built a standalone script (`clean_temp.py`) for system maintenance.
4. **Antigravity Guidelines Skill**: Added `antigravity-guidelines` skill for AI agent workflow enforcement.
