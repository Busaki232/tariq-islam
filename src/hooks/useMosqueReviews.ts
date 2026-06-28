import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface Review {
  id: string;
  mosque_id: string;
  user_id: string;
  rating: number;
  title: string;
  review_text: string;
  visit_date?: string;
  cleanliness_rating?: number;
  friendliness_rating?: number;
  parking_rating?: number;
  accessibility_rating?: number;
  facilities_rating?: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

export const useMosqueReviews = (mosqueId: string) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  const fetchReviews = useCallback(async () => {
    try {
      const { data, error} = await supabase
        .from('mosque_reviews')
        .select('*')
        .eq('mosque_id', mosqueId)
        .eq('is_flagged', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReviews(data as unknown as Review[] || []);

      // Calculate average rating
      if (data && data.length > 0) {
        const avg = data.reduce((sum, review) => sum + review.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }

      // Find user's review if it exists
      if (user && data) {
        const userReview = (data as unknown as Review[]).find(r => r.user_id === user.id);
        setUserReview(userReview || null);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [mosqueId, user]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const submitReview = useCallback(async (reviewData: {
    rating: number;
    title: string;
    review_text: string;
    visit_date?: string;
    cleanliness_rating?: number;
    friendliness_rating?: number;
    parking_rating?: number;
    accessibility_rating?: number;
    facilities_rating?: number;
  }) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to submit a review',
        variant: 'destructive'
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('mosque_reviews')
        .insert({
          mosque_id: mosqueId,
          user_id: user.id,
          ...reviewData
        });

      if (error) throw error;

      await fetchReviews();

      toast({
        title: 'Review Submitted',
        description: 'Thank you for your feedback!'
      });

      return true;
    } catch (error: any) {
      console.error('Error submitting review:', error);
      
      if (error.code === '23505') {
        toast({
          title: 'Already Reviewed',
          description: 'You have already submitted a review for this mosque',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to submit review',
          variant: 'destructive'
        });
      }
      return false;
    }
  }, [user, mosqueId, fetchReviews]);

  const markHelpful = useCallback(async (reviewId: string, isHelpful: boolean) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to rate reviews',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('review_helpfulness')
        .upsert({
          review_id: reviewId,
          user_id: user.id,
          is_helpful: isHelpful
        }, {
          onConflict: 'review_id,user_id'
        });

      if (error) throw error;

      await fetchReviews();

      toast({
        title: 'Thank You',
        description: 'Your feedback has been recorded'
      });
    } catch (error) {
      console.error('Error marking review helpful:', error);
      toast({
        title: 'Error',
        description: 'Failed to record your feedback',
        variant: 'destructive'
      });
    }
  }, [user, fetchReviews]);

  return {
    reviews,
    userReview,
    loading,
    averageRating,
    submitReview,
    markHelpful,
    hasUserReviewed: !!userReview
  };
};
