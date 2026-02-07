-- FIX RLS CLEANUP (The "Nuclear Option" for Policies)
-- We found multiple recursive policies active on 'profiles'. We will drop ALL of them and recreate only the safe ones.

-- 1. Clean PROFILES (The Source of recursion)
DROP POLICY IF EXISTS "Masters can see profiles in their academy" ON public.profiles;
DROP POLICY IF EXISTS "Masters view academy profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
-- Drop the one we created earlier to ensure order/definition is perfect
DROP POLICY IF EXISTS "Masters can view profiles in their academy" ON public.profiles;

-- Recreate Safe Policies for PROFILES
-- A. Simple own-row access
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- B. Master access via Safe Function (Queries 'academies' NOT 'profiles')
CREATE POLICY "Masters can view profiles in their academy" ON public.profiles
FOR SELECT USING (academy_id = public.get_my_academy_id());


-- 2. Clean ACADEMIES
DROP POLICY IF EXISTS "Users can view their own academy" ON public.academies;
DROP POLICY IF EXISTS "Masters can view their own academy" ON public.academies;
-- Also specific update policies might exist
DROP POLICY IF EXISTS "Masters can update their own academy" ON public.academies;
DROP POLICY IF EXISTS "Masters can update their academy" ON public.academies;
DROP POLICY IF EXISTS "Masters can update own academy" ON public.academies;

-- Recreate Safe Policies for ACADEMIES
-- A. Master access (Direct check on owner_id)
CREATE POLICY "Masters can view their own academy" ON public.academies
FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Masters can update their own academy" ON public.academies
FOR UPDATE USING (owner_id = auth.uid());

-- 3. Clean STUDENTS (Prevent recursion here too)
-- The "Masters view academy students" policy often causes similar issues
DROP POLICY IF EXISTS "Masters view academy students" ON public.students;

CREATE POLICY "Masters view academy students" ON public.students
FOR ALL USING (academy_id = public.get_my_academy_id());

-- 4. Clean PAYMENTS (Tuition Records)
DROP POLICY IF EXISTS "Masters view academy payments" ON public.tuition_records;

CREATE POLICY "Masters view academy payments" ON public.tuition_records
FOR ALL USING (academy_id = public.get_my_academy_id());

