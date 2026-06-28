-- Drop existing insert policy for chat_groups
DROP POLICY IF EXISTS "Authenticated users can create groups" ON chat_groups;

-- Create new insert policy targeting public role for consistency
CREATE POLICY "Authenticated users can create groups"
ON chat_groups
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = created_by
);