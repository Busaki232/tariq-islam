import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Trash2,TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Report {
  id: string;
  reported_by: string | null;
  reported_user_id: string | null;
  content_type: string;
  content_id: string;
  report_type: string;
  description: string;
  status: string;
  is_auto_flagged: boolean;
  severity_score: number | null;
  created_at: string;
}
interface PendingReflection {
  id: string;
  user_id: string;
  title: string;
  caption: string | null;
  category: string;
  language: string;
  video_url: string;
  status: string;
  created_at: string;
  thumbnail_url: string | null;
  trim_start_seconds: number;
  trim_end_seconds: number | null;
  reference_type: string | null;
  quran_surah_number: number | null;
  quran_ayah_start: number | null;
  quran_ayah_end: number | null;
  hadith_collection: string | null;
  hadith_number: string | null;
  reference_note: string | null;
  creatorProfile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}
interface CreatorProfile {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_creator_verified: boolean;
}
interface PendingScholarLecture {
  id: string;
  scholar_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  language: string | null;
  status: string;
  is_featured: boolean;
  created_at: string;
  scholarProfile?: {
    display_name: string;
    user_id: string;
  } | null;
}

const ModerationDashboard = () => {
  const { user } = useAuth();
  const { isAdmin, isModerator, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([])

  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const [updatingCreatorId, setUpdatingCreatorId] = useState<string | null>(null);

  const [pendingReflections, setPendingReflections] = useState<
    PendingReflection[]
  >([]);
  const [allReflections, setAllReflections] = useState<
    PendingReflection[]
  >([]);

  const [allReflectionsLoading, setAllReflectionsLoading] =
    useState(true);
  const [reflectionsLoading, setReflectionsLoading] = useState(true);
  const [updatingReflectionId, setUpdatingReflectionId] = useState<
    string | null
  >(null);

const [pendingScholarLectures, setPendingScholarLectures] = useState<
  PendingScholarLecture[]
>([]);

const [scholarLecturesLoading, setScholarLecturesLoading] =
  useState(true);

const [updatingScholarLectureId, setUpdatingScholarLectureId] =
  useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    underReview: 0,
    resolved: 0,
    totalToday: 0
  });

  useEffect(() => {
    if (!rolesLoading && !isAdmin && !isModerator) {
      toast.error('Access denied. Moderator privileges required.');
      navigate('/');
    } else if (!rolesLoading && (isAdmin || isModerator)) {
      fetchReports();
      fetchStats();
      fetchPendingReflections();
      fetchAllReflections();
      fetchCreators();
      fetchPendingScholarLectures();
    }
  }, [isAdmin, isModerator, rolesLoading, navigate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('status, created_at');

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = (data || []).reduce((acc, report) => {
        if (report.status === 'pending') acc.pending++;
        if (report.status === 'under_review') acc.underReview++;
        if (report.status === 'resolved') acc.resolved++;
        if (new Date(report.created_at) >= today) acc.totalToday++;
        return acc;
      }, { pending: 0, underReview: 0, resolved: 0, totalToday: 0 });

      setStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

const  handleReflectionAction = async (
        reflectionId: string,
        status: "approved" | "rejected"
      ) => {
        if (!user?.id) return;

        setUpdatingReflectionId(reflectionId);

        try {
          const { error } = await supabase
            .from("reflection_videos")
            .update({
              status,
            })
            .eq("id", reflectionId);

          if (error) throw error;

          setPendingReflections((current) =>
            current.filter((reflection) => reflection.id !== reflectionId)
          );
      setAllReflections((current) =>
        current.filter(
          (reflection) => reflection.id !== reflectionId
        )
      );

          toast.success(
            status === "approved"
              ? "Reflection approved"
              : "Reflection rejected"
          );
        } catch (error) {
          console.error("Error updating reflection:", error);
          toast.error("Failed to update reflection");
        } finally {
          setUpdatingReflectionId(null);
        }
      };

  const handleDeleteReflection = async (
    reflectionId: string,
    reflectionTitle: string
  ) => {
    if (!user?.id) return;

    const confirmed = window.confirm(
      `Permanently delete "${reflectionTitle}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setUpdatingReflectionId(reflectionId);

    try {
    const { data, error } = await supabase.functions.invoke(
      "admin-delete-reflection",
      {
        body: {
          reflectionId,
        },
      }
    );

    if (error) throw error;

    if (!data?.success) {
      throw new Error(
        data?.error || "The reflection was not deleted."
      );
    }

      setPendingReflections((current) =>
        current.filter(
          (reflection) => reflection.id !== reflectionId
        )
      );

      toast.success("Reflection permanently deleted");
    } catch (error) {
      console.error("Error deleting reflection:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete reflection"
      );
    } finally {
      setUpdatingReflectionId(null);
    }
  };

const fetchPendingReflections = async () => {
  setReflectionsLoading(true);

  try {
    const { data: reflectionsData, error: reflectionsError } =
      await supabase
        .from("reflection_videos")
 .select(
   "id,user_id,title,caption,category,language,video_url,thumbnail_url,trim_start_seconds,trim_end_seconds,reference_type,quran_surah_number,quran_ayah_start,quran_ayah_end,hadith_collection,hadith_number,reference_note,status,created_at"
 )
        .eq("status", "pending")
        .order("created_at", { ascending: true });

    if (reflectionsError) throw reflectionsError;

    const reflections = reflectionsData ?? [];

    const creatorIds = [
      ...new Set(
        reflections.map((reflection) => reflection.user_id)
      ),
    ];

    let profilesByUserId: Record<
      string,
      {
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
      }
    > = {};

    if (creatorIds.length > 0) {
      const { data: profilesData, error: profilesError } =
        await supabase
          .from("profiles")
          .select("user_id,full_name,username,avatar_url")
          .in("user_id", creatorIds);

      if (profilesError) throw profilesError;

      profilesByUserId = Object.fromEntries(
        (profilesData ?? []).map((profile) => [
          profile.user_id,
          {
            full_name: profile.full_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
          },
        ])
      );
    }

    setPendingReflections(
      reflections.map((reflection) => ({
        ...reflection,
        creatorProfile:
          profilesByUserId[reflection.user_id] ?? null,
      }))
    );
  } catch (error: unknown) {
    console.error(
      "Error fetching pending reflections:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load pending reflections";

    toast.error(message);
  } finally {
    setReflectionsLoading(false);
  }
};
const fetchCreators = async () => {
  setCreatorsLoading(true);

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id,full_name,username,avatar_url,is_creator_verified"
      )
      .order("full_name", { ascending: true });

    if (error) throw error;

    setCreators(data || []);
  } catch (error) {
    console.error("Error fetching creators:", error);
    toast.error("Failed to load creators");
  } finally {
    setCreatorsLoading(false);
  }
};

const fetchAllReflections = async () => {
  setAllReflectionsLoading(true);

  try {
    const { data: reflectionsData, error: reflectionsError } =
      await supabase
        .from("reflection_videos")
        .select(
          "id,user_id,title,caption,category,language,video_url,thumbnail_url,trim_start_seconds,trim_end_seconds,reference_type,quran_surah_number,quran_ayah_start,quran_ayah_end,hadith_collection,hadith_number,reference_note,status,created_at"
        )
        .order("created_at", { ascending: false });

    if (reflectionsError) throw reflectionsError;

    const reflections = reflectionsData ?? [];

    const creatorIds = [
      ...new Set(
        reflections.map((reflection) => reflection.user_id)
      ),
    ];

    let profilesByUserId: Record<
      string,
      {
        full_name: string | null;
        username: string | null;
        avatar_url: string | null;
      }
    > = {};

    if (creatorIds.length > 0) {
      const { data: profileRows, error: profilesError } =
        await supabase
          .from("profiles")
          .select("user_id,full_name,username,avatar_url")
          .in("user_id", creatorIds);

      if (profilesError) throw profilesError;

      profilesByUserId = Object.fromEntries(
        (profileRows ?? []).map((profile) => [
          profile.user_id,
          {
            full_name: profile.full_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
          },
        ])
      );
    }

    setAllReflections(
      reflections.map((reflection) => ({
        ...reflection,
        creatorProfile:
          profilesByUserId[reflection.user_id] ?? null,
      }))
    );
  } catch (error) {
    console.error("Error fetching all reflections:", error);
    toast.error("Failed to load all reflections");
  } finally {
    setAllReflectionsLoading(false);
  }
};

const fetchPendingScholarLectures = async () => {
  setScholarLecturesLoading(true);

  try {
    const { data: lectureRows, error: lecturesError } =
      await supabase
        .from("scholar_lectures")
        .select(
          `
            id,
            scholar_id,
            title,
            description,
            video_url,
            thumbnail_url,
            category,
            language,
            status,
            is_featured,
            created_at
          `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });

    if (lecturesError) throw lecturesError;

    const lectures = lectureRows ?? [];

    const scholarIds = [
      ...new Set(
        lectures
          .map((lecture) => lecture.scholar_id)
          .filter(Boolean)
      ),
    ];

    let scholarsById: Record<
      string,
      {
        display_name: string;
        user_id: string;
      }
    > = {};

    if (scholarIds.length > 0) {
      const { data: scholarRows, error: scholarsError } =
        await supabase
          .from("scholar_profiles")
          .select("id,user_id,display_name")
          .in("id", scholarIds);

      if (scholarsError) throw scholarsError;

      scholarsById = Object.fromEntries(
        (scholarRows ?? []).map((scholar) => [
          scholar.id,
          {
            display_name: scholar.display_name,
            user_id: scholar.user_id,
          },
        ])
      );
    }


    setPendingScholarLectures(
      lectures.map((lecture) => ({
        ...lecture,
        scholarProfile:
          scholarsById[lecture.scholar_id] ?? null,
      }))
    );
  } catch (error) {
    console.error(
      "Error fetching pending scholar lectures:",
      error
    );

    toast.error("Failed to load pending scholar lectures");
  } finally {
    setScholarLecturesLoading(false);
  }
};
const handleScholarLectureAction = async (
  lectureId: string,
  status: "approved" | "rejected"
) => {
  if (!user?.id) return;

  setUpdatingScholarLectureId(lectureId);

  try {
    const { error } = await supabase
      .from("scholar_lectures")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lectureId);

    if (error) throw error;

    setPendingScholarLectures((current) =>
      current.filter((lecture) => lecture.id !== lectureId)
    );

    toast.success(
      status === "approved"
        ? "Scholar lecture approved"
        : "Scholar lecture rejected"
    );
  } catch (error) {
    console.error(
      "Error updating scholar lecture:",
      error
    );

    toast.error("Failed to update scholar lecture");
  } finally {
    setUpdatingScholarLectureId(null);
  }
};

  const handleReportAction = async (
    reportId: string,
    action: 'under_review' | 'resolved' | 'dismissed',
    notes?: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: action,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          resolution_notes: notes || null
        })
        .eq('id', reportId);

      if (error) throw error;

      toast.success(`Report ${action === 'resolved' ? 'resolved' : action === 'dismissed' ? 'dismissed' : 'moved to review'}`);
      fetchReports();
      fetchStats();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Failed to update report');
    }
  };

  const takeModerationAction = async (
    reportId: string,
    userId: string,
    actionType: 'warning' | 'content_removed' | 'user_suspended' | 'user_banned',
    reason: string,
    contentType?: string,
    contentId?: string
  ) => {
    if (!user) return;

    try {
      const { error: logError } = await supabase
        .from('moderation_logs')
        .insert({
          moderator_id: user.id,
          target_user_id: userId,
          report_id: reportId,
          action_type: actionType,
          reason: reason,
          content_type: contentType,
          content_id: contentId
        });

      if (logError) throw logError;

      // If suspension or ban, create suspension record
      if (actionType === 'user_suspended' || actionType === 'user_banned') {
        const { error: suspensionError } = await supabase
          .from('user_suspensions')
          .insert({
            user_id: userId,
            suspended_by: user.id,
            reason: reason,
            is_permanent: actionType === 'user_banned',
            expires_at: actionType === 'user_suspended' 
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
              : null
          });

        if (suspensionError) throw suspensionError;
      }

      await handleReportAction(reportId, 'resolved', reason);
      toast.success('Moderation action completed');
    } catch (error) {
      console.error('Error taking moderation action:', error);
      toast.error('Failed to complete moderation action');
    }
  };

  const getStatusBadge = (status: string, isAutoFlagged: boolean) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'destructive',
      under_review: 'default',
      resolved: 'secondary',
      dismissed: 'outline'
    };

    return (
      <div className="flex gap-2">
        <Badge variant={variants[status] || 'default'}>
          {status.replace('_', ' ')}
        </Badge>
        {isAutoFlagged && (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
            Auto-Flagged
          </Badge>
        )}
      </div>
    );
  };

  const getSeverityColor = (severity: number | null) => {
    if (!severity) return 'text-muted-foreground';
    if (severity >= 80) return 'text-destructive';
    if (severity >= 50) return 'text-orange-600';
    return 'text-yellow-600';
  };

  if (rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin && !isModerator) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-islamic-green" />
          <div>
            <h1 className="text-3xl font-bold">Moderation Dashboard</h1>
            <p className="text-muted-foreground">Content moderation and community safety</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Under Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.underReview}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-islamic-green" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalToday}</div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2">
            <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>

            <TabsTrigger value="under_review">Under Review ({stats.underReview})</TabsTrigger>

            <TabsTrigger value="resolved">Resolved</TabsTrigger>

            <TabsTrigger value="all">All Reports</TabsTrigger>

                     <TabsTrigger value="reflections">
                       Reflections ({pendingReflections.length})
                     </TabsTrigger>
                     <TabsTrigger value="scholar-lectures">
                       Scholar Lectures ({pendingScholarLectures.length})
                     </TabsTrigger>
                     <TabsContent
                       value="scholar-lectures"
                       className="space-y-4"
                     >
                       {scholarLecturesLoading ? (
                         <Card>
                           <CardContent className="py-8 text-center text-muted-foreground">
                             Loading pending scholar lectures...
                           </CardContent>
                         </Card>
                       ) : pendingScholarLectures.length === 0 ? (
                         <Card>
                           <CardContent className="py-8 text-center text-muted-foreground">
                             No scholar lectures are waiting for approval.
                           </CardContent>
                         </Card>
                       ) : (
                         pendingScholarLectures.map((lecture) => (
                           <Card key={lecture.id}>
                             <CardHeader>
                               <div className="flex items-start justify-between gap-4">
                                 <div>
                                   <CardTitle>{lecture.title}</CardTitle>

                                   <CardDescription>
                                     Submitted{" "}
                                     {new Date(
                                       lecture.created_at
                                     ).toLocaleString()}
                                   </CardDescription>
                                 </div>

                                 <Badge variant="outline">Pending</Badge>
                               </div>
                             </CardHeader>

                             <CardContent className="space-y-4">
                               {lecture.thumbnail_url ? (
                                 <div className="relative overflow-hidden rounded-xl bg-black">
                                   <img
                                     src={lecture.thumbnail_url}
                                     alt={lecture.title}
                                     className="max-h-[55vh] w-full object-contain"
                                   />

                                   <Button
                                     type="button"
                                     variant="secondary"
                                     className="absolute bottom-4 left-4"
                                     onClick={() => {
                                       const video =
                                         document.getElementById(
                                           `scholar-lecture-video-${lecture.id}`
                                         ) as HTMLVideoElement | null;

                                       if (!video) return;

                                       video.classList.remove("hidden");
                                       void video.play();
                                     }}
                                   >
                                     Play Lecture
                                   </Button>

                                   <video
                                     id={`scholar-lecture-video-${lecture.id}`}
                                     src={lecture.video_url}
                                     controls
                                     playsInline
                                     preload="metadata"
                                     className="hidden max-h-[55vh] w-full rounded-xl bg-black object-contain"
                                   />
                                 </div>
                               ) : (
                                 <video
                                   src={lecture.video_url}
                                   controls
                                   playsInline
                                   preload="metadata"
                                   className="max-h-[55vh] w-full rounded-xl bg-black object-contain"
                                 />
                               )}

                               <div className="space-y-3">
                                 {lecture.description && (
                                   <p className="whitespace-pre-wrap text-sm">
                                     {lecture.description}
                                   </p>
                                 )}

                                 <div className="flex flex-wrap gap-2">
                                   {lecture.category && (
                                     <Badge variant="secondary">
                                       {lecture.category}
                                     </Badge>
                                   )}

                                   {lecture.language && (
                                     <Badge variant="secondary">
                                       {lecture.language}
                                     </Badge>
                                   )}

                                   {lecture.is_featured && (
                                     <Badge>Featured</Badge>
                                   )}
                                 </div>

                                 <p className="text-sm font-medium">
                                   Scholar:{" "}
                                   {lecture.scholarProfile?.display_name ||
                                     "Unknown scholar"}
                                 </p>
                               </div>

                               <div className="flex flex-wrap gap-3">
                                 <Button
                                   type="button"
                                   onClick={() =>
                                     void handleScholarLectureAction(
                                       lecture.id,
                                       "approved"
                                     )
                                   }
                                   disabled={
                                     updatingScholarLectureId === lecture.id
                                   }
                                 >
                                   <CheckCircle className="mr-2 h-4 w-4" />
                                   Approve
                                 </Button>

                                 <Button
                                   type="button"
                                   variant="destructive"
                                   onClick={() => {
                                     const confirmed = window.confirm(
                                       `Reject "${lecture.title}"?`
                                     );

                                     if (confirmed) {
                                       void handleScholarLectureAction(
                                         lecture.id,
                                         "rejected"
                                       );
                                     }
                                   }}
                                   disabled={
                                     updatingScholarLectureId === lecture.id
                                   }
                                 >
                                   <XCircle className="mr-2 h-4 w-4" />
                                   Reject
                                 </Button>
                               </div>
                             </CardContent>
                           </Card>
                         ))
                       )}
                     </TabsContent>

<TabsTrigger value="all-reflections">
  All Reflections ({allReflections.length})
</TabsTrigger>
                     <TabsTrigger value="creators">
                       Creators ({creators.length})
                     </TabsTrigger>
                   </TabsList>

  {['pending', 'under_review', 'resolved', 'all'].map((status) => (
    <TabsContent key={status} value={status} className="space-y-4">
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading reports...
          </CardContent>
        </Card>
      ) : (
        reports
          .filter((r) => status === 'all' || r.status === status)
          .map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              getStatusBadge={getStatusBadge}
              getSeverityColor={getSeverityColor}
              handleReportAction={handleReportAction}
              takeModerationAction={takeModerationAction}
            />
          ))
      )}
    </TabsContent>
  ))}

  <TabsContent value="reflections" className="space-y-4">
    {reflectionsLoading ? (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading pending reflections...
        </CardContent>
      </Card>
    ) : pendingReflections.length === 0 ? (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No reflections are waiting for approval.
        </CardContent>
      </Card>
    ) : (
      pendingReflections.map((reflection) => (
        <Card key={reflection.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{reflection.title}</CardTitle>
                <CardDescription>
                  Submitted {new Date(reflection.created_at).toLocaleString()}
                </CardDescription>
              </div>

              <Badge variant="outline">Pending</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
 {reflection.thumbnail_url ? (
   <div className="relative overflow-hidden rounded-xl bg-black">
     <img
       src={reflection.thumbnail_url}
       alt={reflection.title}
       className="max-h-[55vh] w-full object-contain"
     />

     <Button
       type="button"
       variant="secondary"
       className="absolute bottom-4 left-4"
       onClick={() => {
         const video = document.getElementById(
           `moderation-video-${reflection.id}`
         ) as HTMLVideoElement | null;

         if (!video) return;

         const start = Number(
           reflection.trim_start_seconds ?? 0
         );

         video.classList.remove("hidden");
         video.currentTime = start;
         void video.play();
       }}
     >
       Play Video
     </Button>

     <video
       id={`moderation-video-${reflection.id}`}
       src={reflection.video_url}
       controls
       playsInline
       preload="metadata"
       crossOrigin="anonymous"
       onLoadedMetadata={(event) => {
         const video = event.currentTarget;
         const start = Number(
           reflection.trim_start_seconds ?? 0
         );

         if (start > 0 && start < video.duration) {
           video.currentTime = start;
         }
       }}
       onPlay={(event) => {
         const video = event.currentTarget;
         const start = Number(
           reflection.trim_start_seconds ?? 0
         );
         const end =
           reflection.trim_end_seconds === null
             ? null
             : Number(reflection.trim_end_seconds);

         if (
           video.currentTime < start ||
           (end !== null && video.currentTime >= end)
         ) {
           video.currentTime = start;
         }
       }}
       onTimeUpdate={(event) => {
         const video = event.currentTarget;
         const start = Number(
           reflection.trim_start_seconds ?? 0
         );
         const end =
           reflection.trim_end_seconds === null
             ? null
             : Number(reflection.trim_end_seconds);

         if (end !== null && video.currentTime >= end) {
           video.currentTime = start;
           void video.play();
         }
       }}
       className="hidden max-h-[55vh] w-full rounded-xl bg-black object-contain"
     />
   </div>
 ) : (
   <video
     src={reflection.video_url}
     controls
     playsInline
     preload="metadata"
     crossOrigin="anonymous"
     onLoadedMetadata={(event) => {
       const video = event.currentTarget;
       const start = Number(
         reflection.trim_start_seconds ?? 0
       );

       if (start > 0 && start < video.duration) {
         video.currentTime = start;
       }
     }}
     onPlay={(event) => {
       const video = event.currentTarget;
       const start = Number(
         reflection.trim_start_seconds ?? 0
       );
       const end =
         reflection.trim_end_seconds === null
           ? null
           : Number(reflection.trim_end_seconds);

       if (
         video.currentTime < start ||
         (end !== null && video.currentTime >= end)
       ) {
         video.currentTime = start;
       }
     }}
     onTimeUpdate={(event) => {
       const video = event.currentTarget;
       const start = Number(
         reflection.trim_start_seconds ?? 0
       );
       const end =
         reflection.trim_end_seconds === null
           ? null
           : Number(reflection.trim_end_seconds);

       if (end !== null && video.currentTime >= end) {
         video.currentTime = start;
         void video.play();
       }
     }}
     className="max-h-[55vh] w-full rounded-xl bg-black object-contain"
   />
 )}


            <div className="space-y-2">
              {reflection.caption && (
                <p className="text-sm">{reflection.caption}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{reflection.category}</Badge>
                <Badge variant="secondary">{reflection.language}</Badge>
              </div>
              {reflection.reference_type === "quran" &&
                reflection.quran_surah_number &&
                reflection.quran_ayah_start && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">
                      Quran {reflection.quran_surah_number}:
                      {reflection.quran_ayah_start}
                      {reflection.quran_ayah_end &&
                        reflection.quran_ayah_end !==
                          reflection.quran_ayah_start &&
                        `-${reflection.quran_ayah_end}`}
                    </p>

                    {reflection.reference_note && (
                      <p className="mt-1 text-muted-foreground">
                        {reflection.reference_note}
                      </p>
                    )}
                  </div>
                )}

              {reflection.reference_type === "hadith" && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    {reflection.hadith_collection || "Hadith"}
                    {reflection.hadith_number
                      ? `, Hadith ${reflection.hadith_number}`
                      : ""}
                  </p>

                  {reflection.reference_note && (
                    <p className="mt-1 text-muted-foreground">
                      {reflection.reference_note}
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm font-medium">
                Creator:{" "}
                {reflection.creatorProfile?.full_name ||
                  reflection.creatorProfile?.username ||
                  "Unknown creator"}
              </p>

              {reflection.creatorProfile?.username && (
                <p className="text-xs text-muted-foreground">
                  @{reflection.creatorProfile.username}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() =>
                  void handleReflectionAction(reflection.id, "approved")
                }
                disabled={updatingReflectionId === reflection.id}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const confirmed = window.confirm(
                    "Reject this reflection?"
                  );

                  if (confirmed) {
                    void handleReflectionAction(
                      reflection.id,
                      "rejected"
                    );
                  }
                }}
                disabled={updatingReflectionId === reflection.id}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() =>
                  void handleDeleteReflection(
                    reflection.id,
                    reflection.title
                  )
                }
                disabled={updatingReflectionId === reflection.id}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </Button>
            </div>

          </CardContent>
        </Card>
      ))
    )}
  </TabsContent>

  <TabsContent value="all-reflections" className="space-y-4">
    {allReflectionsLoading ? (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading all reflections...
        </CardContent>
      </Card>
    ) : allReflections.length === 0 ? (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No reflections found.
        </CardContent>
      </Card>
    ) : (
      allReflections.map((reflection) => (
        <Card key={reflection.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{reflection.title}</CardTitle>

                <CardDescription>
                  Submitted{" "}
                  {new Date(reflection.created_at).toLocaleString()}
                </CardDescription>
              </div>

              <Badge variant="outline">
                {reflection.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <video
              src={reflection.video_url}
              controls
              playsInline
              className="max-h-[520px] w-full rounded-xl bg-black"
            />

            <div>
              <p className="font-medium">
                {reflection.category} • {reflection.language}
              </p>

              {reflection.caption && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {reflection.caption}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium">
                Creator:{" "}
                {reflection.creatorProfile?.full_name ||
                  reflection.creatorProfile?.username ||
                  "Unknown creator"}
              </p>

              {reflection.creatorProfile?.username && (
                <p className="text-xs text-muted-foreground">
                  @{reflection.creatorProfile.username}
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void handleDeleteReflection(
                  reflection.id,
                  reflection.title
                )
              }
              disabled={
                updatingReflectionId === reflection.id
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Permanently
            </Button>
          </CardContent>
        </Card>
      ))
    )}
  </TabsContent>

<TabsContent value="creators" className="space-y-4">
  {creatorsLoading ? (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        Loading creators...
      </CardContent>
    </Card>
  ) : creators.length === 0 ? (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        No creator profiles found.
      </CardContent>
    </Card>
  ) : (
    creators.map((creator) => (
      <Card key={creator.user_id}>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.full_name || creator.username || ""}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-islamic-green font-bold text-white">
                {(creator.full_name || creator.username || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate font-semibold">
                {creator.full_name ||
                  creator.username ||
                  "Tariq Islam User"}
              </p>

              {creator.username && (
                <p className="truncate text-sm text-muted-foreground">
                  @{creator.username}
                </p>
              )}

              <Badge
                variant={
                  creator.is_creator_verified
                    ? "default"
                    : "outline"
                }
                className="mt-2"
              >
                {creator.is_creator_verified
                  ? "Verified"
                  : "Not verified"}
              </Badge>
            </div>
          </div>

          <Button
            type="button"
            variant={
              creator.is_creator_verified
                ? "destructive"
                : "default"
            }
            disabled={updatingCreatorId === creator.user_id}
            onClick={() =>
              void handleCreatorVerification(
                creator.user_id,
                !creator.is_creator_verified
              )
            }
            className="w-full sm:w-auto"
          >
            {updatingCreatorId === creator.user_id
              ? "Updating..."
              : creator.is_creator_verified
                ? "Remove Verification"
                : "Verify Creator"}
          </Button>
        </CardContent>
      </Card>
    ))
  )}
</TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

// Report Card Component
const ReportCard = ({
    report, getStatusBadge, getSeverityColor, handleReportAction, takeModerationAction }: any) => {
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('');
  const [showActions, setShowActions] = useState(false);


  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {report.report_type.replace('_', ' ').toUpperCase()} - {report.content_type}
            </CardTitle>
            <CardDescription>
              Reported {new Date(report.created_at).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(report.status, report.is_auto_flagged)}
            {report.severity_score && (
              <div className={`text-sm font-medium ${getSeverityColor(report.severity_score)}`}>
                Severity: {report.severity_score}/100
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-1">Description:</p>
          <p className="text-sm text-muted-foreground">{report.description}</p>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Content ID: {report.content_id}</p>
          {report.reported_user_id && <p>Reported User ID: {report.reported_user_id}</p>}
        </div>

        {report.status === 'pending' || report.status === 'under_review' ? (
          <>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReportAction(report.id, 'under_review')}
              >
                <Clock className="w-4 h-4 mr-2" />
                Start Review
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowActions(!showActions)}
              >
                Take Action
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReportAction(report.id, 'dismissed', 'No violation found')}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Dismiss
              </Button>
            </div>

            {showActions && (
              <div className="space-y-3 pt-3 border-t">
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select moderation action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Issue Warning</SelectItem>
                    <SelectItem value="content_removed">Remove Content</SelectItem>
                    <SelectItem value="user_suspended">Suspend User (7 days)</SelectItem>
                    <SelectItem value="user_banned">Ban User (Permanent)</SelectItem>
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Reason for action (required)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />

                <Button
                  onClick={() => {
                    if (notes.trim().length < 10) {
                      toast.error('Please provide a detailed reason');
                      return;
                    }
                    if (report.reported_user_id) {
                      takeModerationAction(
                        report.id,
                        report.reported_user_id,
                        action as any,
                        notes,
                        report.content_type,
                        report.content_id
                      );
                    }
                  }}
                  disabled={!action || notes.trim().length < 10}
                  className="w-full"
                >
                  Confirm Action
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            {report.resolution_notes && (
              <>
                <p className="font-medium">Resolution Notes:</p>
                <p>{report.resolution_notes}</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ModerationDashboard;
