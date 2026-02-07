-- Fix for Infinite Recursion in RLS Policies
-- attempting to query 'profiles' inside a 'profiles' policy via an SQL function can cause recursion.
-- Switching to PLPGSQL prevents inlining and breaks the cycle when coupled with SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.get_my_academy_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  aid uuid;
BEGIN
  -- We use a simple select into variable to avoid complex query planning issues
  SELECT academy_id INTO aid FROM public.profiles WHERE id = auth.uid();
  RETURN aid;
END;
$$;

-- Verification query (optional - run manually if needed)
-- SELECT get_my_academy_id();
