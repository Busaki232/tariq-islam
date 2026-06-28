import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MyAdCard } from '@/components/MyAdCard';
import { HeroButton } from '@/components/ui/hero-button';
import { Plus, Store } from 'lucide-react';

interface Advertisement {
  id: string;
  title: string;
  description: string;
  location: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  image_url: string | null;
  featured: boolean;
  view_count: number;
  status: string;
  created_at: string;
  category_id: string;
  categories?: {
    name: string;
    slug: string;
  };
}

const MyAds = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchMyAds();
  }, [user, navigate]);

  const fetchMyAds = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*, categories(name, slug)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAds(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load your ads',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Advertisement deleted successfully',
      });
      
      fetchMyAds();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete advertisement',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="container mx-auto px-4">
          <p className="text-center text-muted-foreground">Loading your ads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              My Advertisements
            </h1>
            <p className="text-muted-foreground">
              Manage your business listings and track their performance
            </p>
          </div>
          <HeroButton onClick={() => navigate('/submit-ad')}>
            <Plus className="w-4 h-4 mr-2" />
            Post New Ad
          </HeroButton>
        </div>

        {ads.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <Store className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              No Advertisements Yet
            </h2>
            <p className="text-muted-foreground mb-6">
              Start promoting your business to the community today
            </p>
            <HeroButton onClick={() => navigate('/submit-ad')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Ad
            </HeroButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {ads.map((ad) => (
              <MyAdCard
                key={ad.id}
                ad={ad}
                onDelete={handleDelete}
                onUpdate={fetchMyAds}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAds;
