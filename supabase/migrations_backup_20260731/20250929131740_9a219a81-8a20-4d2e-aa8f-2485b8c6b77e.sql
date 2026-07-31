-- Fix prayer_time_updates policies to be more explicit about authentication
DROP POLICY IF EXISTS "Users can create their own prayer time updates" ON public.prayer_time_updates;
DROP POLICY IF EXISTS "Users can view their own prayer time updates" ON public.prayer_time_updates;
DROP POLICY IF EXISTS "Users can update their own prayer time updates" ON public.prayer_time_updates;

-- Create more explicit policies that clearly require authentication
CREATE POLICY "Authenticated users can create their own prayer time updates" 
ON public.prayer_time_updates 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view their own prayer time updates" 
ON public.prayer_time_updates 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own prayer time updates" 
ON public.prayer_time_updates 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);