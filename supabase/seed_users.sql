-- Supabase SQL Seed Script to Automatically Generate Email & Password Accounts for All 4 Roles
-- Copy and run this script in your Supabase SQL Editor!

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Super Admin (Shivteg)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'shivteg@admin.com',
  extensions.crypt('ShivtegAdmin#2026', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "super_admin", "username": "Shivteg"}',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- 2. School Admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@school.edu',
  extensions.crypt('SchoolAdmin#2026', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "school_admin", "username": "Dr. Sarah"}',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- 3. Teacher
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'teacher@school.edu',
  extensions.crypt('TeacherPass#2026', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "teacher", "username": "Prof. Oak"}',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- 4. Student
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'student@school.edu',
  extensions.crypt('StudentPass#2026', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "student", "username": "Alex Johnson"}',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;
