import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

type FollowStatus = "none" | "pending" | "accepted" | "follow_back";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams();
  const { t } = useTranslation("common");

  const profileUserId = useMemo(
    () => userId || user?.id || "",
    [userId, user?.id]
  );

  const isOwnProfile = !!user?.id && profileUserId === user.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editing, setEditing] = useState(false);

  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");

  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);
  const [followStatus, setFollowStatus] = useState<FollowStatus>("none");

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      if (!profileUserId) return;

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, user_id, full_name, location, avatar_url, bio")
          .eq("user_id", profileUserId)
          .maybeSingle();

        if (error) throw error;
        if (!alive) return;

        setFullName(data?.full_name ?? "");
        setLocation(data?.location ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
        setBio(data?.bio ?? "");
      } catch (error) {
        console.error("[Profile] Failed to load profile:", error);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      alive = false;
    };
  }, [profileUserId]);

  useEffect(() => {
    let alive = true;

    async function loadConnections() {
      if (!user?.id || !profileUserId) return;

      try {
        const { data, error } = await supabase
          .from("user_connections")
          .select("requester_id, receiver_id, status")
          .or(
            `requester_id.eq.${profileUserId},receiver_id.eq.${profileUserId},requester_id.eq.${user.id},receiver_id.eq.${user.id}`
          );

        if (error) throw error;
        if (!alive) return;

        const rows = data || [];

        const sentRequest = rows.find(
          (c: any) =>
            c.requester_id === user.id &&
            c.receiver_id === profileUserId &&
            c.status === "pending"
        );

        const acceptedConnection = rows.find(
          (c: any) =>
            ((c.requester_id === user.id && c.receiver_id === profileUserId) ||
              (c.requester_id === profileUserId && c.receiver_id === user.id)) &&
            c.status === "accepted"
        );

        const followsMe = rows.find(
          (c: any) =>
            c.requester_id === profileUserId &&
            c.receiver_id === user.id &&
            c.status === "accepted"
        );

        if (acceptedConnection) {
          setFollowStatus("accepted");
        } else if (sentRequest) {
          setFollowStatus("pending");
        } else if (followsMe) {
          setFollowStatus("follow_back");
        } else {
          setFollowStatus("none");
        }

        const acceptedRows = rows.filter((c: any) => c.status === "accepted");

        const followers = acceptedRows.filter(
          (c: any) => c.receiver_id === profileUserId
        );

        const following = acceptedRows.filter(
          (c: any) => c.requester_id === profileUserId
        );

        const profileConnections = acceptedRows
          .filter(
            (c: any) =>
              c.requester_id === profileUserId || c.receiver_id === profileUserId
          )
          .map((c: any) =>
            c.requester_id === profileUserId ? c.receiver_id : c.requester_id
          );

        const myConnections = acceptedRows
          .filter((c: any) => c.requester_id === user.id || c.receiver_id === user.id)
          .map((c: any) =>
            c.requester_id === user.id ? c.receiver_id : c.requester_id
          );

        const uniqueProfileConnections = Array.from(new Set(profileConnections));
        const uniqueMyConnections = Array.from(new Set(myConnections));

        const mutuals = uniqueProfileConnections.filter((id) =>
          uniqueMyConnections.includes(id)
        );

        setConnectionsCount(uniqueProfileConnections.length);
        setFollowersCount(followers.length);
        setFollowingCount(following.length);
        setMutualCount(isOwnProfile ? 0 : mutuals.length);
      } catch (error) {
        console.error("[Profile] Failed to load connections:", error);
        if (alive) {
          setConnectionsCount(0);
          setFollowersCount(0);
          setFollowingCount(0);
          setMutualCount(0);
          setFollowStatus("none");
        }
      }
    }

    void loadConnections();

    return () => {
      alive = false;
    };
  }, [profileUserId, user?.id, isOwnProfile]);

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Profile image is too large. Please choose an image under 5MB.");
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (error: any) {
      console.error("Avatar upload failed:", error);
      alert(error?.message || "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleConnect = async () => {
    if (!user?.id || !profileUserId || user.id === profileUserId) return;

    try {
      if (followStatus === "follow_back") {
        const { error } = await supabase
          .from("user_connections")
          .update({ status: "accepted" })
          .eq("requester_id", profileUserId)
          .eq("receiver_id", user.id)
          .eq("status", "pending");

        if (error) throw error;

        setFollowStatus("accepted");
        setConnectionsCount((prev) => prev + 1);
        setFollowersCount((prev) => prev + 1);
        return;
      }

      const { error } = await supabase.from("user_connections").insert({
        requester_id: user.id,
        receiver_id: profileUserId,
        status: "pending",
      });

      if (error) throw error;

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: profileUserId,
          actor_id: user.id,
          type: "follow_request",
          title: `${fullName || "Someone"} sent you a follow request`,
          body: "Tap to view pending requests.",
        });

      if (notificationError) {
        console.error("Notification insert failed:", notificationError);
      }

      setFollowStatus("pending");
      alert("Follow request sent");
    } catch (error: any) {
      console.error("Connection failed:", error);
      alert(error?.message || "Failed to follow user.");
    }
  };

  const handleUnfollow = async () => {
    if (!user?.id || !profileUserId || user.id === profileUserId) return;

    const ok = window.confirm("Unfollow this user?");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("user_connections")
        .delete()
        .or(
          `and(requester_id.eq.${user.id},receiver_id.eq.${profileUserId}),and(requester_id.eq.${profileUserId},receiver_id.eq.${user.id})`
        );

      if (error) throw error;

      setFollowStatus("none");
      setConnectionsCount((prev) => Math.max(0, prev - 1));
      setFollowingCount((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error("Unfollow failed:", error);
      alert(error?.message || "Failed to unfollow.");
    }
  };

  const handleCancelRequest = async () => {
    if (!user?.id || !profileUserId) return;

    const ok = window.confirm("Cancel follow request?");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("user_connections")
        .delete()
        .eq("requester_id", user.id)
        .eq("receiver_id", profileUserId)
        .eq("status", "pending");

      if (error) throw error;

      setFollowStatus("none");
    } catch (error: any) {
      console.error("Cancel request failed:", error);
      alert(error?.message || "Failed to cancel request.");
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      alert("You must be signed in.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          user_id: user.id,
          full_name: fullName.trim() || null,
          location: location.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      setEditing(false);
      alert("Profile updated successfully.");
    } catch (error: any) {
      console.error("[Profile] Save failed:", error);
      alert(error?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

return (
  <div className="min-h-screen bg-background px-4 pb-24 pt-4">
    <div className="mx-auto w-full max-w-2xl">
      {/* Top navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("callsPage.back")}
        >
          <ArrowLeft className="h-5 w-5" />
          <span>{t("callsPage.back")}</span>
        </button>

        {isOwnProfile && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-lg shadow-sm hover:bg-muted"
              aria-label="Open notifications"
            >
              🔔
            </button>

            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-lg shadow-sm hover:bg-muted"
              aria-label="Open settings"
            >
              ⚙️
            </button>
          </div>
        )}
      </div>

      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          {isOwnProfile
            ? t("profilePage.title")
            : fullName || t("profilePage.userProfile")}
        </h1>

        {isOwnProfile && (
          <p className="mt-1 text-sm text-muted-foreground">
            {user.email ?? user.id}
          </p>
        )}
      </div>

      {/* Main profile card */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || t("profilePage.title")}
                className="h-24 w-24 rounded-full border-4 border-background object-cover shadow"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-background bg-primary text-3xl font-bold text-primary-foreground shadow">
                {(fullName || "U").charAt(0).toUpperCase()}
              </div>
            )}

            {isOwnProfile && (
              <>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (!file) return;

                    void handleAvatarUpload(file);
                    e.currentTarget.value = "";
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("avatar-upload")?.click()
                  }
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 rounded-full border bg-background px-2.5 py-1 text-xs font-medium shadow-sm disabled:opacity-60"
                >
                  {uploadingAvatar ? "..." : "Edit"}
                </button>
              </>
            )}
          </div>

          <div className="mt-4 min-w-0">
            <div className="text-xl font-bold">
              {fullName || "Unnamed User"}
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              {location || "Location not set"}
            </div>

            {bio && (
              <div className="mx-auto mt-3 max-w-md whitespace-pre-wrap text-sm leading-6">
                {bio}
              </div>
            )}
          </div>

      {isOwnProfile && !editing && (
        <div className="mt-5 w-full">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            {t("profilePage.editProfile")}
          </button>
        </div>
      )}

          {!isOwnProfile && (
            <div className="mt-5 flex w-full flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (followStatus === "accepted") {
                    void handleUnfollow();
                  } else if (followStatus === "pending") {
                    void handleCancelRequest();
                  } else {
                    void handleConnect();
                  }
                }}
                className="min-w-32 rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700"
              >
                {followStatus === "accepted"
                  ? t("profilePage.following")
                  : followStatus === "pending"
                  ? "Requested"
                  : followStatus === "follow_back"
                  ? "Follow back"
                  : "Follow"}
              </button>

              {followStatus === "accepted" && (
                <button
                  type="button"
                  onClick={() => navigate(`/messages/${profileUserId}`)}
                  className="min-w-32 rounded-xl border px-5 py-3 text-sm font-medium hover:bg-muted"
                >
                  Message
                </button>
              )}
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <div className="text-xl font-bold">{connectionsCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("profilePage.connections")}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/profile/${profileUserId}/followers`)}
            className="rounded-xl bg-muted/50 p-4 text-center hover:bg-muted"
          >
            <div className="text-xl font-bold">{followersCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("profilePage.followers")}
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/profile/${profileUserId}/following`)}
            className="rounded-xl bg-muted/50 p-4 text-center hover:bg-muted"
          >
            <div className="text-xl font-bold">{followingCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("profilePage.following")}
            </div>
          </button>

          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <div className="text-xl font-bold">
              {isOwnProfile ? "—" : mutualCount}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Mutual</div>
          </div>
        </div>

        {isOwnProfile && (
          <button
            type="button"
            onClick={() => navigate("/requests")}
            className="mt-4 w-full rounded-xl border px-4 py-3 font-medium hover:bg-muted"
          >
            {t("profilePage.pendingRequests")}
          </button>
        )}

        {/* Edit form */}
        {isOwnProfile && editing && (
          <div className="mt-6 space-y-4 border-t pt-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Full name
              </label>
              <input
                className="w-full rounded-xl border bg-background px-3 py-3 disabled:opacity-70"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Name"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Location
              </label>
              <input
                className="w-full rounded-xl border bg-background px-3 py-3 disabled:opacity-70"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                About
              </label>
              <textarea
                className="min-h-28 w-full resize-none rounded-xl border bg-background px-3 py-3 disabled:opacity-70"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something about yourself"
                disabled={loading}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="w-full rounded-xl border px-4 py-3 font-medium hover:bg-muted"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={loading || saving}
                className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
}