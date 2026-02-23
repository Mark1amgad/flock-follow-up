
-- 1. Add 'pending' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pending';

-- 2. Add 'approved' column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- 3. Update handle_new_user to also insert a 'pending' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, gender, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'male'),
    false
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pending');
  RETURN NEW;
END;
$$;

-- 4. Create trigger if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Capitalize existing names in people table
UPDATE public.people SET name = initcap(name);

-- 6. Capitalize existing names in profiles table
UPDATE public.profiles SET name = initcap(name);

-- 7. Update RLS: Members can read people assigned to them for current week (already exists, keeping)
-- 8. Add RLS policy: Members can read their own profile (already exists)

-- 9. Add policy for admins to read all profiles (for pending approvals)
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- 10. Allow admins to update any profile (for approval)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- 11. Allow admins to delete profiles (for rejection)
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 12. Allow admins to manage user_roles (update pending to member)
-- Already has "Admins can manage roles" ALL policy
