-- Add UPDATE policy for calls table
CREATE POLICY "Users can update their own calls" 
ON public.calls 
FOR UPDATE 
TO authenticated
USING ((auth.uid() = caller_id) OR (auth.uid() = callee_id))
WITH CHECK ((auth.uid() = caller_id) OR (auth.uid() = callee_id));

-- Add DELETE policy for calls table
CREATE POLICY "Users can delete their own calls" 
ON public.calls 
FOR DELETE 
TO authenticated
USING ((auth.uid() = caller_id) OR (auth.uid() = callee_id));