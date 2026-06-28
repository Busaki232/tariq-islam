import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Calendar,
  Building,
  MessageSquare,
  Users,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useTranslation } from "react-i18next";

interface UserStats {
  advertisements: number;
  events: number;
  mosqueSubmissions: number;
  leadershipApplications: number;
  messages: number;
}

interface Advertisement {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  view_count: number;
}

interface EventRow {
  id: string;
  title: string;
  description: string;
  event_date: string;
  status: string;
  created_at: string;
  attendees_count: number;
}

interface MosqueSubmission {
  id: string;
  mosque_name: string;
  city: string;
  state: string;
  status: string;
  created_at: string;
}

interface LeadershipApplication {
  id: string;
  full_name: string;
  location: string;
  status: string;
  created_at: string;
}

async function withTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

const Dashboard = () => {
  const { t, i18n } = useTranslation(["dashboard", "common"]);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    full_name: string;
    location: string;
    avatar_url: string | null;
  } | null>(null);

  const [stats, setStats] = useState<UserStats>({
    advertisements: 0,
    events: 0,
    mosqueSubmissions: 0,
    leadershipApplications: 0,
    messages: 0,
  });

  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [mosqueSubmissions, setMosqueSubmissions] = useState<MosqueSubmission[]>(
    []
  );
  const [leadershipApplications, setLeadershipApplications] = useState<
    LeadershipApplication[]
  >([]);

  const fetchUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const kill = setTimeout(() => {
      setLoading(false);
      toast.error(t("dashboard:errors.takingTooLong", { defaultValue: "Dashboard is taking too long to load." }));
    }, 15000);

    try {
      try {
        const profileRes = await withTimeout(
          supabase
            .from("profiles")
            .select("full_name, location, avatar_url")
            .eq("user_id", user.id)
            .single(),
          12000
        );
        if (profileRes?.data) setProfile(profileRes.data as any);
      } catch (e) {
        logger?.error?.("Error fetching profile", e);
      }

      const [adsRes, eventsRes, mosquesRes, leadershipRes, messagesRes] =
        await Promise.all([
          withTimeout(
            supabase
              .from("advertisements")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false }),
            12000
          ),
          withTimeout(
            supabase
              .from("events")
              .select("*")
              .eq("organizer_id", user.id)
              .order("created_at", { ascending: false }),
            12000
          ),
          withTimeout(
            supabase
              .from("mosque_submissions")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false }),
            12000
          ),
          withTimeout(
            supabase
              .from("leadership_applications")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false }),
            12000
          ),
          withTimeout(
            supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .eq("sender_id", user.id),
            12000
          ),
        ]);

      if (adsRes.error) throw adsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (mosquesRes.error) throw mosquesRes.error;
      if (leadershipRes.error) throw leadershipRes.error;
      if (messagesRes.error) throw messagesRes.error;

      const ads = (adsRes.data ?? []) as Advertisement[];
      const userEvents = (eventsRes.data ?? []) as EventRow[];
      const mosques = (mosquesRes.data ?? []) as MosqueSubmission[];
      const leadership = (leadershipRes.data ?? []) as LeadershipApplication[];

      setAdvertisements(ads);
      setEvents(userEvents);
      setMosqueSubmissions(mosques);
      setLeadershipApplications(leadership);

      setStats({
        advertisements: ads.length,
        events: userEvents.length,
        mosqueSubmissions: mosques.length,
        leadershipApplications: leadership.length,
        // @ts-ignore
        messages: (messagesRes.count as number | null) ?? 0,
      });
    } catch (error: any) {
      logger.error("Error fetching user data", error);
      toast.error(
        error?.message === "timeout"
          ? t("dashboard:errors.timedOut", { defaultValue: "Dashboard timed out" })
          : t("dashboard:errors.failedToLoad", { defaultValue: "Failed to load dashboard data" })
      );

      setAdvertisements([]);
      setEvents([]);
      setMosqueSubmissions([]);
      setLeadershipApplications([]);
      setStats({
        advertisements: 0,
        events: 0,
        mosqueSubmissions: 0,
        leadershipApplications: 0,
        messages: 0,
      });
    } finally {
      clearTimeout(kill);
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "declined":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "upcoming":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "declined":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString(i18n.language || undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">
                {t("dashboard:loading", { defaultValue: "Loading dashboard..." })}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        <Card className="mb-8">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-muted">
                <AvatarImage
                  src={profile?.avatar_url || undefined}
                  alt={profile?.full_name || ""}
                />
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ||
                    user?.email?.charAt(0)?.toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">
                  {profile?.full_name ||
                    t("dashboard:welcome", { defaultValue: "Welcome!" })}
                </h2>
                <p className="text-muted-foreground">{user?.email}</p>
                {profile?.location && (
                  <p className="text-sm text-muted-foreground">
                    {profile.location}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/settings")}
              className="gap-2"
              type="button"
            >
              <Settings className="h-4 w-4" />
              {t("dashboard:editProfile", { defaultValue: "Edit Profile" })}
            </Button>
          </CardContent>
        </Card>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {t("dashboard:title", { defaultValue: "My Dashboard" })}
          </h1>
          <p className="text-muted-foreground">
            {t("dashboard:subtitle", {
              defaultValue: "Track your contributions and activity in the community",
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard:stats.myAds", { defaultValue: "My Ads" })}
              </CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.advertisements}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard:stats.myEvents", { defaultValue: "My Events" })}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.events}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard:stats.mosques", { defaultValue: "Mosques" })}
              </CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.mosqueSubmissions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard:stats.applications", { defaultValue: "Applications" })}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.leadershipApplications}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard:stats.messages", { defaultValue: "Messages" })}
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.messages}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              {t("dashboard:quickActions.title", { defaultValue: "Quick Actions" })}
            </CardTitle>
            <CardDescription>
              {t("dashboard:quickActions.subtitle", {
                defaultValue: "Create new content or manage existing submissions",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                type="button"
                onClick={() => navigate("/submit-ad")}
                className="h-auto p-4 flex flex-col items-center gap-2"
              >
                <ShoppingBag className="w-6 h-6" />
                <span>{t("dashboard:actions.listBusiness", { defaultValue: "List Business" })}</span>
              </Button>
              <Button
                type="button"
                onClick={() => navigate("/events")}
                className="h-auto p-4 flex flex-col items-center gap-2"
              >
                <Calendar className="w-6 h-6" />
                <span>{t("dashboard:actions.createEvent", { defaultValue: "Create Event" })}</span>
              </Button>
              <Button
                type="button"
                onClick={() => navigate("/submit-mosque")}
                className="h-auto p-4 flex flex-col items-center gap-2"
              >
                <Building className="w-6 h-6" />
                <span>{t("dashboard:actions.submitMosque", { defaultValue: "Submit Mosque" })}</span>
              </Button>
              <Button
                type="button"
                onClick={() => navigate("/apply-leadership")}
                className="h-auto p-4 flex flex-col items-center gap-2"
              >
                <Users className="w-6 h-6" />
                <span>{t("dashboard:actions.applyLeadership", { defaultValue: "Apply Leadership" })}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="advertisements" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="advertisements">
              {t("dashboard:tabs.myAds", { defaultValue: "My Ads" })} ({stats.advertisements})
            </TabsTrigger>
            <TabsTrigger value="events">
              {t("dashboard:tabs.myEvents", { defaultValue: "My Events" })} ({stats.events})
            </TabsTrigger>
            <TabsTrigger value="mosques">
              {t("dashboard:tabs.mosques", { defaultValue: "Mosques" })} ({stats.mosqueSubmissions})
            </TabsTrigger>
            <TabsTrigger value="leadership">
              {t("dashboard:tabs.applications", { defaultValue: "Applications" })} ({stats.leadershipApplications})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="advertisements" className="space-y-4">
            {advertisements.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {t("dashboard:empty.adsTitle", { defaultValue: "No advertisements yet" })}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t("dashboard:empty.adsSubtitle", {
                      defaultValue: "Start by listing your first business or service",
                    })}
                  </p>
                  <Button type="button" onClick={() => navigate("/submit-ad")}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("dashboard:empty.adsCta", { defaultValue: "Create First Ad" })}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {advertisements.map((ad) => (
                  <Card key={ad.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="line-clamp-2">{ad.title}</CardTitle>
                        <Badge className={getStatusColor(ad.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(ad.status)}
                            {t(`dashboard:status.${ad.status}`, { defaultValue: ad.status })}
                          </div>
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {ad.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          {t("dashboard:labels.views", { defaultValue: "{{count}} views", count: ad.view_count })}
                        </div>
                        <div>
                          {t("dashboard:labels.created", { defaultValue: "Created: {{date}}", date: formatDate(ad.created_at) })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {events.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {t("dashboard:empty.eventsTitle", { defaultValue: "No events yet" })}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t("dashboard:empty.eventsSubtitle", { defaultValue: "Create your first community event" })}
                  </p>
                  <Button type="button" onClick={() => navigate("/events")}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("dashboard:empty.eventsCta", { defaultValue: "Create Event" })}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((event) => (
                  <Card key={event.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="line-clamp-2">{event.title}</CardTitle>
                        <Badge className={getStatusColor(event.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(event.status)}
                            {t(`dashboard:status.${event.status}`, { defaultValue: event.status })}
                          </div>
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {event.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {t("dashboard:labels.attending", {
                            defaultValue: "{{count}} attending",
                            count: event.attendees_count,
                          })}
                        </div>
                        <div>
                          {t("dashboard:labels.eventDate", {
                            defaultValue: "Event Date: {{date}}",
                            date: formatDate(event.event_date),
                          })}
                        </div>
                        <div>
                          {t("dashboard:labels.created", {
                            defaultValue: "Created: {{date}}",
                            date: formatDate(event.created_at),
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mosques" className="space-y-4">
            {mosqueSubmissions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {t("dashboard:empty.mosquesTitle", { defaultValue: "No mosque submissions yet" })}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t("dashboard:empty.mosquesSubtitle", { defaultValue: "Help expand our mosque directory" })}
                  </p>
                  <Button type="button" onClick={() => navigate("/submit-mosque")}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("dashboard:empty.mosquesCta", { defaultValue: "Submit Mosque" })}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mosqueSubmissions.map((mosque) => (
                  <Card key={mosque.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="line-clamp-2">
                          {mosque.mosque_name}
                        </CardTitle>
                        <Badge className={getStatusColor(mosque.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(mosque.status)}
                            {t(`dashboard:status.${mosque.status}`, { defaultValue: mosque.status })}
                          </div>
                        </Badge>
                      </div>
                      <CardDescription>
                        {mosque.city}, {mosque.state}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {t("dashboard:labels.submitted", {
                          defaultValue: "Submitted: {{date}}",
                          date: formatDate(mosque.created_at),
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leadership" className="space-y-4">
            {leadershipApplications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {t("dashboard:empty.leadershipTitle", { defaultValue: "No leadership applications yet" })}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t("dashboard:empty.leadershipSubtitle", { defaultValue: "Apply to become a community leader" })}
                  </p>
                  <Button type="button" onClick={() => navigate("/apply-leadership")}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("dashboard:empty.leadershipCta", { defaultValue: "Apply Now" })}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leadershipApplications.map((app) => (
                  <Card key={app.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="line-clamp-2">
                          {t("dashboard:labels.leadershipApplication", { defaultValue: "Leadership Application" })}
                        </CardTitle>
                        <Badge className={getStatusColor(app.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(app.status)}
                            {t(`dashboard:status.${app.status}`, { defaultValue: app.status })}
                          </div>
                        </Badge>
                      </div>
                      <CardDescription>{app.location}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {t("dashboard:labels.applied", {
                          defaultValue: "Applied: {{date}}",
                          date: formatDate(app.created_at),
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;