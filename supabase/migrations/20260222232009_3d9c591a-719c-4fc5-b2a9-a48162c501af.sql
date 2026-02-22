
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. People table
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  last_attendance_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- 5. Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 6. Weekly assignments table
CREATE TABLE public.weekly_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, week_start_date)
);

ALTER TABLE public.weekly_assignments ENABLE ROW LEVEL SECURITY;

-- 7. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 8. Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'male')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. RLS Policies

-- Profiles: users can read all profiles, update own
CREATE POLICY "Users can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- User roles: only readable by the user themselves or admins
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- People: admin full access, members read via assignments
CREATE POLICY "Admins can manage people" ON public.people
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can read assigned people" ON public.people
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_assignments wa
      WHERE wa.person_id = people.id
        AND wa.servant_id = auth.uid()
        AND wa.week_start_date = date_trunc('week', CURRENT_DATE)::date
    )
  );

-- Attendance: admin full access, members read for assigned people
CREATE POLICY "Admins can manage attendance" ON public.attendance
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can read attendance for assigned people" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_assignments wa
      WHERE wa.person_id = attendance.person_id
        AND wa.servant_id = auth.uid()
    )
  );

-- Weekly assignments: admin full, members read own
CREATE POLICY "Admins can manage assignments" ON public.weekly_assignments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can read own assignments" ON public.weekly_assignments
  FOR SELECT TO authenticated USING (servant_id = auth.uid());

-- 10. Function to mark attendance and update last_attendance_date
CREATE OR REPLACE FUNCTION public.mark_attendance(p_person_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.attendance (person_id, date)
  VALUES (p_person_id, p_date)
  ON CONFLICT (person_id, date) DO NOTHING;

  UPDATE public.people
  SET last_attendance_date = p_date
  WHERE id = p_person_id
    AND (last_attendance_date IS NULL OR last_attendance_date < p_date);
END;
$$;
