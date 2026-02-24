
-- Fix search_path for the new function
ALTER FUNCTION public.get_saturday_week_start(date) SET search_path = public;
