
-- Create groups table
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL,
  grade text,
  gender text NOT NULL DEFAULT 'mixed',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can read groups" ON public.groups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'member'));
CREATE POLICY "Pending can read groups" ON public.groups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'pending'));

-- Add group_id to profiles, people, weekly_assignments
ALTER TABLE public.profiles ADD COLUMN group_id uuid REFERENCES public.groups(id);
ALTER TABLE public.people ADD COLUMN group_id uuid REFERENCES public.groups(id);
ALTER TABLE public.weekly_assignments ADD COLUMN group_id uuid REFERENCES public.groups(id);

-- Update handle_new_user to store group_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, gender, approved, group_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'male'),
    false,
    CASE
      WHEN NEW.raw_user_meta_data->>'group_id' IS NOT NULL
        THEN (NEW.raw_user_meta_data->>'group_id')::uuid
      ELSE NULL
    END
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pending');
  RETURN NEW;
END;
$function$;
