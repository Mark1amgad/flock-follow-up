

# Group-Based Architecture Refactor

## Overview
Add a `groups` table and link profiles, people, and weekly_assignments to groups. Assignment generation and member views become group-scoped.

## Database Changes (Migration)

### 1. Create `groups` table
```sql
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL,        -- 'primary', 'preparatory', 'secondary', etc.
  grade text,                 -- e.g. '1st', '2nd'
  gender text NOT NULL,       -- 'male', 'female', 'mixed'
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Admins full access, members can read
CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can read groups" ON public.groups FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'member'));
```

### 2. Add `group_id` to existing tables
```sql
ALTER TABLE public.profiles ADD COLUMN group_id uuid REFERENCES public.groups(id);
ALTER TABLE public.people ADD COLUMN group_id uuid REFERENCES public.groups(id);
ALTER TABLE public.weekly_assignments ADD COLUMN group_id uuid REFERENCES public.groups(id);
```

## Frontend Changes

### Auth.tsx (Sign Up)
- Add a group selector dropdown during signup (fetched from `groups` table).
- Pass `group_id` into user metadata so `handle_new_user` trigger stores it in profiles.

### handle_new_user trigger (Migration)
- Update to read `group_id` from `raw_user_meta_data` and store in `profiles.group_id`.

### AdminDashboard.tsx
- **Group management section**: CRUD for groups (name, level, grade, gender).
- **Group selector**: Add a dropdown/tabs to filter the dashboard by group.
- **People management**: When adding/editing a person, select a group. Filter people list by selected group.
- **Assignment generation**: Generate per selected group only. Delete + regenerate scoped to `group_id + week_start_date`. Only match members and people within the same group.
- **Stats**: Scoped to selected group.
- **Pending users**: Show requested group name.

### MemberDashboard.tsx
- Fetch assignments filtered by the member's `group_id` (from their profile).
- No manual group selection needed — auto-scoped.

### Index.tsx
- No changes needed (routing logic unchanged).

## RLS Policy Updates
- `people` "Members can read assigned people" policy stays as-is (already scoped via weekly_assignments join).
- `weekly_assignments` policies stay as-is (servant_id scoping is sufficient since assignments are group-scoped at generation time).

## Summary of Files Changed
1. **New migration** — `groups` table, `group_id` columns, updated trigger
2. **Auth.tsx** — group selector on signup
3. **AdminDashboard.tsx** — group CRUD, group filter, scoped generation/stats
4. **MemberDashboard.tsx** — fetch profile's group_id for scoped queries
5. **useAuth.tsx** — include `group_id` in profile context

