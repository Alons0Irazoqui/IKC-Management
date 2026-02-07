-- REPAIR ACCESS SCRIPT
-- Diagnosis: Fix RLS policies and ensure User Trigger is robust.

-- 1. CLEANUP POLICIES (Profiles)
-- Drop key conflicting policies to start fresh
DROP POLICY IF EXISTS "Masters can see profiles in their academy" ON public.profiles;
DROP POLICY IF EXISTS "Masters view academy profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Masters can view profiles in their academy" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for own user" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for own user" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for own user" ON public.profiles;

-- 2. CREATE BASIC ACCESS POLICIES
-- A. View Own Profile (Critical for Frontend loading)
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- B. Update Own Profile
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- C. Insert Own Profile (In case client creates it, though Trigger usually handles this)
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- D. Master Access (Restored safely via our secure function)
CREATE POLICY "Masters can view profiles in their academy" ON public.profiles
FOR SELECT USING (academy_id = public.get_my_academy_id());

-- 3. REPAIR TRIGGER FUNCTION
-- Ensure it handles UUID casting correctly and conflicts gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, academy_id)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'name',
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    CASE 
      WHEN new.raw_user_meta_data->>'academy_id' IS NOT NULL 
      THEN (new.raw_user_meta_data->>'academy_id')::uuid 
      ELSE NULL 
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ENSURE TRIGGER EXISTS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. VERIFICATION QUERY (Optional)
-- SELECT * FROM public.profiles WHERE id = auth.uid();
