-- FIX RLS POLICIES SCRIPT
-- Execute this script in the Supabase SQL Editor

-- 1. Enable RLS to be sure
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_records ENABLE ROW LEVEL SECURITY;

-- 2. STUDENTS TABLE POLICIES
-- Policy: Students can view their own record (matches auth.uid to user_id column)
-- This ensures access even if the "Profile" is missing or failing to load.
DROP POLICY IF EXISTS "Students can view own data" ON public.students;
CREATE POLICY "Students can view own data" ON public.students
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Policy: Masters can view/edit all students in their academy
-- We prefer a direct check here to be explicit and secure.
DROP POLICY IF EXISTS "Masters view academy students" ON public.students;
CREATE POLICY "Masters view academy students" ON public.students
FOR ALL
USING (
  academy_id IN (
    SELECT academy_id FROM public.profiles 
    WHERE id = auth.uid() AND role = 'master'
  )
);

-- 3. PAYMENTS (tuition_records) POLICIES
-- First, drop the generic policy that might allow students to see all payments in the academy
DROP POLICY IF EXISTS "Academy isolation for payments" ON public.tuition_records;

-- Policy: Masters can view/edit all payments in their academy
DROP POLICY IF EXISTS "Masters view academy payments" ON public.tuition_records;
CREATE POLICY "Masters view academy payments" ON public.tuition_records
FOR ALL
USING (
  academy_id IN (
    SELECT academy_id FROM public.profiles 
    WHERE id = auth.uid() AND role = 'master'
  )
);

-- Policy: Students can view ONLY their own payments
-- Logic: The payment's student_id matches a student record that belongs to the user
DROP POLICY IF EXISTS "Students view own payments" ON public.tuition_records;
CREATE POLICY "Students view own payments" ON public.tuition_records
FOR SELECT
USING (
  student_id IN (
    SELECT id FROM public.students 
    WHERE user_id = auth.uid()
  )
);

-- 4. DIAGNOSTIC / HELPER (Optional Fix for Profiles)
-- Ensure 'profiles' is readable by owner.
-- Existing policy usually covers this, but re-asserting doesn't hurt.
-- DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
-- CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
