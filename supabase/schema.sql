-- Supabase Database Schema for shivclassroom
-- This script sets up tables for user profiles, classrooms, and emoji responses.
-- It also configures Row Level Security (RLS) policies and enables realtime subscriptions.

-- 1. Create Profiles Table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read of profiles" ON public.profiles;
CREATE POLICY "Allow public read of profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Create Classrooms Table
CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- Classrooms Policies
DROP POLICY IF EXISTS "Allow authenticated users to read classrooms" ON public.classrooms;
CREATE POLICY "Allow authenticated users to read classrooms" ON public.classrooms
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow teachers to insert classrooms" ON public.classrooms;
CREATE POLICY "Allow teachers to insert classrooms" ON public.classrooms
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = teacher_id AND 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'teacher'
        )
    );

DROP POLICY IF EXISTS "Allow teachers to delete their own classrooms" ON public.classrooms;
CREATE POLICY "Allow teachers to delete their own classrooms" ON public.classrooms
    FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- 3. Create Emoji Responses Table
CREATE TABLE IF NOT EXISTS public.emoji_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL CHECK (emoji IN ('😎', '🤔', '🤯', '😴', '🙋‍♂️')),
    student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.emoji_responses ENABLE ROW LEVEL SECURITY;

-- Emoji Responses Policies
DROP POLICY IF EXISTS "Allow students to insert emoji responses" ON public.emoji_responses;
CREATE POLICY "Allow students to insert emoji responses" ON public.emoji_responses
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'student'
        )
    );

DROP POLICY IF EXISTS "Allow classroom teachers to view classroom responses" ON public.emoji_responses;
CREATE POLICY "Allow classroom teachers to view classroom responses" ON public.emoji_responses
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classrooms 
            WHERE classrooms.id = emoji_responses.classroom_id AND classrooms.teacher_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Allow classroom teachers to reset classroom responses" ON public.emoji_responses;
CREATE POLICY "Allow classroom teachers to reset classroom responses" ON public.emoji_responses
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.classrooms 
            WHERE classrooms.id = emoji_responses.classroom_id AND classrooms.teacher_id = auth.uid()
        )
    );

-- 4. Trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Enable Realtime for Emoji Responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.emoji_responses;
