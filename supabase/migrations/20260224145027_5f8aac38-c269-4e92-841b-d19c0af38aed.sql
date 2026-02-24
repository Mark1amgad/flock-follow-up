
-- Add completed tracking columns to weekly_assignments
ALTER TABLE public.weekly_assignments
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Allow members to update only their own assignments (mark as completed)
CREATE POLICY "Members can update own assignments"
ON public.weekly_assignments FOR UPDATE
USING (servant_id = auth.uid())
WITH CHECK (servant_id = auth.uid());
