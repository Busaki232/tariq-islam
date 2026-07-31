-- Fix security warnings: Add search_path to functions

-- Fix update_event_rsvps_updated_at
CREATE OR REPLACE FUNCTION update_event_rsvps_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_mosque_rating
CREATE OR REPLACE FUNCTION update_mosque_rating()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mosques
  SET 
    rating_average = (
      SELECT COALESCE(AVG(rating), 0)
      FROM mosque_reviews
      WHERE mosque_id = COALESCE(NEW.mosque_id, OLD.mosque_id)
      AND NOT is_flagged
    ),
    review_count = (
      SELECT COUNT(*)
      FROM mosque_reviews
      WHERE mosque_id = COALESCE(NEW.mosque_id, OLD.mosque_id)
      AND NOT is_flagged
    )
  WHERE id = COALESCE(NEW.mosque_id, OLD.mosque_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix update_review_helpfulness_count
CREATE OR REPLACE FUNCTION update_review_helpfulness_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mosque_reviews
  SET 
    helpful_count = (
      SELECT COUNT(*)
      FROM review_helpfulness
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
      AND is_helpful = true
    ),
    not_helpful_count = (
      SELECT COUNT(*)
      FROM review_helpfulness
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
      AND is_helpful = false
    )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;