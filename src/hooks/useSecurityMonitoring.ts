import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { SecurityUtils } from '@/lib/security';

/**
 * Hook for monitoring security events and user behavior
 */
export const useSecurityMonitoring = () => {
  const { user } = useAuth();

  // Monitor authentication events
  useEffect(() => {
    if (user) {
      SecurityUtils.logSecurityEvent('user_authenticated', {
        userId: user.id,
        email: user.email
      });
    }
  }, [user]);

  // Monitor page visibility changes (potential session hijacking detection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        SecurityUtils.logSecurityEvent('page_hidden');
      } else {
        SecurityUtils.logSecurityEvent('page_visible');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Monitor for suspicious form submissions
  const monitorFormSubmission = useCallback((formType: string, data?: any) => {
    const userId = user?.id;
    const key = `form_${formType}_${userId}`;
    
    if (SecurityUtils.checkRateLimit(key, 10, 300000)) { // 10 attempts per 5 minutes
      SecurityUtils.logSecurityEvent('form_rate_limit_exceeded', {
        formType,
        userId,
        timestamp: new Date().toISOString()
      });
      return false;
    }

    SecurityUtils.logSecurityEvent('form_submitted', {
      formType,
      userId,
      dataLength: JSON.stringify(data || {}).length
    });

    return true;
  }, [user?.id]);

  // Monitor for suspicious navigation patterns
  const monitorNavigation = useCallback((path: string) => {
    SecurityUtils.logSecurityEvent('navigation', {
      path,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });
  }, [user?.id]);

  // Clear rate limits on successful operations
  const clearFormRateLimit = useCallback((formType: string) => {
    const userId = user?.id;
    const key = `form_${formType}_${userId}`;
    SecurityUtils.clearRateLimit(key);
  }, [user?.id]);

  // Monitor contact access patterns
  const monitorContactAccess = useCallback((advertisementId: string, accessType: string) => {
    SecurityUtils.logSecurityEvent('contact_access', {
      advertisementId,
      accessType,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });
  }, [user?.id]);

  // Monitor suspicious contact patterns
  const monitorSuspiciousActivity = useCallback((activityType: string, details?: any) => {
    SecurityUtils.logSecurityEvent('suspicious_activity', {
      activityType,
      userId: user?.id,
      details,
      timestamp: new Date().toISOString()
    });
  }, [user?.id]);

  return {
    monitorFormSubmission,
    monitorNavigation,
    clearFormRateLimit,
    monitorContactAccess,
    monitorSuspiciousActivity
  };
};