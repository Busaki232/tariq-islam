-- Security Documentation: public_profiles view
-- This view provides controlled public access to non-sensitive profile fields
-- while protecting phone_number which remains private in the profiles table.
--
-- Security Model:
-- - Uses security_invoker=on to enforce RLS from underlying profiles table
-- - Only exposes: user_id, full_name, location, created_at, updated_at
-- - phone_number is intentionally excluded and remains private
-- - Authenticated users can view public profiles through this view
-- - The underlying profiles table has RLS that restricts phone_number access
--
-- This is NOT a vulnerability - it's a deliberate security pattern to separate
-- public profile data from sensitive PII (phone numbers).

COMMENT ON VIEW public.public_profiles IS 
'Public view of user profiles with security_invoker enabled. 
Exposes only non-sensitive fields (full_name, location). 
Phone numbers remain protected in the underlying profiles table.
This view uses security_invoker to inherit RLS policies from profiles table.';