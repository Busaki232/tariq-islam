import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useGuidelinesCheck = () => {
  const { user } = useAuth();
  const [hasAccepted, setHasAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAcceptance();
  }, [user]);

  const checkAcceptance = async () => {
    if (!user) {
      setLoading(false);
      setHasAccepted(true); // Don't block anonymous users
      return;
    }

    const { data } = await supabase
      .from('community_guidelines_acceptance')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setHasAccepted(!!data);
    setLoading(false);

    // Redirect to guidelines if not accepted
    if (!data && window.location.pathname !== '/community-guidelines') {
      navigate('/community-guidelines');
    }
  };

  return { hasAccepted, loading };
};
