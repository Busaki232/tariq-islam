-- Drop existing insert policy for chat_groups
DROP POLICY IF EXISTS "Authenticated users can create groups" ON chat_groups;

-- Create new insert policy that allows authenticated users to create groups
CREATE POLICY "Authenticated users can create groups"
ON chat_groups
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = created_by
);