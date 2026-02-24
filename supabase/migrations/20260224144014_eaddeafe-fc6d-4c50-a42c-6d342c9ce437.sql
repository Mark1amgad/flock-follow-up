
-- Fix the RLS policy on people table to use Saturday-based week start instead of date_trunc('week') which is Monday-based
DROP POLICY IF EXISTS "Members can read assigned people" ON public.people;

-- Create a helper function to calculate Saturday-based week start
CREATE OR REPLACE FUNCTION public.get_saturday_week_start(d date DEFAULT CURRENT_DATE)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  -- If today is Saturday (dow=6), return today. Otherwise go back to last Saturday.
  SELECT d - ((EXTRACT(dow FROM d)::int + 1) % 7)::int;
$$;

-- Recreate the policy using the Saturday-based week start
CREATE POLICY "Members can read assigned people"
ON public.people FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM weekly_assignments wa
    WHERE wa.person_id = people.id
      AND wa.servant_id = auth.uid()
      AND wa.week_start_date = public.get_saturday_week_start(CURRENT_DATE)
  )
);
