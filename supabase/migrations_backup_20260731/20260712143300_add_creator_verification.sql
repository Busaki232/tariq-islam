-- Add creator verification fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_creator_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS creator_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS creator_verified_by uuid;

-- Protect creator verification fields from self-verification.
CREATE OR REPLACE FUNCTION public.protect_creator_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged :=
    COALESCE(auth.role() = 'service_role', false)
    OR COALESCE(
      public.has_role(auth.uid(), 'admin'::public.app_role),
      false
    );

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_creator_verified = true AND NOT is_privileged THEN
      RAISE EXCEPTION 'Only administrators can verify creators';
    END IF;

    IF NEW.is_creator_verified = true THEN
      NEW.creator_verified_at := COALESCE(
        NEW.creator_verified_at,
        now()
      );
      NEW.creator_verified_by := COALESCE(
        NEW.creator_verified_by,
        auth.uid()
      );
    ELSE
      NEW.is_creator_verified := false;
      NEW.creator_verified_at := NULL;
      NEW.creator_verified_by := NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF
    NEW.is_creator_verified IS DISTINCT FROM OLD.is_creator_verified
    OR NEW.creator_verified_at IS DISTINCT FROM OLD.creator_verified_at
    OR NEW.creator_verified_by IS DISTINCT FROM OLD.creator_verified_by
  THEN
    IF NOT is_privileged THEN
      RAISE EXCEPTION 'Only administrators can change creator verification';
    END IF;

    IF NEW.is_creator_verified = true THEN
      NEW.creator_verified_at := now();
      NEW.creator_verified_by := auth.uid();
    ELSE
      NEW.is_creator_verified := false;
      NEW.creator_verified_at := NULL;
      NEW.creator_verified_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_creator_verification_fields
ON public.profiles;

CREATE TRIGGER protect_creator_verification_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_creator_verification();

CREATE INDEX IF NOT EXISTS idx_profiles_creator_verified
ON public.profiles (is_creator_verified)
WHERE is_creator_verified = true;
