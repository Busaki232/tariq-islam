-- Find and fix any remaining SECURITY DEFINER objects

-- Query to identify SECURITY DEFINER functions and views
DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Log all functions and views with SECURITY DEFINER
    FOR rec IN 
        SELECT 
            n.nspname as schema_name,
            p.proname as object_name,
            CASE p.prokind 
                WHEN 'f' THEN 'function'
                WHEN 'p' THEN 'procedure'
                WHEN 'a' THEN 'aggregate'
                WHEN 'w' THEN 'window'
            END as object_type,
            p.prosecdef as is_security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosecdef = true
        AND n.nspname = 'public'
    LOOP
        RAISE NOTICE 'Found SECURITY DEFINER %: %.%', rec.object_type, rec.schema_name, rec.object_name;
    END LOOP;
END $$;

-- The handle_new_user function MUST remain SECURITY DEFINER for triggers to work
-- This is the only acceptable use case, so let's verify it's properly secured
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  -- Input validation
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  -- Insert profile record for new user
  INSERT INTO public.profiles (user_id, full_name, phone_number)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.phone
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;