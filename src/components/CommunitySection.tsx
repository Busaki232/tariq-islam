import { useState, useEffect } from "react";
import { Users, MessageCircle, Calendar, MapPin, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroButton } from "@/components/ui/hero-button";
import { Badge } from "@/components/ui/badge";
import { CreatePostModal } from "./CreatePostModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import communityMosque from "@/assets/community-mosque.jpg";

interface CommunityPost {
  id: string;
  author: string;
  time: string;
  content: string;
  likes: number;
  comments: number;
  location?: string;
  sender_id: string;
}

type DbRow = {
  id: string;
  content: string | null;
  created_at: string;
  location: string | null;
  sender_id: string;
  likes?: number | null;
  comments?: number | null;
  likes_count?: number | null;
  comments_count?: number | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  }[] | {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const FALLBACK_POSTS: CommunityPost[] = [
  {
    id: "1",
    author: "Aisha Olumide",
    time: "2 hours ago",
    content:
      "Assalamu alaikum! Looking for a study group for Quran memorization in Chicago area. Anyone interested?",
    likes: 12,
    comments: 5,
    location: "Chicago, IL",
    sender_id: "mock1",
  },
  {
    id: "2",
    author: "Ibrahim Adamu",
    time: "5 hours ago",
    content:
      "Ramadan preparation workshop this weekend at Detroit Islamic Center. Free for all!",
    likes: 28,
    comments: 8,
    location: "Detroit, MI",
    sender_id: "mock2",
  },
  {
    id: "3",
    author: "Fatima Hassan",
    time: "1 day ago",
    content:
      "Islamic Cultural Night - Saturday 7PM. Traditional food, lectures, and community bonding",
    likes: 45,
    comments: 15,
    location: "Minneapolis, MN",
    sender_id: "mock3",
  },
];

const CommunitySection = () => {
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 3600) {
      const minutes = Math.floor(diff / 60);
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    } else {
      const days = Math.floor(diff / 86400);
      return `${days} ${days === 1 ? "day" : "days"} ago`;
    }
  };

const fetchCommunityPosts = async () => {
  setLoading(true);

  try {
    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        location,
        sender_id,
        profiles:profiles!messages_sender_id_profiles_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq("message_type", "community_post")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const rows = (data ?? []) as unknown as DbRow[];

    const posts: CommunityPost[] = rows.map((row) => {
      const createdAt = row.created_at
        ? new Date(row.created_at)
        : new Date();

      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        author: profile?.full_name ?? "Unknown",
        time: formatTimeAgo(createdAt),
        content: row.content ?? "",
        likes: 0,        // default since DB has no likes column
        comments: 0,     // default since DB has no comments column
        location: row.location ?? undefined,
        sender_id: row.sender_id,
      };
    });

    setCommunityPosts(posts);
    } catch (error: any) {
      logger.error("Error fetching posts", error);

      toast({
        title: "Error",
        description: error?.message ?? "Error fetching posts",
        variant: "destructive",
      });

      setCommunityPosts(FALLBACK_POSTS);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create a post.",
        variant: "destructive",
      });
      return;
    }
    setIsCreatePostOpen(true);
  };

  const handlePostCreated = () => {
    fetchCommunityPosts();
  };

  useEffect(() => {
    fetchCommunityPosts();
  }, []);

  const upcomingEvents = [
    {
      title: "Friday Prayer & Lecture",
      date: "Tomorrow",
      time: "1:00 PM",
      location: "Islamic Society of Greater Chicago",
      attendees: 124,
    },
    {
      title: "Muslim Youth Meet",
      date: "This Saturday",
      time: "3:00 PM",
      location: "Detroit Community Center",
      attendees: 67,
    },
    {
      title: "Islamic Financial Planning",
      date: "Next Sunday",
      time: "2:00 PM",
      location: "Milwaukee Islamic Center",
      attendees: 89,
    },
  ];

  return (
    <section
      id="community-section"
      className="py-16 bg-gradient-to-br from-secondary/30 to-background"
    >
      <div className="container mx-auto px-4">

        {/* … UI stays unchanged … */}

        <CreatePostModal
          isOpen={isCreatePostOpen}
          onClose={() => setIsCreatePostOpen(false)}
          onPostCreated={handlePostCreated}
        />
      </div>
    </section>
  );
};

export default CommunitySection;