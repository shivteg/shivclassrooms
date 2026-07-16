-- Simplified Supabase Database Schema for shivclassroom
-- This schema uses standard sign-in/sign-up authentication.
-- It removes distinct role profiles, allowing any authenticated user to create or join classrooms.

-- 1. Create Classrooms Table
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

DROP POLICY IF EXISTS "Allow authenticated users to insert classrooms" ON public.classrooms;
CREATE POLICY "Allow authenticated users to insert classrooms" ON public.classrooms
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Allow teachers to delete their own classrooms" ON public.classrooms;
CREATE POLICY "Allow teachers to delete their own classrooms" ON public.classrooms
    FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- 2. Create Emoji Responses Table
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
DROP POLICY IF EXISTS "Allow authenticated users to insert emoji responses" ON public.emoji_responses;
CREATE POLICY "Allow authenticated users to insert emoji responses" ON public.emoji_responses
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

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

-- 3. Enable Realtime for Emoji Responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.emoji_responses;
