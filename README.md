# 🏫 shivclassroom

**shivclassroom** is a full-stack, highly polished, private check-in web application designed for classroom check-ins. Students securely log in and can submit real-time emoji feedback on what they understood during class. Teachers can view live aggregated dashboards showing counts/percentages of responses (using Supabase Realtime) and generate AI-driven pedagogical reports to adapt their teaching on the fly.

---

## 🛠️ Project Structure

The project is structured as a light, premium, zero-compilation Single Page Application (SPA) designed to be hosted directly on any web server or custom domain.

- **[index.html](file:///C:/Users/user/shivclassrooms/index.html)**: Core structure, views templates (Auth, Teacher Home, Student Home, Dashboard panels), config portals, settings models, and references.
- **[style.css](file:///C:/Users/user/shivclassrooms/style.css)**: Modern Outfit typography design system tokens, responsive grids, dark/light styling states, glassmorphic card variables, and custom micro-animations.
- **[app.js](file:///C:/Users/user/shivclassrooms/app.js)**: Controller script connecting Supabase services (Auth, DB, Realtime Channels), client session states, responsive triggers, custom toast alerts, and the AI Class Report generator.
- **[supabase/schema.sql](file:///C:/Users/user/shivclassrooms/supabase/schema.sql)**: Database schema file with constraints, auto-triggers, Row Level Security (RLS) policies, and Realtime publications instructions.

---

## 🚀 Supabase Setup Guide

To get your backend running on Supabase:

1. **Create a New Project** on [Supabase Dashboard](https://supabase.com).
2. **Execute Database Schema**:
   - Go to your Supabase project's **SQL Editor** tab.
   - Click **New Query**.
   - Copy the entire SQL contents of **[supabase/schema.sql](file:///C:/Users/user/shivclassrooms/supabase/schema.sql)**.
   - Click **Run** to execute the script. This creates tables (`profiles`, `classrooms`, `emoji_responses`), set up default triggers for Auth user creations, and enables Realtime triggers.
3. **Grab API Keys**:
   - Go to **Project Settings > API**.
   - Copy your **Project URL** and the **anon public API key**.
4. **Link Application**:
   - Open **[index.html](file:///C:/Users/user/shivclassrooms/index.html)** in any browser.
   - The app will automatically prompt you to insert your Supabase **URL** and **Anon Key**. 
   - Fill them in. The credentials will be saved in your browser's local storage securely and start the session!

---

## ✨ Features Checklist

### 1. Distinct Role Auth (Teacher vs. Student)
- Custom signup triggers role assignment in user metadata.
- Automatic routing logic: Teachers load the classroom builder; Students see the classroom join console.
- Secure session states: persists logins across page reloads.

### 2. Student Emoji check-in
- Clean dashboard to join class using classroom code.
- Dynamic responsive emoji layout featuring 5 check-in indicators:
  - 😎 **Got It!** (Understood everything)
  - 🤔 **Bit Confused** (Needs clarification)
  - 🤯 **Too Hard** (Feeling overwhelmed)
  - 😴 **Bored** (Needs a change of pace)
  - 🙋‍♂️ **Question** (Has a question)
- Interactive bounce responses, checkmark confirmation footer, and satisfying dual-confetti explosions on click.

### 3. Teacher Dashboard & Realtime Summary
- Easy interface to create private classrooms (random unique code generator built-in).
- Live stats tracker with smooth CSS transition progress bars and visual counts.
- **Supabase Realtime integration**: immediately updates progress bar positions as students click emojis.
- **Reset Session**: clear all emoji responses from the table to start a new feedback segment.

### 4. AI Classroom Report Generator
- **Generative AI Model**: Connects client-side to Google Gemini API (by providing a Gemini API Key in the settings drawer) to write tailored educational reports.
- **Local Heuristic Model**: Runs offline immediately if no API key is specified, parsing counts/percentages into professional, supportive advice using pedagogical rules.

---

## 🎨 Premium CSS Styling
The app includes modern design details:
- **Smooth Blobs**: Slow-floating gradient background spheres creating visual depth.
- **Glassmorphism**: Backdrop blurs (`backdrop-filter`) and light translucent borders on elements.
- **Responsive Adaptations**: Fluid resizing from mobile screens to multi-panel widescreen monitors.
- **Bouncy Animations**: Elastic hover responses on interactive feedback cards.
