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
    <div className="p-4 pb-24">
<button
  type="button"
  onClick={() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }}
  className="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
  aria-label={t("callsPage.back")}
>
  <ArrowLeft className="h-5 w-5" />
  <span>{t("callsPage.back")}</span>
</button>

<div className="mb-4 flex items-center justify-between">
  <h1 className="text-xl font-semibold truncate">
    {isOwnProfile
      ? t("profilePage.title")
      : fullName || t("profilePage.userProfile")}
  </h1>

  {isOwnProfile && (
    <button
      type="button"
      onClick={() => navigate("/settings")}
      className="rounded-full border px-3 py-2 text-sm hover:bg-muted"
      aria-label="Open settings"
    >
      ⚙️
    </button>
  )}
</div>

      <div className="mt-4 rounded-xl border p-4">
        <div className="text-sm text-muted-foreground">
          {isOwnProfile
            ? t("profilePage.signedInAs")
            : t("profilePage.viewingProfile")}
        </div>
        <div className="font-medium">
          {isOwnProfile ? user.email ?? user.id : fullName || profileUserId}
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-4 space-y-4">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || t("profilePage.title")}
                className="h-16 w-16 rounded-full object-cover border"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
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
                  className="absolute -bottom-1 -right-1 rounded-full border bg-background px-2 py-1 text-[10px] shadow"
                >
                  {uploadingAvatar ? "..." : "Edit"}
                </button>
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-semibold text-lg truncate">
              {fullName || "Unnamed User"}
            </div>

            <div className="text-sm text-muted-foreground truncate">
              {location || "Location not set"}
            </div>

            {bio && <div className="mt-2 text-sm break-words">{bio}</div>}

{isOwnProfile && !editing && (
  <>
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full rounded-xl border py-2 mt-3"
    >
      {t("profilePage.editProfile")}
    </button>

    <button
      type="button"
      onClick={() => navigate("/call-history")}
      className="w-full rounded-xl border py-2 mt-3"
    >
      {t("profilePage.callHistory", {
        defaultValue: "Call History",
      })}
    </button>
  </>
)}
            {!isOwnProfile && (
              <div className="mt-3 flex flex-wrap gap-2">
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
                  className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700"
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
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                  >
                    Message
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border p-3 text-center">
            <div className="text-lg font-semibold">{connectionsCount}</div>
            <div className="text-xs text-muted-foreground">
              {t("profilePage.connections")}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/profile/${profileUserId}/followers`)}
            className="rounded-xl border p-3 text-center hover:bg-muted/50"
          >
            <div className="text-lg font-semibold">{followersCount}</div>
            <div className="text-xs text-muted-foreground">
              {t("profilePage.followers")}
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/profile/${profileUserId}/following`)}
            className="rounded-xl border p-3 text-center hover:bg-muted/50"
          >
            <div className="text-lg font-semibold">{followingCount}</div>
            <div className="text-xs text-muted-foreground">
              {t("profilePage.following")}
            </div>
          </button>

          <div className="rounded-xl border p-3 text-center">
            <div className="text-lg font-semibold">
              {isOwnProfile ? "—" : mutualCount}
            </div>
            <div className="text-xs text-muted-foreground">Mutual</div>
          </div>
        </div>

        {isOwnProfile && (
          <button
            type="button"
            onClick={() => navigate("/requests")}
            className="w-full rounded-xl border px-4 py-3 text-sm hover:bg-muted"
          >
            {t("profilePage.pendingRequests")}
          </button>
        )}

        {isOwnProfile && editing && (
          <>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Full name</div>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 disabled:opacity-70"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Name"
                disabled={loading}
              />
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Location</div>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 disabled:opacity-70"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                disabled={loading}
              />
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">About</div>
              <textarea
                className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 disabled:opacity-70"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something about yourself"
                disabled={loading}
              />
            </div>

            <button
              className="w-full rounded-xl bg-primary text-primary-foreground py-2 disabled:opacity-60"
              onClick={() => void handleSave()}
              type="button"
              disabled={loading || saving}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}