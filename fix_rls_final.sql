-- FIX RLS INFINITE RECURSION (FINAL)
-- The previous attempts failed because of deep policy entanglement.
-- This script breaks the cycle by making 'academies' the root of trust, dependent only on auth.uid().

-- 1. Unblock Academies (The Root)
-- We remove the dependence on the function 'get_my_academy_id' here.
DROP POLICY IF EXISTS "Masters can view their own academy" ON public.academies;
CREATE POLICY "Masters can view their own academy" ON public.academies
FOR SELECT USING (owner_id = auth.uid());

-- 2. Update Helper to use Root (Academies) instead of Profiles
-- This ensures that pulling the academy ID never touches the 'profiles' table,
-- preventing the 'profiles' policy from triggering itself recursively.
CREATE OR REPLACE FUNCTION public.get_my_academy_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.academies WHERE owner_id = auth.uid();
$$;

-- 3. Ensure Profiles uses the safe function (Verification)
-- This policy can now run safely because 'get_my_academy_id' only touches 'academies'.
DROP POLICY IF EXISTS "Masters can view profiles in their academy" ON public.profiles;
CREATE POLICY "Masters can view profiles in their academy" ON public.profiles
FOR SELECT USING (academy_id = public.get_my_academy_id());

-- 4. Clean up other potential recursive policies
-- Ensure 'update' policies are also safe
DROP POLICY IF EXISTS "Masters can update their own academy" ON public.academies;
CREATE POLICY "Masters can update their own academy" ON public.academies
FOR UPDATE USING (owner_id = auth.uid());
