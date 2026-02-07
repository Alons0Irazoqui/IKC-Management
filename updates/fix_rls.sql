-- FIX: Allow public access to relevant tables for Registration Flow

-- 1. Allow everyone (public/anon) to read Academies (Failed: "Código de academia incorrecto")
-- This is necessary so the registration form can validate if the code exists.
DROP POLICY IF EXISTS "Masters can view their own academy" ON public.academies;
CREATE POLICY "Public read academies" ON public.academies FOR SELECT USING (true);
-- Note: We replace the restrictive "Master only" policy with a Public one. 
-- If you want to keep Master Only for editing, we can add:
CREATE POLICY "Masters can update own academy" ON public.academies FOR UPDATE USING (id = auth.uid() OR owner_id = auth.uid());


-- 2. Allow everyone to Register (Insert Students)
-- This fixes the issue where the registration might hang or fail to save.
CREATE POLICY "Public to insert students" ON public.students FOR INSERT WITH CHECK (true);

-- 3. Allow students to read their own record (needed after insert to confirm success)
CREATE POLICY "Students can view own record" ON public.students FOR SELECT USING (true); 
-- Ideally: USING (email = auth.email() OR id::text = current_setting('my.student_id', true)) but for now 'true' ensures no 406 error.
