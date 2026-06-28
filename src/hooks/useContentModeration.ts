import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FlaggedKeyword {
  matched_keyword: string;
  category: string;
  severity: number;
}

export const useContentModeration = () => {
  const [checking, setChecking] = useState(false);

  const checkContent = useCallback(async (content: string): Promise<{
    isFlagged: boolean;
    keywords: FlaggedKeyword[];
    shouldRedirect: boolean;
    highestSeverity: number;
  }> => {
    if (!content || content.trim().length === 0) {
      return { isFlagged: false, keywords: [], shouldRedirect: false, highestSeverity: 0 };
    }

    setChecking(true);
    try {
      const { data, error } = await supabase.rpc('check_content_for_flags', {
        content: content.toLowerCase()
      });

      if (error) {
        console.error('Error checking content:', error);
        return { isFlagged: false, keywords: [], shouldRedirect: false, highestSeverity: 0 };
      }

      const keywords = data as FlaggedKeyword[] || [];
      const isFlagged = keywords.length > 0;
      const highestSeverity = keywords.length > 0 
        ? Math.max(...keywords.map(k => k.severity)) 
        : 0;

      // Check if any keyword requires redirect to education
      const { data: keywordData } = await supabase
        .from('flagged_keywords')
        .select('redirect_to_education')
        .in('keyword', keywords.map(k => k.matched_keyword));

      const shouldRedirect = keywordData?.some(k => k.redirect_to_education) || false;

      return {
        isFlagged,
        keywords,
        shouldRedirect,
        highestSeverity
      };
    } finally {
      setChecking(false);
    }
  }, []);

  const createAutoFlaggedReport = useCallback(async (
    userId: string,
    contentType: string,
    contentId: string,
    content: string,
    keywords: FlaggedKeyword[]
  ) => {
    try {
      const highestSeverity = Math.max(...keywords.map(k => k.severity));
      const reportType = keywords[0]?.category === 'extremism' ? 'extremism' 
        : keywords[0]?.category === 'violence' ? 'violence'
        : keywords[0]?.category === 'hate_speech' ? 'hate_speech'
        : 'inappropriate_content';

      const { error } = await supabase
        .from('reports')
        .insert({
          reported_by: null,
          reported_user_id: userId,
          content_type: contentType,
          content_id: contentId,
          report_type: reportType,
          description: `Auto-flagged for keywords: ${keywords.map(k => k.matched_keyword).join(', ')}. Content: ${content.substring(0, 200)}`,
          status: highestSeverity >= 9 ? 'under_review' : 'pending',
          is_auto_flagged: true,
          severity_score: highestSeverity * 10
        });

      if (error) {
        console.error('Error creating auto-flagged report:', error);
      }
    } catch (error) {
      console.error('Error in auto-flagging:', error);
    }
  }, []);

  return {
    checkContent,
    createAutoFlaggedReport,
    checking
  };
};
