-- Comprehensive Supabase RBAC Database Schema for shivclassroom
-- Roles supported: 'super_admin' (Shivteg), 'school_admin', 'teacher', 'student'

-- 1. Create Profiles Table with Role Column
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'student')),
    school_name TEXT DEFAULT 'Main Campus',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper Function to retrieve current user role efficiently
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    u_role TEXT;
BEGIN
    SELECT role INTO u_role FROM public.profiles WHERE id = user_id;
    RETURN COALESCE(u_role, 'student');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile record upon Supabase Auth user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username, role, updated_at)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(
            new.raw_user_meta_data->>'role',
            CASE 
                WHEN LOWER(new.email) = 'shivteg@admin.com' THEN 'super_admin'
                WHEN LOWER(new.email) = 'admin@school.edu' THEN 'school_admin'
                WHEN LOWER(new.email) = 'teacher@school.edu' THEN 'teacher'
                ELSE 'student'
            END
        ),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users" 
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super Admins can manage all profiles" 
    ON public.profiles FOR ALL TO authenticated 
    USING (public.get_user_role(auth.uid()) = 'super_admin');

CREATE POLICY "School Admins can manage profiles" 
    ON public.profiles FOR ALL TO authenticated 
    USING (public.get_user_role(auth.uid()) = 'school_admin' AND role IN ('teacher', 'student'));

-- 2. Create Classrooms Table
CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- Classrooms Policies based on Roles
DROP POLICY IF EXISTS "Allow authenticated users to read classrooms" ON public.classrooms;
CREATE POLICY "Allow authenticated users to read classrooms" ON public.classrooms
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers and Admins can create classrooms" ON public.classrooms;
CREATE POLICY "Teachers and Admins can create classrooms" ON public.classrooms
    FOR INSERT TO authenticated 
    WITH CHECK (
        public.get_user_role(auth.uid()) IN ('super_admin', 'school_admin', 'teacher')
    );

DROP POLICY IF EXISTS "Teachers and Admins can delete classrooms" ON public.classrooms;
CREATE POLICY "Teachers and Admins can delete classrooms" ON public.classrooms
    FOR DELETE TO authenticated 
    USING (
        auth.uid() = teacher_id OR public.get_user_role(auth.uid()) IN ('super_admin', 'school_admin')
    );

-- 3. Create Emoji Responses Table
CREATE TABLE IF NOT EXISTS public.emoji_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL CHECK (emoji IN ('😎', '🤔', '🤯', '😴', '🙋‍♂️')),
    student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.emoji_responses ENABLE ROW LEVEL SECURITY;

-- Emoji Responses Policies
DROP POLICY IF EXISTS "Students and users can submit emoji feedback" ON public.emoji_responses;
CREATE POLICY "Students and users can submit emoji feedback" ON public.emoji_responses
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id OR student_id IS NULL);

DROP POLICY IF EXISTS "Teachers and Admins can view classroom responses" ON public.emoji_responses;
CREATE POLICY "Teachers and Admins can view classroom responses" ON public.emoji_responses
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classrooms 
            WHERE classrooms.id = emoji_responses.classroom_id 
            AND (classrooms.teacher_id = auth.uid() OR public.get_user_role(auth.uid()) IN ('super_admin', 'school_admin', 'teacher'))
        )
    );

DROP POLICY IF EXISTS "Teachers and Admins can reset classroom responses" ON public.emoji_responses;
CREATE POLICY "Teachers and Admins can reset classroom responses" ON public.emoji_responses
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classrooms 
            WHERE classrooms.id = emoji_responses.classroom_id 
            AND (classrooms.teacher_id = auth.uid() OR public.get_user_role(auth.uid()) IN ('super_admin', 'school_admin'))
        )
    );

-- 4. Enable Supabase Realtime for Emoji Responses & Classrooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.emoji_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classrooms;
