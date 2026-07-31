-- Enhanced Contact Security System
-- 1. Add user reputation and verification system
CREATE TABLE IF NOT EXISTS public.user_reputation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reputation_score INTEGER NOT NULL DEFAULT 50,
  total_requests INTEGER NOT NULL DEFAULT 0,
  approved_requests INTEGER NOT NULL DEFAULT 0,
  rejected_requests INTEGER NOT NULL DEFAULT 0,
  spam_reports INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Add in-app messaging system
CREATE TABLE IF NOT EXISTS public.business_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_request_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Enhance contact requests with security features
ALTER TABLE public.contact_requests 
ADD COLUMN IF NOT EXISTS requires_verification BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_code TEXT,
ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS business_notified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

-- 4. Create contact access log for monitoring
CREATE TABLE IF NOT EXISTS public.contact_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_request_id UUID NOT NULL,
  user_id UUID NOT NULL,
  advertisement_id UUID NOT NULL,
  access_type TEXT NOT NULL, -- 'email_view', 'phone_view', 'message_sent'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_messages ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.contact_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_reputation
CREATE POLICY "Users can view their own reputation" ON public.user_reputation
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage reputation" ON public.user_reputation
FOR ALL USING (is_system_user());

-- RLS Policies for business_messages  
CREATE POLICY "Users can view their own messages" ON public.business_messages
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON public.business_messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" ON public.business_messages
FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- RLS Policies for contact_access_logs
CREATE POLICY "Users can view their own access logs" ON public.contact_access_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage access logs" ON public.contact_access_logs
FOR ALL USING (is_system_user());

-- Enhanced security functions
CREATE OR REPLACE FUNCTION public.get_user_reputation(_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(reputation_score, 50)
  FROM public.user_reputation 
  WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.calculate_risk_score(_user_id UUID, _advertisement_id UUID)
RETURNS INTEGER
LANGUAGE PLPGSQL
STABLE
SET search_path = public
AS $$
DECLARE
  reputation INTEGER;
  recent_requests INTEGER;
  same_ad_requests INTEGER;
  risk_score INTEGER := 0;
BEGIN
  -- Get user reputation
  reputation := get_user_reputation(_user_id);
  
  -- Count recent requests (last 24 hours)
  SELECT COUNT(*) INTO recent_requests
  FROM public.contact_requests
  WHERE requester_id = _user_id 
    AND created_at > now() - interval '24 hours';
    
  -- Count requests to same ad (last 30 days)
  SELECT COUNT(*) INTO same_ad_requests
  FROM public.contact_requests
  WHERE requester_id = _user_id 
    AND advertisement_id = _advertisement_id
    AND created_at > now() - interval '30 days';
  
  -- Calculate risk score
  IF reputation < 30 THEN risk_score := risk_score + 30; END IF;
  IF recent_requests > 5 THEN risk_score := risk_score + 25; END IF;
  IF same_ad_requests > 1 THEN risk_score := risk_score + 40; END IF;
  
  RETURN LEAST(risk_score, 100);
END;
$$;

-- Function to grant time-limited contact access
CREATE OR REPLACE FUNCTION public.grant_contact_access(_contact_request_id UUID, _hours INTEGER DEFAULT 72)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SET search_path = public
AS $$
BEGIN
  UPDATE public.contact_requests
  SET 
    access_granted_at = now(),
    access_expires_at = now() + make_interval(hours => _hours),
    status = 'approved'
  WHERE id = _contact_request_id
    AND is_ad_owner(auth.uid(), advertisement_id);
    
  RETURN FOUND;
END;
$$;

-- Enhanced contact request validation trigger
CREATE OR REPLACE FUNCTION public.enhanced_contact_request_validation()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = public
AS $$
DECLARE
  risk_score INTEGER;
  reputation INTEGER;
BEGIN
  -- Calculate risk score for new requests
  IF TG_OP = 'INSERT' THEN
    risk_score := calculate_risk_score(NEW.requester_id, NEW.advertisement_id);
    reputation := get_user_reputation(NEW.requester_id);
    
    NEW.risk_score := risk_score;
    
    -- High risk users need verification
    IF risk_score > 50 OR reputation < 30 THEN
      NEW.requires_verification := true;
      NEW.verification_code := substring(gen_random_uuid()::text from 1 for 8);
      NEW.verification_expires_at := now() + interval '1 hour';
    END IF;
    
    -- Set expiration
    NEW.expires_at := now() + interval '7 days';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for enhanced validation
DROP TRIGGER IF EXISTS enhanced_contact_request_validation_trigger ON public.contact_requests;
CREATE TRIGGER enhanced_contact_request_validation_trigger
  BEFORE INSERT ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION enhanced_contact_request_validation();

-- Function to log contact access
CREATE OR REPLACE FUNCTION public.log_contact_access(_contact_request_id UUID, _access_type TEXT)
RETURNS VOID
LANGUAGE PLPGSQL
SET search_path = public
AS $$
DECLARE
  req_record RECORD;
BEGIN
  SELECT * INTO req_record 
  FROM public.contact_requests 
  WHERE id = _contact_request_id;
  
  IF req_record IS NOT NULL THEN
    INSERT INTO public.contact_access_logs (
      contact_request_id,
      user_id,
      advertisement_id,
      access_type,
      ip_address,
      user_agent
    ) VALUES (
      _contact_request_id,
      auth.uid(),
      req_record.advertisement_id,
      _access_type,
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.headers', true)::json->>'user-agent'
    );
  END IF;
END;
$$;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_reputation_updated_at
  BEFORE UPDATE ON public.user_reputation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_messages_updated_at
  BEFORE UPDATE ON public.business_messages  
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();