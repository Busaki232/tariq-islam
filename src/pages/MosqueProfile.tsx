import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Phone, Globe2, BadgeCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import nigerianIslamicAssociationImage from "@/assets/nigerian-islamic-association-chicago.png";

import brooklynIslamicCenterImage from "@/assets/brooklyn-islamic-center.png";
import ciogcChicagoImage from "@/assets/ciogc-chicago.jpeg";
import islamicSocietySouthTexasImage from "@/assets/islamic-society-south-texas.png";
import muslimCenterDetroitImage from "@/assets/muslim-center-detroit-exterior.png";
import islamicCenterMinnesotaImage from "@/assets/islamic-center-minnesota.png";
import masjidAlHikmahClevelandImage from "@/assets/masjid-al-hikmah-cleveland.png";
import islamicSocietyGreaterMilwaukeeImage from "@/assets/islamic-society-greater-milwaukee.png";
import islamicSocietyMidwestImage from "@/assets/islamic-society-midwest.png";
import muslimCommunityCenterChicagoImage from "@/assets/muslim-community-center-chicago.png";
import islamicCenterChicagoImage from "@/assets/islamic-center-chicago.png";

type MosqueProfileData = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  image_url: string | null;
  description: string | null;
  verified: boolean | null;
  claimed_by: string | null;
  prayer_times: {
    fajr?: string;
    dhuhr?: string;
    asr?: string;
    maghrib?: string;
    isha?: string;
    jummah?: string;
  } | null;
};
type MosqueAnnouncement = {
  id: string;
  title: string;
  message: string;
  is_pinned: boolean;
  published_at: string;
};
type MosqueEvent = {
  id: string;
  title: string | null;
  description: string | null;
  event_date: string;
  event_time: string;
  location: string | null;
  category: string | null;
  status: string | null;
};
type MosqueLivestream = {
  id: string;
  mosque_id: string;
  created_by: string;
  title: string;
  description: string | null;
  stream_url: string;
  scheduled_for: string | null;
  status: "upcoming" | "live" | "ended";
  created_at: string;
  updated_at: string;
};
type MosqueVolunteerOpportunity = {
  id: string;
  mosque_id: string;
  created_by: string;
  title: string;
  description: string | null;
  volunteer_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  volunteers_needed: number | null;
  status: "open" | "full" | "completed" | "cancelled";
  created_at: string;
  signup_count?: number;
  current_user_signup_id?: string | null;
  current_user_signup_status?: string | null;
};

type MosqueVolunteerSignup = {
  id: string;
  opportunity_id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: "signed_up" | "cancelled" | "attended";
  created_at: string;
};
const MosqueProfile = () => {
  const navigate = useNavigate();
  const { mosqueId } = useParams();
  const { user } = useAuth();

  const [mosque, setMosque] = useState<MosqueProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [announcements, setAnnouncements] =
    useState<MosqueAnnouncement[]>([]);
const [canManageAnnouncements, setCanManageAnnouncements] =
  useState(false);

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [editingMosqueProfile, setEditingMosqueProfile] = useState(false);
  const [savingMosqueProfile, setSavingMosqueProfile] = useState(false);

  const [mosqueEvents, setMosqueEvents] = useState<MosqueEvent[]>([]);

  const [mosqueLivestreams, setMosqueLivestreams] =
    useState<MosqueLivestream[]>([]);

    const [livestreamFormOpen, setLivestreamFormOpen] = useState(false);
    const [savingLivestream, setSavingLivestream] = useState(false);

    const [livestreamTitle, setLivestreamTitle] = useState("");
    const [livestreamDescription, setLivestreamDescription] = useState("");
    const [livestreamUrl, setLivestreamUrl] = useState("");
    const [livestreamDate, setLivestreamDate] = useState("");
    const [livestreamTime, setLivestreamTime] = useState("");
    const [livestreamStatus, setLivestreamStatus] =
      useState<"upcoming" | "live" | "ended">("upcoming");



      const [editingLivestreamId, setEditingLivestreamId] =
        useState<string | null>(null);

      const [editingLivestreamTitle, setEditingLivestreamTitle] =
        useState("");

      const [
        editingLivestreamDescription,
        setEditingLivestreamDescription,
      ] = useState("");

      const [editingLivestreamUrl, setEditingLivestreamUrl] =
        useState("");

      const [editingLivestreamDate, setEditingLivestreamDate] =
        useState("");

      const [editingLivestreamTime, setEditingLivestreamTime] =
        useState("");

      const [
        editingLivestreamStatus,
        setEditingLivestreamStatus,
      ] = useState<"upcoming" | "live" | "ended">("upcoming");

      const [
        updatingLivestream,
        setUpdatingLivestream,
      ] = useState(false);

  const [volunteerOpportunities, setVolunteerOpportunities] =
    useState<MosqueVolunteerOpportunity[]>([]);

  const [volunteerFormOpen, setVolunteerFormOpen] = useState(false);
  const [savingVolunteerOpportunity, setSavingVolunteerOpportunity] =
    useState(false);

  const [volunteerTitle, setVolunteerTitle] = useState("");
  const [volunteerDescription, setVolunteerDescription] = useState("");
  const [volunteerDate, setVolunteerDate] = useState("");
  const [volunteerStartTime, setVolunteerStartTime] = useState("");
  const [volunteerEndTime, setVolunteerEndTime] = useState("");
  const [volunteerLocation, setVolunteerLocation] = useState("");
  const [volunteersNeeded, setVolunteersNeeded] = useState("");

  const [volunteerSignupOpportunityId, setVolunteerSignupOpportunityId] =
    useState<string | null>(null);

  const [volunteerFullName, setVolunteerFullName] = useState("");
  const [volunteerPhone, setVolunteerPhone] = useState("");
  const [volunteerEmail, setVolunteerEmail] = useState("");
  const [volunteerNotes, setVolunteerNotes] = useState("");
  const [submittingVolunteerSignup, setSubmittingVolunteerSignup] =
    useState(false);

  const [viewingVolunteerSignupsId, setViewingVolunteerSignupsId] =
    useState<string | null>(null);
  const [volunteerSignups, setVolunteerSignups] =
    useState<MosqueVolunteerSignup[]>([]);
  const [loadingVolunteerSignups, setLoadingVolunteerSignups] =
    useState(false);

  const [editMosqueName, setEditMosqueName] = useState("");
  const [editMosqueAddress, setEditMosqueAddress] = useState("");
  const [editMosqueCity, setEditMosqueCity] = useState("");
  const [editMosqueState, setEditMosqueState] = useState("");
  const [editMosquePhone, setEditMosquePhone] = useState("");
  const [editMosqueWebsite, setEditMosqueWebsite] = useState("");
  const [editMosqueDescription, setEditMosqueDescription] = useState("");

  const [editingPrayerTimes, setEditingPrayerTimes] = useState(false);
  const [savingPrayerTimes, setSavingPrayerTimes] = useState(false);

  const [editFajr, setEditFajr] = useState("");
  const [editDhuhr, setEditDhuhr] = useState("");
  const [editAsr, setEditAsr] = useState("");
  const [editMaghrib, setEditMaghrib] = useState("");
  const [editIsha, setEditIsha] = useState("");
  const [editJummah, setEditJummah] = useState("");

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [savingMosqueEvent, setSavingMosqueEvent] = useState(false);

  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventCategory, setEventCategory] = useState("religious");


  const [editingMosqueEventId, setEditingMosqueEventId] =
    useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState("");
  const [editingEventDescription, setEditingEventDescription] = useState("");
  const [editingEventDate, setEditingEventDate] = useState("");
  const [editingEventTime, setEditingEventTime] = useState("");
  const [editingEventLocation, setEditingEventLocation] = useState("");
  const [editingEventCategory, setEditingEventCategory] =
   useState("religious");
  const [updatingMosqueEvent, setUpdatingMosqueEvent] = useState(false);
  const [isFollowingMosque, setIsFollowingMosque] = useState(false);
  const [mosqueFollowerCount, setMosqueFollowerCount] = useState(0);
  const [mosqueFollowLoading, setMosqueFollowLoading] = useState(false);
  const [mosqueNotificationsEnabled, setMosqueNotificationsEnabled] =
    useState(true);
  const [claimFormOpen, setClaimFormOpen] = useState(false);
  const [claimFullName, setClaimFullName] = useState("");
  const [claimRole, setClaimRole] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [claimProofDetails, setClaimProofDetails] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [existingClaimStatus, setExistingClaimStatus] =
    useState<string | null>(null);

  const [editingAnnouncementId, setEditingAnnouncementId] =
    useState<string | null>(null);
  const [editingAnnouncementTitle, setEditingAnnouncementTitle] =
    useState("");
  const [editingAnnouncementMessage, setEditingAnnouncementMessage] =
    useState("");
  const [updatingAnnouncement, setUpdatingAnnouncement] =
    useState(false);

  useEffect(() => {
    const loadMosque = async () => {
      if (!mosqueId) {
        setErrorMessage("Mosque ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("mosques")
    .select(
      "id,name,address,city,state,phone,website,image_url,description,verified,prayer_times,claimed_by"
    )

          .eq("id", mosqueId)
          .single();

        if (error) {
          throw error;
        }

const { data: announcementData, error: announcementError } =
  await supabase
    .from("mosque_announcements")
    .select("id,title,message,is_pinned,published_at")
    .eq("mosque_id", mosqueId)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

if (announcementError) {
  throw announcementError;
}

setAnnouncements(announcementData ?? []);
const { data: eventData, error: eventError } = await supabase
  .from("events")
  .select(
    "id,title,description,event_date,event_time,location,category,status"
  )
  .eq("mosque_id", mosqueId)
  .in("status", ["upcoming", "ongoing"])
  .order("event_date", { ascending: true })
  .order("event_time", { ascending: true });

if (eventError) {
  throw eventError;
}

setMosqueEvents(eventData ?? []);
const { data: livestreamData, error: livestreamError } = await supabase
  .from("mosque_livestreams")
  .select(
    "id,mosque_id,created_by,title,description,stream_url,scheduled_for,status,created_at,updated_at"
  )
  .eq("mosque_id", mosqueId)
  .in("status", ["upcoming", "live"])
  .order("scheduled_for", {
    ascending: true,
    nullsFirst: false,
  })
  .order("created_at", { ascending: false });

if (livestreamError) {
  throw livestreamError;
}

setMosqueLivestreams(
  (livestreamData ?? []) as MosqueLivestream[]
);
const { data: volunteerData, error: volunteerError } = await supabase
  .from("mosque_volunteer_opportunities")
  .select(
    "id,mosque_id,created_by,title,description,volunteer_date,start_time,end_time,location,volunteers_needed,status,created_at"
  )
  .eq("mosque_id", mosqueId)
  .in("status", ["open", "full"])
  .order("volunteer_date", { ascending: true })
  .order("start_time", { ascending: true });

if (volunteerError) {
  throw volunteerError;
}

const volunteerIds = (volunteerData ?? []).map(
  (opportunity) => opportunity.id
);

let signupCounts: Record<string, number> = {};
let currentUserSignups: Record<
  string,
  {
    id: string;
    status: string;
  }
> = {};

if (volunteerIds.length > 0) {
  const { data: signupData, error: signupError } = await supabase
    .from("mosque_volunteer_signups")
    .select("id,opportunity_id,user_id,status")
    .in("opportunity_id", volunteerIds)
    .neq("status", "cancelled");

  if (signupError) {
    throw signupError;
  }

  for (const signup of signupData ?? []) {
    signupCounts[signup.opportunity_id] =
      (signupCounts[signup.opportunity_id] ?? 0) + 1;

    if (user?.id && signup.user_id === user.id) {
      currentUserSignups[signup.opportunity_id] = {
        id: signup.id,
        status: signup.status,
      };
    }
  }
}

setVolunteerOpportunities(
  (volunteerData ?? []).map((opportunity) => ({
    ...opportunity,
    signup_count: signupCounts[opportunity.id] ?? 0,
    current_user_signup_id:
      currentUserSignups[opportunity.id]?.id ?? null,
    current_user_signup_status:
      currentUserSignups[opportunity.id]?.status ?? null,
  }))
);

const { count: followerCount, error: followerCountError } =
  await supabase
    .from("mosque_followers")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("mosque_id", mosqueId);

if (followerCountError) {
  throw followerCountError;
}

setMosqueFollowerCount(followerCount ?? 0);

if (user?.id) {
  const { data: followData, error: followError } =
    await supabase
      .from("mosque_followers")
      .select("id,notifications_enabled")
      .eq("mosque_id", mosqueId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (followError) {
    throw followError;
  }

  setIsFollowingMosque(Boolean(followData));
  setMosqueNotificationsEnabled(
    followData?.notifications_enabled ?? true
  );
} else {
  setIsFollowingMosque(false);
  setMosqueNotificationsEnabled(true);
}
        setMosque(data);
        if (user?.id) {
          const { data: claimData, error: claimError } = await supabase
            .from("mosque_claim_requests")
            .select("status")
            .eq("mosque_id", mosqueId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (claimError) {
            throw claimError;
          }

          setExistingClaimStatus(claimData?.status ?? null);

          if (!claimEmail && user.email) {
            setClaimEmail(user.email);
          }
        } else {
          setExistingClaimStatus(null);
        }
let canManage = data.claimed_by === user?.id;

if (user?.id && !canManage) {
  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "moderator"]);

  if (roleError) {
    throw roleError;
  }

  canManage = Boolean(roleData?.length);
}

setCanManageAnnouncements(canManage);
      } catch (error) {
        console.error("Could not load mosque profile:", error);
        setErrorMessage("Could not load this mosque profile.");
      } finally {
        setLoading(false);
      }
    };

    void loadMosque();
}, [mosqueId, user?.id]);

const handleCreateAnnouncement = async () => {
  if (!user?.id || !mosqueId || !canManageAnnouncements) {
    return;
  }

  const title = announcementTitle.trim();
  const message = announcementMessage.trim();

  if (!title || !message) {
    return;
  }

  setSavingAnnouncement(true);


  try {
    const { data, error } = await supabase
      .from("mosque_announcements")
      .insert({
        mosque_id: mosqueId,
        created_by: user.id,
        title,
        message,
        is_pinned: announcementPinned,
      })
      .select("id,title,message,is_pinned,published_at")
      .single();

    if (error) {
      throw error;
    }

    setAnnouncements((current) => {
      const next = [data, ...current];

      return next.sort((first, second) => {
        if (first.is_pinned !== second.is_pinned) {
          return first.is_pinned ? -1 : 1;
        }

        return (
          new Date(second.published_at).getTime() -
          new Date(first.published_at).getTime()
        );
      });
    });

    setAnnouncementTitle("");
    setAnnouncementMessage("");
    setAnnouncementPinned(false);
  } catch (error) {
    console.error("Could not create mosque announcement:", error);
  } finally {
    setSavingAnnouncement(false);
  }
};

const handleStartEditingAnnouncement = (
  announcement: MosqueAnnouncement
) => {
  setEditingAnnouncementId(announcement.id);
  setEditingAnnouncementTitle(announcement.title);
  setEditingAnnouncementMessage(announcement.message);
};

const handleUpdateAnnouncement = async () => {
  if (
    !editingAnnouncementId ||
    !canManageAnnouncements
  ) {
    return;
  }

  const title = editingAnnouncementTitle.trim();
  const message = editingAnnouncementMessage.trim();

  if (!title || !message) {
    return;
  }

  setUpdatingAnnouncement(true);

  try {
    const { data, error } = await supabase
      .from("mosque_announcements")
      .update({
        title,
        message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingAnnouncementId)
      .select("id,title,message,is_pinned,published_at")
      .single();

    if (error) {
      throw error;
    }

    setAnnouncements((current) =>
      current.map((announcement) =>
        announcement.id === data.id ? data : announcement
      )
    );

    setEditingAnnouncementId(null);
    setEditingAnnouncementTitle("");
    setEditingAnnouncementMessage("");
  } catch (error) {
    console.error("Could not update mosque announcement:", error);
  } finally {
    setUpdatingAnnouncement(false);
  }
};

const handleTogglePinnedAnnouncement = async (
  announcement: MosqueAnnouncement
) => {
  if (!canManageAnnouncements) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from("mosque_announcements")
      .update({
        is_pinned: !announcement.is_pinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", announcement.id)
      .select("id,title,message,is_pinned,published_at")
      .single();

    if (error) {
      throw error;
    }

    setAnnouncements((current) => {
      const next = current.map((item) =>
        item.id === data.id ? data : item
      );

      return next.sort((first, second) => {
        if (first.is_pinned !== second.is_pinned) {
          return first.is_pinned ? -1 : 1;
        }

        return (
          new Date(second.published_at).getTime() -
          new Date(first.published_at).getTime()
        );
      });
    });
  } catch (error) {
    console.error("Could not update announcement pin:", error);
  }
};

const handleDeleteAnnouncement = async (
  announcementId: string
) => {
  if (!canManageAnnouncements) {
    return;
  }

  const confirmed = window.confirm(
    "Delete this mosque announcement?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const { error } = await supabase
      .from("mosque_announcements")
      .delete()
      .eq("id", announcementId);

    if (error) {
      throw error;
    }

    setAnnouncements((current) =>
      current.filter(
        (announcement) => announcement.id !== announcementId
      )
    );
  } catch (error) {
    console.error("Could not delete mosque announcement:", error);
  }
};

const handleSubmitMosqueClaim = async () => {
  if (!user?.id || !mosqueId || mosque?.claimed_by) {
    return;
  }

  const fullName = claimFullName.trim();
  const roleAtMosque = claimRole.trim();
  const email = claimEmail.trim();
  const phone = claimPhone.trim();
  const proofDetails = claimProofDetails.trim();

  if (!fullName || !roleAtMosque || !email || !proofDetails) {
    return;
  }

  setSubmittingClaim(true);

  try {
    const { data, error } = await supabase
      .from("mosque_claim_requests")
      .insert({
        mosque_id: mosqueId,
        user_id: user.id,
        full_name: fullName,
        role_at_mosque: roleAtMosque,
        phone: phone || null,
        email,
        proof_details: proofDetails,
        status: "pending",
      })
      .select("status")
      .single();

    if (error) {
      throw error;
    }

    setExistingClaimStatus(data.status);
    setClaimFormOpen(false);
    setClaimFullName("");
    setClaimRole("");
    setClaimPhone("");
    setClaimProofDetails("");
  } catch (error) {
    console.error("Could not submit mosque claim:", error);
  } finally {
    setSubmittingClaim(false);
  }
};
const handleStartEditingMosqueProfile = () => {
  if (!mosque || !canManageAnnouncements) {
    return;
  }

  setEditMosqueName(mosque.name || "");
  setEditMosqueAddress(mosque.address || "");
  setEditMosqueCity(mosque.city || "");
  setEditMosqueState(mosque.state || "");
  setEditMosquePhone(mosque.phone || "");
  setEditMosqueWebsite(mosque.website || "");
  setEditMosqueDescription(mosque.description || "");
  setEditingMosqueProfile(true);
};
const handleSaveMosqueProfile = async () => {
  if (!mosque || !mosqueId || !canManageAnnouncements) {
    return;
  }

  const name = editMosqueName.trim();
  const address = editMosqueAddress.trim();
  const city = editMosqueCity.trim();
  const state = editMosqueState.trim();
  const phone = editMosquePhone.trim();
  const website = editMosqueWebsite.trim();
  const description = editMosqueDescription.trim();

  if (!name) {
    return;
  }

  setSavingMosqueProfile(true);

  try {
    const { data, error } = await supabase
      .from("mosques")
      .update({
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        phone: phone || null,
        website: website || null,
        description: description || null,
      })
      .eq("id", mosqueId)
      .select(
        "id,name,address,city,state,phone,website,image_url,description,verified,prayer_times,claimed_by"
      )
      .single();

    if (error) {
      throw error;
    }

    setMosque(data);
    setEditingMosqueProfile(false);
  } catch (error) {
    console.error("Could not update mosque profile:", error);
  } finally {
    setSavingMosqueProfile(false);
  }
};
const handleStartEditingPrayerTimes = () => {
  if (!mosque || !canManageAnnouncements) {
    return;
  }

  setEditFajr(mosque.prayer_times?.fajr || "");
  setEditDhuhr(mosque.prayer_times?.dhuhr || "");
  setEditAsr(mosque.prayer_times?.asr || "");
  setEditMaghrib(mosque.prayer_times?.maghrib || "");
  setEditIsha(mosque.prayer_times?.isha || "");
  setEditJummah(mosque.prayer_times?.jummah || "");
  setEditingPrayerTimes(true);
};
const handleSavePrayerTimes = async () => {
  if (!mosque || !mosqueId || !canManageAnnouncements) {
    return;
  }

  setSavingPrayerTimes(true);

  try {
    const prayerTimes = {
      fajr: editFajr.trim() || null,
      dhuhr: editDhuhr.trim() || null,
      asr: editAsr.trim() || null,
      maghrib: editMaghrib.trim() || null,
      isha: editIsha.trim() || null,
      jummah: editJummah.trim() || null,
    };

    const { data, error } = await supabase
      .from("mosques")
      .update({
        prayer_times: prayerTimes,
      })
      .eq("id", mosqueId)
      .select(
        "id,name,address,city,state,phone,website,image_url,description,verified,prayer_times,claimed_by"
      )
      .single();

    if (error) {
      throw error;
    }

    setMosque(data);
    setEditingPrayerTimes(false);
  } catch (error) {
    console.error("Could not update mosque prayer times:", error);
  } finally {
    setSavingPrayerTimes(false);
  }
};
const handleCreateMosqueEvent = async () => {
  if (!user?.id || !mosqueId || !canManageAnnouncements) {
    return;
  }

  const title = eventTitle.trim();
  const description = eventDescription.trim();
  const location = eventLocation.trim();

  if (!title || !eventDate || !eventTime || !location) {
    return;
  }

  const eventDateTime = new Date(`${eventDate}T${eventTime}`);

  if (eventDateTime <= new Date()) {
    return;
  }

  setSavingMosqueEvent(true);

  try {
    const { data, error } = await supabase
      .from("events")
      .insert({
        title,
        description: description || null,
        event_date: eventDate,
        event_time: eventTime,
        location,
        category: eventCategory,
        organizer_id: user.id,
        creator_id: user.id,
        start_at: `${eventDate}T${eventTime}:00`,
        status: "upcoming",
        mosque_id: mosqueId,
      })
      .select(
        "id,title,description,event_date,event_time,location,category,status"
      )
      .single();

    if (error) {
      throw error;
    }

    setMosqueEvents((current) =>
      [...current, data].sort((first, second) => {
        const firstTime = new Date(
          `${first.event_date}T${first.event_time}`
        ).getTime();

        const secondTime = new Date(
          `${second.event_date}T${second.event_time}`
        ).getTime();

        return firstTime - secondTime;
      })
    );

    setEventTitle("");
    setEventDescription("");
    setEventDate("");
    setEventTime("");
    setEventLocation("");
    setEventCategory("religious");
    setEventFormOpen(false);
  } catch (error) {
    console.error("Could not create mosque event:", error);
  } finally {
    setSavingMosqueEvent(false);
  }
};
const handleCreateLivestream = async () => {
  if (!user?.id || !mosqueId || !canManageAnnouncements) {
    return;
  }

  const title = livestreamTitle.trim();
  const description = livestreamDescription.trim();
  const streamUrl = livestreamUrl.trim();

  if (!title || !streamUrl) {
    return;
  }

  let scheduledFor: string | null = null;

  if (livestreamDate && livestreamTime) {
    const scheduledDate = new Date(
      `${livestreamDate}T${livestreamTime}`
    );

    if (Number.isNaN(scheduledDate.getTime())) {
      return;
    }

    scheduledFor = scheduledDate.toISOString();
  }

  if (livestreamStatus === "upcoming" && !scheduledFor) {
    return;
  }

  setSavingLivestream(true);

  try {
    const { data, error } = await supabase
      .from("mosque_livestreams")
      .insert({
        mosque_id: mosqueId,
        created_by: user.id,
        title,
        description: description || null,
        stream_url: streamUrl,
        scheduled_for: scheduledFor,
        status: livestreamStatus,
      })
      .select(
        "id,mosque_id,created_by,title,description,stream_url,scheduled_for,status,created_at,updated_at"
      )
      .single();

    if (error) {
      throw error;
    }

    setMosqueLivestreams((current) => {
      const next = [
        data as MosqueLivestream,
        ...current,
      ];

      return next.sort((first, second) => {
        if (first.status === "live" && second.status !== "live") {
          return -1;
        }

        if (first.status !== "live" && second.status === "live") {
          return 1;
        }

        const firstTime = first.scheduled_for
          ? new Date(first.scheduled_for).getTime()
          : Number.MAX_SAFE_INTEGER;

        const secondTime = second.scheduled_for
          ? new Date(second.scheduled_for).getTime()
          : Number.MAX_SAFE_INTEGER;

        return firstTime - secondTime;
      });
    });

    setLivestreamTitle("");
    setLivestreamDescription("");
    setLivestreamUrl("");
    setLivestreamDate("");
    setLivestreamTime("");
    setLivestreamStatus("upcoming");
    setLivestreamFormOpen(false);
  } catch (error) {
    console.error("Could not create mosque livestream:", error);
  } finally {
    setSavingLivestream(false);
  }
};
const handleUpdateLivestreamStatus = async (
  livestreamId: string,
  status: "upcoming" | "live" | "ended"
) => {
  try {
    const { error } = await supabase
      .from("mosque_livestreams")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", livestreamId);

    if (error) throw error;

    setMosqueLivestreams((current) =>
      current.map((stream) =>
        stream.id === livestreamId
          ? { ...stream, status }
          : stream
      )
    );
  } catch (error) {
    console.error("Could not update livestream:", error);
  }
};
const handleDeleteLivestream = async (
  livestreamId: string
) => {
  if (
    !window.confirm(
      "Delete this livestream?"
    )
  ) {
    return;
  }

  try {
    const { error } = await supabase
      .from("mosque_livestreams")
      .delete()
      .eq("id", livestreamId);

    if (error) throw error;

    setMosqueLivestreams((current) =>
      current.filter(
        (stream) => stream.id !== livestreamId
      )
    );
  } catch (error) {
    console.error(
      "Could not delete livestream:",
      error
    );
  }
};
const handleStartEditingLivestream = (
  livestream: MosqueLivestream
) => {
  setEditingLivestreamId(livestream.id);
  setEditingLivestreamTitle(livestream.title || "");
  setEditingLivestreamDescription(
    livestream.description || ""
  );
  setEditingLivestreamUrl(livestream.stream_url || "");
  setEditingLivestreamStatus(livestream.status);

  if (livestream.scheduled_for) {
    const scheduledDate = new Date(
      livestream.scheduled_for
    );

    setEditingLivestreamDate(
      scheduledDate.toISOString().split("T")[0]
    );

    setEditingLivestreamTime(
      scheduledDate.toTimeString().slice(0, 5)
    );
  } else {
    setEditingLivestreamDate("");
    setEditingLivestreamTime("");
  }
};
const handleUpdateLivestream = async () => {
  if (
    !editingLivestreamId ||
    !mosqueId ||
    !canManageAnnouncements
  ) {
    return;
  }

  const title = editingLivestreamTitle.trim();
  const description =
    editingLivestreamDescription.trim();
  const streamUrl = editingLivestreamUrl.trim();

  if (!title || !streamUrl) {
    return;
  }

  let scheduledFor: string | null = null;

  if (
    editingLivestreamDate &&
    editingLivestreamTime
  ) {
    const scheduledDate = new Date(
      `${editingLivestreamDate}T${editingLivestreamTime}`
    );

    if (Number.isNaN(scheduledDate.getTime())) {
      return;
    }

    scheduledFor = scheduledDate.toISOString();
  }

  if (
    editingLivestreamStatus === "upcoming" &&
    !scheduledFor
  ) {
    return;
  }

  setUpdatingLivestream(true);

  try {
    const { data, error } = await supabase
      .from("mosque_livestreams")
      .update({
        title,
        description: description || null,
        stream_url: streamUrl,
        scheduled_for: scheduledFor,
        status: editingLivestreamStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingLivestreamId)
      .eq("mosque_id", mosqueId)
      .select(
        "id,mosque_id,created_by,title,description,stream_url,scheduled_for,status,created_at,updated_at"
      )
      .single();

    if (error) {
      throw error;
    }

    setMosqueLivestreams((current) =>
      current
        .map((livestream) =>
          livestream.id === data.id
            ? (data as MosqueLivestream)
            : livestream
        )
        .sort((first, second) => {
          if (
            first.status === "live" &&
            second.status !== "live"
          ) {
            return -1;
          }

          if (
            first.status !== "live" &&
            second.status === "live"
          ) {
            return 1;
          }

          const firstTime = first.scheduled_for
            ? new Date(
                first.scheduled_for
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

          const secondTime = second.scheduled_for
            ? new Date(
                second.scheduled_for
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

          return firstTime - secondTime;
        })
    );

    setEditingLivestreamId(null);
    setEditingLivestreamTitle("");
    setEditingLivestreamDescription("");
    setEditingLivestreamUrl("");
    setEditingLivestreamDate("");
    setEditingLivestreamTime("");
    setEditingLivestreamStatus("upcoming");
  } catch (error) {
    console.error(
      "Could not update livestream:",
      error
    );
  } finally {
    setUpdatingLivestream(false);
  }
};
const handleCreateVolunteerOpportunity = async () => {
  if (!user?.id || !mosqueId || !canManageAnnouncements) {
    return;
  }

  const title = volunteerTitle.trim();
  const description = volunteerDescription.trim();
  const location = volunteerLocation.trim();
  const needed = volunteersNeeded
    ? Number.parseInt(volunteersNeeded, 10)
    : null;

  if (!title || !volunteerDate) {
    return;
  }

  if (
    volunteersNeeded &&
    (!Number.isInteger(needed) || (needed ?? 0) < 1)
  ) {
    return;
  }

  if (
    volunteerStartTime &&
    volunteerEndTime &&
    volunteerEndTime <= volunteerStartTime
  ) {
    return;
  }

  setSavingVolunteerOpportunity(true);

  try {
    const { data, error } = await supabase
      .from("mosque_volunteer_opportunities")
      .insert({
        mosque_id: mosqueId,
        created_by: user.id,
        title,
        description: description || null,
        volunteer_date: volunteerDate,
        start_time: volunteerStartTime || null,
        end_time: volunteerEndTime || null,
        location: location || null,
        volunteers_needed: needed,
        status: "open",
      })
      .select(
        "id,mosque_id,created_by,title,description,volunteer_date,start_time,end_time,location,volunteers_needed,status,created_at"
      )
      .single();

    if (error) {
      throw error;
    }

      const { data: followers, error: followersError } = await supabase
        .from("mosque_followers")
        .select("user_id")
        .eq("mosque_id", mosqueId)
        .or("notifications_enabled.eq.true,notifications_enabled.is.null")
        .neq("user_id", user.id);

      if (followersError) {
        console.error(
          "Could not load followers for volunteer notifications:",
          followersError
        );
      } else if (followers && followers.length > 0) {
        const volunteerNotifications = followers.map((follower) => ({
          user_id: follower.user_id,
          actor_id: user.id,
          type: `volunteer_opportunity:${mosqueId}`,
          title: "New volunteer opportunity",
          body: `${title} needs volunteers on ${volunteerDate}. Tap to view details.`,
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(volunteerNotifications);

        if (notificationError) {
          console.error(
            "Could not send volunteer notifications:",
            notificationError
          );
        }
      }

    setVolunteerOpportunities((current) =>
      [
        ...current,
        {
          ...data,
          signup_count: 0,
          current_user_signup_id: null,
          current_user_signup_status: null,
        },
      ].sort((first, second) => {
        const firstTime = new Date(
          `${first.volunteer_date}T${first.start_time || "00:00"}`
        ).getTime();

        const secondTime = new Date(
          `${second.volunteer_date}T${second.start_time || "00:00"}`
        ).getTime();

        return firstTime - secondTime;
      })
    );

    setVolunteerTitle("");
    setVolunteerDescription("");
    setVolunteerDate("");
    setVolunteerStartTime("");
    setVolunteerEndTime("");
    setVolunteerLocation("");
    setVolunteersNeeded("");
    setVolunteerFormOpen(false);
  } catch (error) {
    console.error("Could not create volunteer opportunity:", error);
  } finally {
    setSavingVolunteerOpportunity(false);
  }
};

const handleOpenVolunteerSignup = (
  opportunity: MosqueVolunteerOpportunity
) => {
  if (!user?.id) {
    navigate("/auth");
    return;
  }

  setVolunteerSignupOpportunityId(opportunity.id);
  setVolunteerFullName("");
  setVolunteerPhone("");
  setVolunteerEmail(user.email || "");
  setVolunteerNotes("");
};

const handleSubmitVolunteerSignup = async () => {
  if (
    !user?.id ||
    !volunteerSignupOpportunityId ||
    !volunteerFullName.trim()
  ) {
    return;
  }

  setSubmittingVolunteerSignup(true);

  try {
    const { data, error } = await supabase
      .from("mosque_volunteer_signups")
      .insert({
        opportunity_id: volunteerSignupOpportunityId,
        user_id: user.id,
        full_name: volunteerFullName.trim(),
        phone: volunteerPhone.trim() || null,
        email: volunteerEmail.trim() || null,
        notes: volunteerNotes.trim() || null,
        status: "signed_up",
      })
      .select("id,opportunity_id,status")
      .single();

    if (error) {
      throw error;
    }

    setVolunteerOpportunities((current) =>
      current.map((opportunity) =>
        opportunity.id === volunteerSignupOpportunityId
          ? {
              ...opportunity,
              signup_count: (opportunity.signup_count ?? 0) + 1,
              current_user_signup_id: data.id,
              current_user_signup_status: data.status,
            }
          : opportunity
      )
    );

    setVolunteerSignupOpportunityId(null);
    setVolunteerFullName("");
    setVolunteerPhone("");
    setVolunteerEmail("");
    setVolunteerNotes("");
  } catch (error) {
    console.error("Could not submit volunteer signup:", error);
  } finally {
    setSubmittingVolunteerSignup(false);
  }
};

const handleCancelVolunteerSignup = async (
  opportunity: MosqueVolunteerOpportunity
) => {
  if (!user?.id || !opportunity.current_user_signup_id) {
    return;
  }

  try {
    const { error } = await supabase
      .from("mosque_volunteer_signups")
      .update({
        status: "cancelled",
      })
      .eq("id", opportunity.current_user_signup_id)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    setVolunteerOpportunities((current) =>
      current.map((item) =>
        item.id === opportunity.id
          ? {
              ...item,
              signup_count: Math.max(0, (item.signup_count ?? 0) - 1),
              current_user_signup_id: null,
              current_user_signup_status: null,
            }
          : item
      )
    );
  } catch (error) {
    console.error("Could not cancel volunteer signup:", error);
  }
};

const handleLoadVolunteerSignups = async (opportunityId: string) => {
  if (!canManageAnnouncements) {
    return;
  }

  if (viewingVolunteerSignupsId === opportunityId) {
    setViewingVolunteerSignupsId(null);
    setVolunteerSignups([]);
    return;
  }

  setLoadingVolunteerSignups(true);

  try {
    const { data, error } = await supabase
      .from("mosque_volunteer_signups")
      .select(
        "id,opportunity_id,user_id,full_name,phone,email,notes,status,created_at"
      )
      .eq("opportunity_id", opportunityId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    setVolunteerSignups(data ?? []);
    setViewingVolunteerSignupsId(opportunityId);
  } catch (error) {
    console.error("Could not load volunteer signups:", error);
  } finally {
    setLoadingVolunteerSignups(false);
  }
};

const handleDeleteVolunteerOpportunity = async (
  opportunityId: string
) => {
  if (!canManageAnnouncements) {
    return;
  }

  const confirmed = window.confirm(
    "Delete this volunteer opportunity and all of its signups?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const { error } = await supabase
      .from("mosque_volunteer_opportunities")
      .delete()
      .eq("id", opportunityId);

    if (error) {
      throw error;
    }

    setVolunteerOpportunities((current) =>
      current.filter((opportunity) => opportunity.id !== opportunityId)
    );

    if (viewingVolunteerSignupsId === opportunityId) {
      setViewingVolunteerSignupsId(null);
      setVolunteerSignups([]);
    }
  } catch (error) {
    console.error("Could not delete volunteer opportunity:", error);
  }
};

const handleStartEditingMosqueEvent = (event: MosqueEvent) => {
  setEditingMosqueEventId(event.id);
  setEditingEventTitle(event.title || "");
  setEditingEventDescription(event.description || "");
  setEditingEventDate(event.event_date || "");
  setEditingEventTime(event.event_time || "");
  setEditingEventLocation(event.location || "");
  setEditingEventCategory(event.category || "religious");
};

const handleUpdateMosqueEvent = async () => {
  if (
    !editingMosqueEventId ||
    !mosqueId ||
    !canManageAnnouncements
  ) {
    return;
  }

  const title = editingEventTitle.trim();
  const description = editingEventDescription.trim();
  const location = editingEventLocation.trim();

  if (
    !title ||
    !editingEventDate ||
    !editingEventTime ||
    !location
  ) {
    return;
  }

  const eventDateTime = new Date(
    `${editingEventDate}T${editingEventTime}`
  );

  if (eventDateTime <= new Date()) {
    return;
  }

  setUpdatingMosqueEvent(true);

  try {
    const { data, error } = await supabase
      .from("events")
      .update({
        title,
        description: description || null,
        event_date: editingEventDate,
        event_time: editingEventTime,
        location,
        category: editingEventCategory,
        start_at: `${editingEventDate}T${editingEventTime}:00`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingMosqueEventId)
      .eq("mosque_id", mosqueId)
      .select(
        "id,title,description,event_date,event_time,location,category,status"
      )
      .single();

    if (error) {
      throw error;
    }

    setMosqueEvents((current) =>
      current
        .map((event) =>
          event.id === data.id ? data : event
        )
        .sort((first, second) => {
          const firstTime = new Date(
            `${first.event_date}T${first.event_time}`
          ).getTime();

          const secondTime = new Date(
            `${second.event_date}T${second.event_time}`
          ).getTime();

          return firstTime - secondTime;
        })
    );

    setEditingMosqueEventId(null);
    setEditingEventTitle("");
    setEditingEventDescription("");
    setEditingEventDate("");
    setEditingEventTime("");
    setEditingEventLocation("");
    setEditingEventCategory("religious");
  } catch (error) {
    console.error("Could not update mosque event:", error);
  } finally {
    setUpdatingMosqueEvent(false);
  }
};

const handleDeleteMosqueEvent = async (eventId: string) => {
  if (!mosqueId || !canManageAnnouncements) {
    return;
  }

  const confirmed = window.confirm(
    "Delete this mosque event?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId)
      .eq("mosque_id", mosqueId);

    if (error) {
      throw error;
    }

    setMosqueEvents((current) =>
      current.filter((event) => event.id !== eventId)
    );

    if (editingMosqueEventId === eventId) {
      setEditingMosqueEventId(null);
    }
  } catch (error) {
    console.error("Could not delete mosque event:", error);
  }
};
const handleToggleMosqueFollow = async () => {
  if (!user?.id || !mosqueId) {
    navigate("/auth");
    return;
  }

  setMosqueFollowLoading(true);

  try {
    if (isFollowingMosque) {
      const { error } = await supabase
        .from("mosque_followers")
        .delete()
        .eq("mosque_id", mosqueId)
        .eq("user_id", user.id);

      if (error) throw error;

      setIsFollowingMosque(false);
      setMosqueNotificationsEnabled(true);
      setMosqueFollowerCount((current) => Math.max(0, current - 1));
    } else {
      const { error } = await supabase
        .from("mosque_followers")
        .insert({
          mosque_id: mosqueId,
          user_id: user.id,
          notifications_enabled: true,
          auto_join_groups: false,
        });

      if (error) throw error;

      setIsFollowingMosque(true);
      setMosqueNotificationsEnabled(true);
      setMosqueFollowerCount((current) => current + 1);
    }
  } catch (error) {
    console.error("Could not update mosque follow:", error);
  } finally {
    setMosqueFollowLoading(false);
  }
};

const handleToggleMosqueNotifications = async () => {
  if (!user?.id || !mosqueId || !isFollowingMosque) {
    return;
  }

  const nextValue = !mosqueNotificationsEnabled;

  try {
    const { error } = await supabase
      .from("mosque_followers")
      .update({
        notifications_enabled: nextValue,
      })
      .eq("mosque_id", mosqueId)
      .eq("user_id", user.id);

    if (error) throw error;

    setMosqueNotificationsEnabled(nextValue);
  } catch (error) {
    console.error(
      "Could not update mosque notifications:",
      error
    );
  }
};

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading mosque profile...</p>
      </main>
    );
  }

  if (!mosque || errorMessage) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/mosques")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mosques
        </Button>

        <div className="rounded-xl border p-6 text-center">
          <p className="text-muted-foreground">
            {errorMessage || "Mosque not found."}
          </p>
        </div>
      </main>
    );
  }

const location = [mosque.city, mosque.state]
  .filter(Boolean)
  .join(", ");

const localMosqueImages: Record<string, string> = {
  "Islamic Center of Chicago": islamicCenterChicagoImage,
  "Muslim Community Center": muslimCommunityCenterChicagoImage,
  "Council of Islamic Organizations of Greater Chicago": ciogcChicagoImage,
  "Islamic Society of South Texas (ISST)": islamicSocietySouthTexasImage,
  "Islamic Society of Midwest": islamicSocietyMidwestImage,
  "Islamic Center of Detroit": muslimCenterDetroitImage,
  "Islamic Center of Minnesota": islamicCenterMinnesotaImage,
  "Islamic Center of Cleveland": masjidAlHikmahClevelandImage,
  "Islamic Society of Milwaukee": islamicSocietyGreaterMilwaukeeImage,
  "Brooklyn Islamic Center": brooklynIslamicCenterImage,
};

const mosqueImage =
  mosque.image_url || localMosqueImages[mosque.name] || null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/mosques")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Mosques
        </Button>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="aspect-[16/7] bg-muted">
          {mosqueImage ? (
            <img
              src={mosqueImage}
                alt={mosque.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Mosque photo
              </div>
            )}
          </div>

          <div className="space-y-6 p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold">{mosque.name}</h1>

                {mosque.verified && (
                  <BadgeCheck className="h-6 w-6 text-islamic-green" />
                )}
              </div>

              {(mosque.address || location) && (
                <div className="mt-3 flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {[mosque.address, location].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {mosqueFollowerCount}{" "}
                  {mosqueFollowerCount === 1 ? "Follower" : "Followers"}
                </p>

                <p className="text-sm text-muted-foreground">
                  Follow this mosque for announcements and event updates.
                </p>
              </div>

     <div className="flex flex-col gap-2 sm:items-end">
       <Button
         type="button"
         variant={isFollowingMosque ? "outline" : "default"}
         onClick={() => void handleToggleMosqueFollow()}
         disabled={mosqueFollowLoading}
       >
         {mosqueFollowLoading
           ? "Please wait..."
           : isFollowingMosque
             ? "Following"
             : "Follow Mosque"}
       </Button>

       {isFollowingMosque && (
         <label className="flex cursor-pointer items-center gap-2 text-sm">
           <input
             type="checkbox"
             checked={mosqueNotificationsEnabled}
             onChange={() => void handleToggleMosqueNotifications()}
             className="h-4 w-4"
           />

           <span>
             {mosqueNotificationsEnabled
               ? "Notifications On"
               : "Notifications Off"}
           </span>
         </label>
       )}
     </div>
     </div>


{!mosque.claimed_by && (
  <section className="rounded-2xl border bg-card p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">
          Claim This Mosque
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Mosque representatives can request access to manage prayer times,
          announcements, and profile information.
        </p>
      </div>

      {!user ? (
        <Button
          type="button"
          onClick={() => navigate("/auth")}
        >
          Sign In to Claim
        </Button>
      ) : existingClaimStatus === "pending" ? (
        <span className="rounded-full bg-islamic-gold/15 px-3 py-2 text-sm font-medium text-islamic-gold">
          Claim Pending Review
        </span>
      ) : existingClaimStatus === "approved" ? (
        <span className="rounded-full bg-islamic-green/15 px-3 py-2 text-sm font-medium text-islamic-green">
          Claim Approved
        </span>
      ) : (
        <Button
          type="button"
          onClick={() => setClaimFormOpen((current) => !current)}
        >
          {claimFormOpen ? "Close Claim Form" : "Claim This Mosque"}
        </Button>
      )}
    </div>

    {user &&
      existingClaimStatus !== "pending" &&
      existingClaimStatus !== "approved" &&
      claimFormOpen && (
        <div className="mt-5 space-y-4 border-t pt-5">
          {existingClaimStatus === "rejected" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Your previous claim was not approved. You may submit updated
              information.
            </div>
          )}

          <div>
            <label className="text-sm font-medium">
              Full Name
            </label>

            <input
              type="text"
              value={claimFullName}
              onChange={(event) =>
                setClaimFullName(event.target.value)
              }
              placeholder="Your full name"
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Your Role at the Mosque
            </label>

            <input
              type="text"
              value={claimRole}
              onChange={(event) =>
                setClaimRole(event.target.value)
              }
              placeholder="Example: Imam, administrator, board member"
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">
                Email
              </label>

              <input
                type="email"
                value={claimEmail}
                onChange={(event) =>
                  setClaimEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Phone
              </label>

              <input
                type="tel"
                value={claimPhone}
                onChange={(event) =>
                  setClaimPhone(event.target.value)
                }
                placeholder="Phone number"
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Proof and Verification Details
            </label>

            <textarea
              value={claimProofDetails}
              onChange={(event) =>
                setClaimProofDetails(event.target.value)
              }
              placeholder="Explain your relationship to the mosque and how the admin can verify your role."
              className="mt-2 min-h-[140px] w-full rounded-md border bg-background p-3 text-sm"
            />
          </div>

          <Button
            type="button"
            onClick={() => void handleSubmitMosqueClaim()}
            disabled={
              submittingClaim ||
              !claimFullName.trim() ||
              !claimRole.trim() ||
              !claimEmail.trim() ||
              !claimProofDetails.trim()
            }
            className="w-full"
          >
            {submittingClaim
              ? "Submitting Claim..."
              : "Submit Claim for Review"}
          </Button>
        </div>
      )}
  </section>
)}

{canManageAnnouncements && (
  <section className="rounded-2xl border bg-card p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">
          Mosque Profile Management
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Update this mosque’s public information.
        </p>
      </div>

      <Button
        type="button"
        variant={editingMosqueProfile ? "outline" : "default"}
        onClick={() => {
          if (editingMosqueProfile) {
            setEditingMosqueProfile(false);
            return;
          }

          handleStartEditingMosqueProfile();
        }}
      >
        {editingMosqueProfile
          ? "Close Edit Form"
          : "Edit Mosque Profile"}
      </Button>
    </div>

    {editingMosqueProfile && (
      <div className="mt-5 space-y-4 border-t pt-5">
        <div>
          <label className="text-sm font-medium">
            Mosque Name
          </label>

          <input
            type="text"
            value={editMosqueName}
            onChange={(event) =>
              setEditMosqueName(event.target.value)
            }
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Address
          </label>

          <input
            type="text"
            value={editMosqueAddress}
            onChange={(event) =>
              setEditMosqueAddress(event.target.value)
            }
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">
              City
            </label>

            <input
              type="text"
              value={editMosqueCity}
              onChange={(event) =>
                setEditMosqueCity(event.target.value)
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              State
            </label>

            <input
              type="text"
              value={editMosqueState}
              onChange={(event) =>
                setEditMosqueState(event.target.value)
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">
              Phone
            </label>

            <input
              type="tel"
              value={editMosquePhone}
              onChange={(event) =>
                setEditMosquePhone(event.target.value)
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Website
            </label>

            <input
              type="url"
              value={editMosqueWebsite}
              onChange={(event) =>
                setEditMosqueWebsite(event.target.value)
              }
              placeholder="https://example.org"
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">
            Description
          </label>

          <textarea
            value={editMosqueDescription}
            onChange={(event) =>
              setEditMosqueDescription(event.target.value)
            }
            className="mt-2 min-h-[140px] w-full rounded-md border bg-background p-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => void handleSaveMosqueProfile()}
            disabled={
              savingMosqueProfile ||
              !editMosqueName.trim()
            }
            className="flex-1"
          >
            {savingMosqueProfile
              ? "Saving Profile..."
              : "Save Mosque Profile"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setEditingMosqueProfile(false)}
            disabled={savingMosqueProfile}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    )}
  </section>
)}

<section>
  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h2 className="text-xl font-semibold">
      Prayer Times
    </h2>

    {canManageAnnouncements && (
      <Button
        type="button"
        variant={editingPrayerTimes ? "outline" : "default"}
        onClick={() => {
          if (editingPrayerTimes) {
            setEditingPrayerTimes(false);
            return;
          }

          handleStartEditingPrayerTimes();
        }}
      >
        {editingPrayerTimes
          ? "Close Prayer Form"
          : "Edit Prayer Times"}
      </Button>
    )}
  </div>
  {canManageAnnouncements && editingPrayerTimes && (
    <div className="mb-5 space-y-4 rounded-2xl border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Fajr</label>
          <input
            type="text"
            value={editFajr}
            onChange={(event) => setEditFajr(event.target.value)}
            placeholder="Example: 5:30 AM"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Dhuhr</label>
          <input
            type="text"
            value={editDhuhr}
            onChange={(event) => setEditDhuhr(event.target.value)}
            placeholder="Example: 1:00 PM"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Asr</label>
          <input
            type="text"
            value={editAsr}
            onChange={(event) => setEditAsr(event.target.value)}
            placeholder="Example: 5:00 PM"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Maghrib</label>
          <input
            type="text"
            value={editMaghrib}
            onChange={(event) => setEditMaghrib(event.target.value)}
            placeholder="Example: 8:15 PM"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Isha</label>
          <input
            type="text"
            value={editIsha}
            onChange={(event) => setEditIsha(event.target.value)}
            placeholder="Example: 9:45 PM"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Jummah</label>
          <input
            type="text"
            value={editJummah}
            onChange={(event) => setEditJummah(event.target.value)}
            placeholder="Example: 1:00 PM Khutbah, 1:30 PM Salah"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={() => void handleSavePrayerTimes()}
          disabled={savingPrayerTimes}
          className="flex-1"
        >
          {savingPrayerTimes
            ? "Saving Prayer Times..."
            : "Save Prayer Times"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => setEditingPrayerTimes(false)}
          disabled={savingPrayerTimes}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  )}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        ["Fajr", mosque.prayer_times?.fajr],
        ["Dhuhr", mosque.prayer_times?.dhuhr],
        ["Asr", mosque.prayer_times?.asr],
        ["Maghrib", mosque.prayer_times?.maghrib],
        ["Isha", mosque.prayer_times?.isha],
        ["Jummah", mosque.prayer_times?.jummah],
      ].map(([label, time]) => (
        <div
          key={label}
          className="rounded-xl border bg-muted/20 p-4 text-center"
        >
          <p className="text-sm text-muted-foreground">
            {label}
          </p>

          <p className="mt-1 font-semibold">
            {time || "Not provided"}
          </p>
        </div>
      ))}
    </div>
  </section>
  <section className="rounded-2xl border bg-card p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">Mosque Events</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming programs and community activities.
        </p>
      </div>

      {canManageAnnouncements && (
        <Button
          type="button"
          onClick={() => setEventFormOpen((current) => !current)}
          variant={eventFormOpen ? "outline" : "default"}
        >
          {eventFormOpen ? "Close Event Form" : "Create Mosque Event"}
        </Button>
      )}
    </div>

    {canManageAnnouncements && eventFormOpen && (
      <div className="mt-5 space-y-4 border-t pt-5">
        <div>
          <label className="text-sm font-medium">Event Title</label>

          <input
            type="text"
            value={eventTitle}
            onChange={(event) => setEventTitle(event.target.value)}
            placeholder="Enter event title"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Description</label>

          <textarea
            value={eventDescription}
            onChange={(event) => setEventDescription(event.target.value)}
            placeholder="Describe the event"
            className="mt-2 min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Date</label>

            <input
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Time</label>

            <input
              type="time"
              value={eventTime}
              onChange={(event) => setEventTime(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Location</label>

            <input
              type="text"
              value={eventLocation}
              onChange={(event) => setEventLocation(event.target.value)}
              placeholder="Main prayer hall"
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>

          <select
            value={eventCategory}
            onChange={(event) => setEventCategory(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="religious">Religious</option>
            <option value="educational">Educational</option>
            <option value="cultural">Cultural</option>
            <option value="social">Social</option>
            <option value="general">General</option>
          </select>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void handleCreateMosqueEvent()}
          disabled={
            savingMosqueEvent ||
            !eventTitle.trim() ||
            !eventDate ||
            !eventTime ||
            !eventLocation.trim()
          }
          className="w-full"
        >
          {savingMosqueEvent ? "Creating Event..." : "Create Event"}
        </Button>
      </div>
    )}

    <div className="mt-5 space-y-3">
      {mosqueEvents.length === 0 ? (
        <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          No upcoming mosque events.
        </p>
      ) : (
          mosqueEvents.map((event) => (
     <article
       key={event.id}
       className="rounded-xl border bg-muted/20 p-4"
     >
       {editingMosqueEventId === event.id ? (
         <div className="space-y-4">
           <div>
             <label className="text-sm font-medium">
               Event Title
             </label>

             <input
               type="text"
               value={editingEventTitle}
               onChange={(changeEvent) =>
                 setEditingEventTitle(changeEvent.target.value)
               }
               className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
             />
           </div>

           <div>
             <label className="text-sm font-medium">
               Description
             </label>

             <textarea
               value={editingEventDescription}
               onChange={(changeEvent) =>
                 setEditingEventDescription(changeEvent.target.value)
               }
               className="mt-2 min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
             />
           </div>

           <div className="grid gap-4 sm:grid-cols-2">
             <div>
               <label className="text-sm font-medium">
                 Date
               </label>

               <input
                 type="date"
                 value={editingEventDate}
                 onChange={(changeEvent) =>
                   setEditingEventDate(changeEvent.target.value)
                 }
                 min={new Date().toISOString().split("T")[0]}
                 className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
               />
             </div>

             <div>
               <label className="text-sm font-medium">
                 Time
               </label>

               <input
                 type="time"
                 value={editingEventTime}
                 onChange={(changeEvent) =>
                   setEditingEventTime(changeEvent.target.value)
                 }
                 className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
               />
             </div>
           </div>

           <div className="grid gap-4 sm:grid-cols-2">
             <div>
               <label className="text-sm font-medium">
                 Location
               </label>

               <input
                 type="text"
                 value={editingEventLocation}
                 onChange={(changeEvent) =>
                   setEditingEventLocation(changeEvent.target.value)
                 }
                 className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
               />
             </div>

             <div>
               <label className="text-sm font-medium">
                 Category
               </label>

               <select
                 onChange={(changeEvent) =>
                   setEditingEventCategory(changeEvent.target.value)
                 }
                 className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
               >
                 <option value="community">Community</option>
                 <option value="lecture">Lecture</option>
                 <option value="education">Education</option>
                 <option value="youth">Youth</option>
                 <option value="sisters">Sisters</option>
                 <option value="fundraiser">Fundraiser</option>
                 <option value="jummah">Jummah</option>
               </select>
             </div>
           </div>

           <div className="flex flex-col gap-2 sm:flex-row">
             <Button
               type="button"
               onClick={() => void handleUpdateMosqueEvent()}
               disabled={
                 updatingMosqueEvent ||
                 !editingEventTitle.trim() ||
                 !editingEventDate ||
                 !editingEventTime ||
                 !editingEventLocation.trim()
               }
               className="flex-1"
             >
               {updatingMosqueEvent ? "Saving Event..." : "Save Event"}
             </Button>

             <Button
               type="button"
               variant="outline"
               onClick={() => setEditingMosqueEventId(null)}
               disabled={updatingMosqueEvent}
               className="flex-1"
             >
               Cancel
             </Button>
           </div>
         </div>
       ) : (
         <>
           <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
             <div>
               <h3 className="font-semibold">
                 {event.title || "Mosque Event"}
               </h3>

               <p className="mt-1 text-sm text-muted-foreground">
                 {new Date(
                   `${event.event_date}T${event.event_time}`
                 ).toLocaleString()}
               </p>
             </div>

             <div className="flex flex-wrap gap-2">
               {event.category && (
                 <span className="w-fit rounded-full bg-islamic-green/10 px-2 py-1 text-xs font-medium text-islamic-green">
                   {event.category}
                 </span>
               )}

               {canManageAnnouncements && (
                 <>
                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     onClick={() =>
                       handleStartEditingMosqueEvent(event)
                     }
                   >
                     Edit
                   </Button>

                   <Button
                     type="button"
                     size="sm"
                     variant="destructive"
                     onClick={() =>
                       void handleDeleteMosqueEvent(event.id)
                     }
                   >
                     Delete
                   </Button>
                 </>
               )}
             </div>
           </div>

           {event.description && (
             <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
               {event.description}
             </p>
           )}

           {event.location && (
             <p className="mt-3 text-sm font-medium">
               Location: {event.location}
             </p>
           )}
         </>
       )}
     </article>
        ))
      )}
    </div>
  </section>
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Mosque Livestreams</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Watch live broadcasts and view upcoming mosque programs.
          </p>
        </div>

        {canManageAnnouncements && (
          <Button
            type="button"
            onClick={() =>
              setLivestreamFormOpen((current) => !current)
            }
            variant={livestreamFormOpen ? "outline" : "default"}
          >
            {livestreamFormOpen
              ? "Close Livestream Form"
              : "Create Livestream"}
          </Button>
        )}
      </div>

      {canManageAnnouncements && livestreamFormOpen && (
        <div className="mt-5 space-y-4 border-t pt-5">
          <div>
            <label className="text-sm font-medium">
              Livestream Title
            </label>

            <input
              type="text"
              value={livestreamTitle}
              onChange={(event) =>
                setLivestreamTitle(event.target.value)
              }
              placeholder="Example: Friday Jummah Khutbah"
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Description
            </label>

            <textarea
              value={livestreamDescription}
              onChange={(event) =>
                setLivestreamDescription(event.target.value)
              }
              placeholder="Describe the livestream"
              className="mt-2 min-h-[110px] w-full rounded-md border bg-background p-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Stream URL
            </label>

            <input
              type="url"
              value={livestreamUrl}
              onChange={(event) =>
                setLivestreamUrl(event.target.value)
              }
              placeholder="https://youtube.com/live/..."
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">
                Status
              </label>

              <select
                value={livestreamStatus}
                onChange={(event) =>
                  setLivestreamStatus(
                    event.target.value as
                      | "upcoming"
                      | "live"
                      | "ended"
                  )
                }
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">
                Date
              </label>

              <input
                type="date"
                value={livestreamDate}
                onChange={(event) =>
                  setLivestreamDate(event.target.value)
                }
                min={new Date().toISOString().split("T")[0]}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Time
              </label>

              <input
                type="time"
                value={livestreamTime}
                onChange={(event) =>
                  setLivestreamTime(event.target.value)
                }
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
          </div>

          {livestreamStatus === "upcoming" &&
            (!livestreamDate || !livestreamTime) && (
              <p className="text-sm text-muted-foreground">
                Upcoming livestreams require a date and time.
              </p>
            )}

          <Button
            type="button"
            onClick={() => void handleCreateLivestream()}
            disabled={
              savingLivestream ||
              !livestreamTitle.trim() ||
              !livestreamUrl.trim() ||
              (livestreamStatus === "upcoming" &&
                (!livestreamDate || !livestreamTime))
            }
            className="w-full"
          >
            {savingLivestream
              ? "Creating Livestream..."
              : "Create Livestream"}
          </Button>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {mosqueLivestreams.length === 0 ? (
          <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            No mosque livestreams are currently available.
          </p>
        ) : (
          mosqueLivestreams.map((livestream) => (
            <article
              key={livestream.id}
              className="rounded-xl border bg-muted/20 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {livestream.title}
                    </h3>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        livestream.status === "live"
                          ? "bg-red-100 text-red-700"
                          : livestream.status === "upcoming"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {livestream.status === "live"
                        ? "LIVE NOW"
                        : livestream.status === "upcoming"
                          ? "UPCOMING"
                          : "ENDED"}
                    </span>
                  </div>

                  {livestream.scheduled_for && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {new Date(
                        livestream.scheduled_for
                      ).toLocaleString()}
                    </p>
                  )}
                </div>

                     <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/mosques/${mosqueId}/livestreams/${livestream.id}`
                          )
                        }
                      >
                        {livestream.status === "live"
                          ? "Watch Live"
                          : livestream.status === "upcoming"
                            ? "View Stream"
                            : "Watch Recording"}
                      </Button>
                     </div>
                   </div>

                   {canManageAnnouncements && (
                     <div className="mt-3 flex flex-wrap gap-2">
                       {livestream.status !== "live" && (
                         <Button
                           type="button"
                           size="sm"
                           variant="outline"
                           onClick={() =>
                             void handleUpdateLivestreamStatus(
                               livestream.id,
                               "live"
                             )
                           }
                         >
                           Go Live
                         </Button>
                       )}

                       {livestream.status !== "ended" && (
                         <Button
                           type="button"
                           size="sm"
                           variant="outline"
                           onClick={() =>
                             void handleUpdateLivestreamStatus(
                               livestream.id,
                               "ended"
                             )
                           }
                         >
                           End
                         </Button>
                       )}

                       <Button
                         type="button"
                         size="sm"
                         variant="destructive"
                         onClick={() =>
                           void handleDeleteLivestream(
                             livestream.id
                           )
                         }
                       >
                         Delete
                       </Button>
                     </div>
                   )}

                   {livestream.description && (
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                  {livestream.description}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  <section className="rounded-2xl border bg-card p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">
          Volunteer Opportunities
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Help the mosque with upcoming programs and community activities.
        </p>
      </div>

      {canManageAnnouncements && (
        <Button
          type="button"
          onClick={() => setVolunteerFormOpen((current) => !current)}
          variant={volunteerFormOpen ? "outline" : "default"}
        >
          {volunteerFormOpen
            ? "Close Volunteer Form"
            : "Create Opportunity"}
        </Button>
      )}
    </div>

    {canManageAnnouncements && volunteerFormOpen && (
      <div className="mt-5 space-y-4 border-t pt-5">
        <div>
          <label className="text-sm font-medium">
            Opportunity Title
          </label>

          <input
            type="text"
            value={volunteerTitle}
            onChange={(event) => setVolunteerTitle(event.target.value)}
            placeholder="Example: Ramadan food distribution"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Description
          </label>

          <textarea
            value={volunteerDescription}
            onChange={(event) =>
              setVolunteerDescription(event.target.value)
            }
            placeholder="Describe the work volunteers will help with"
            className="mt-2 min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">
              Volunteer Date
            </label>

            <input
              type="date"
              value={volunteerDate}
              onChange={(event) => setVolunteerDate(event.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Volunteers Needed
            </label>

            <input
              type="number"
              min="1"
              value={volunteersNeeded}
              onChange={(event) =>
                setVolunteersNeeded(event.target.value)
              }
              placeholder="Optional"
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">
              Start Time
            </label>

            <input
              type="time"
              value={volunteerStartTime}
              onChange={(event) =>
                setVolunteerStartTime(event.target.value)
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              End Time
            </label>

            <input
              type="time"
              value={volunteerEndTime}
              onChange={(event) =>
                setVolunteerEndTime(event.target.value)
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">
            Location
          </label>

          <input
            type="text"
            value={volunteerLocation}
            onChange={(event) =>
              setVolunteerLocation(event.target.value)
            }
            placeholder="Example: Mosque community hall"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <Button
          type="button"
          onClick={() => void handleCreateVolunteerOpportunity()}
          disabled={
            savingVolunteerOpportunity ||
            !volunteerTitle.trim() ||
            !volunteerDate
          }
          className="w-full"
        >
          {savingVolunteerOpportunity
            ? "Creating Opportunity..."
            : "Create Volunteer Opportunity"}
        </Button>
      </div>
    )}

    <div className="mt-5 space-y-4">
      {volunteerOpportunities.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          No volunteer opportunities are currently available.
        </div>
      ) : (
        volunteerOpportunities.map((opportunity) => {
          const signupCount = opportunity.signup_count ?? 0;

          const isFull =
            opportunity.status === "full" ||
            (opportunity.volunteers_needed !== null &&
              signupCount >= opportunity.volunteers_needed);

          const isSignedUp =
            opportunity.current_user_signup_status === "signed_up" ||
            opportunity.current_user_signup_status === "attended";

          const signupFormOpen =
            volunteerSignupOpportunityId === opportunity.id;

          const volunteerListOpen =
            viewingVolunteerSignupsId === opportunity.id;

          return (
            <article
              key={opportunity.id}
              className="rounded-xl border bg-muted/20 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {opportunity.title}
                    </h3>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        isFull
                          ? "bg-orange-500/10 text-orange-700"
                          : "bg-islamic-green/10 text-islamic-green"
                      }`}
                    >
                      {isFull ? "Full" : "Open"}
                    </span>

                    {isSignedUp && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700">
                        You are signed up
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm font-medium">
                    {new Date(
                      `${opportunity.volunteer_date}T${
                        opportunity.start_time || "00:00"
                      }`
                    ).toLocaleDateString()}
                  </p>

                  {(opportunity.start_time ||
                    opportunity.end_time) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Time:{" "}
                      {opportunity.start_time
                        ? new Date(
                            `${opportunity.volunteer_date}T${opportunity.start_time}`
                          ).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Not provided"}

                      {opportunity.end_time &&
                        ` – ${new Date(
                          `${opportunity.volunteer_date}T${opportunity.end_time}`
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}`}
                    </p>
                  )}

                  {opportunity.location && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Location: {opportunity.location}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                 {!canManageAnnouncements &&
                   (isSignedUp ? (
                     <Button
                       type="button"
                       size="sm"
                       variant="outline"
                       onClick={() =>
                         void handleCancelVolunteerSignup(opportunity)
                       }
                     >
                       Cancel Signup
                     </Button>
                   ) : (
                     <Button
                       type="button"
                       size="sm"
                       disabled={isFull}
                       onClick={() =>
                         handleOpenVolunteerSignup(opportunity)
                       }
                     >
                       {isFull ? "Opportunity Full" : "Sign Up"}
                     </Button>
                   ))}
                  {canManageAnnouncements && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleLoadVolunteerSignups(
                            opportunity.id
                          )
                        }
                        disabled={
                          loadingVolunteerSignups &&
                          viewingVolunteerSignupsId !==
                            opportunity.id
                        }
                      >
                        {volunteerListOpen
                          ? "Hide Volunteers"
                          : `View Volunteers (${signupCount})`}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          void handleDeleteVolunteerOpportunity(
                            opportunity.id
                          )
                        }
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {opportunity.description && (
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                  {opportunity.description}
                </p>
              )}

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {opportunity.volunteers_needed !== null
                      ? `${signupCount} of ${opportunity.volunteers_needed} volunteers`
                      : `${signupCount} volunteer${
                          signupCount === 1 ? "" : "s"
                        } signed up`}
                  </span>

                  {opportunity.volunteers_needed !== null && (
                    <span className="text-muted-foreground">
                      {Math.max(
                        0,
                        opportunity.volunteers_needed - signupCount
                      )}{" "}
                      spot
                      {Math.max(
                        0,
                        opportunity.volunteers_needed - signupCount
                      ) === 1
                        ? ""
                        : "s"}{" "}
                      remaining
                    </span>
                  )}
                </div>

                {opportunity.volunteers_needed !== null && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-islamic-green transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (signupCount /
                            opportunity.volunteers_needed) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              {signupFormOpen && !isSignedUp && (
                <div className="mt-5 space-y-4 border-t pt-5">
                  <h4 className="font-semibold">
                    Volunteer Signup
                  </h4>

                  <div>
                    <label className="text-sm font-medium">
                      Full Name
                    </label>

                    <input
                      type="text"
                      value={volunteerFullName}
                      onChange={(event) =>
                        setVolunteerFullName(event.target.value)
                      }
                      placeholder="Enter your full name"
                      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">
                        Phone
                      </label>

                      <input
                        type="tel"
                        value={volunteerPhone}
                        onChange={(event) =>
                          setVolunteerPhone(event.target.value)
                        }
                        placeholder="Optional"
                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Email
                      </label>

                      <input
                        type="email"
                        value={volunteerEmail}
                        onChange={(event) =>
                          setVolunteerEmail(event.target.value)
                        }
                        placeholder="Optional"
                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Message to the Mosque
                    </label>

                    <textarea
                      value={volunteerNotes}
                      onChange={(event) =>
                        setVolunteerNotes(event.target.value)
                      }
                      placeholder="Add any helpful details or availability"
                      className="mt-2 min-h-[100px] w-full rounded-md border bg-background p-3 text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() =>
                        void handleSubmitVolunteerSignup()
                      }
                      disabled={
                        submittingVolunteerSignup ||
                        !volunteerFullName.trim()
                      }
                      className="flex-1"
                    >
                      {submittingVolunteerSignup
                        ? "Submitting Signup..."
                        : "Confirm Volunteer Signup"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setVolunteerSignupOpportunityId(null);
                        setVolunteerFullName("");
                        setVolunteerPhone("");
                        setVolunteerEmail("");
                        setVolunteerNotes("");
                      }}
                      disabled={submittingVolunteerSignup}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {canManageAnnouncements && volunteerListOpen && (
                <div className="mt-5 border-t pt-5">
                  <h4 className="font-semibold">
                    Registered Volunteers
                  </h4>

                  {loadingVolunteerSignups ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Loading volunteers...
                    </p>
                  ) : volunteerSignups.length === 0 ? (
                    <p className="mt-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                      No volunteers have signed up yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {volunteerSignups.map((signup) => (
                        <div
                          key={signup.id}
                          className="rounded-lg border bg-background p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {signup.full_name ||
                                  "Tariq Islam Member"}
                              </p>

                              {signup.email && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Email: {signup.email}
                                </p>
                              )}

                              {signup.phone && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Phone: {signup.phone}
                                </p>
                              )}
                            </div>

                            <span className="w-fit rounded-full bg-islamic-green/10 px-2 py-1 text-xs font-medium text-islamic-green">
                              {signup.status === "attended"
                                ? "Attended"
                                : "Signed Up"}
                            </span>
                          </div>

                          {signup.notes && (
                            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                              {signup.notes}
                            </p>
                          )}

                          <p className="mt-3 text-xs text-muted-foreground">
                            Signed up{" "}
                            {new Date(
                              signup.created_at
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  </section>
<section>
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-xl font-semibold">Announcements</h2>

    {canManageAnnouncements && (
      <div className="mb-4 space-y-3 rounded-xl border bg-muted/20 p-4">
        <div>
          <label className="text-sm font-medium">
            Announcement Title
          </label>

          <input
            type="text"
            value={announcementTitle}
            onChange={(event) =>
              setAnnouncementTitle(event.target.value)
            }
            placeholder="Enter announcement title"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Announcement Message
          </label>

          <textarea
            value={announcementMessage}
            onChange={(event) =>
              setAnnouncementMessage(event.target.value)
            }
            placeholder="Write the mosque announcement"
            className="mt-2 min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={announcementPinned}
            onChange={(event) =>
              setAnnouncementPinned(event.target.checked)
            }
            className="h-4 w-4"
          />

          Pin this announcement
        </label>

        <Button
          type="button"
          onClick={() => void handleCreateAnnouncement()}
          disabled={
            savingAnnouncement ||
            !announcementTitle.trim() ||
            !announcementMessage.trim()
          }
          className="w-full"
        >
          {savingAnnouncement
            ? "Publishing Announcement..."
            : "Publish Announcement"}
        </Button>
      </div>
    )}

    {announcements.length > 0 && (
      <span className="text-sm text-muted-foreground">
        {announcements.length}
      </span>
    )}
  </div>

  {announcements.length === 0 ? (
    <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
      No announcements have been posted yet.
    </div>
  ) : (
    <div className="space-y-3">
      {announcements.map((announcement) => (
       <article
         key={announcement.id}
         className="rounded-xl border bg-card p-4"
       >
         {editingAnnouncementId === announcement.id ? (
           <div className="space-y-3">
             <input
               type="text"
               value={editingAnnouncementTitle}
               onChange={(event) =>
                 setEditingAnnouncementTitle(event.target.value)
               }
               className="h-10 w-full rounded-md border bg-background px-3 text-sm"
             />

             <textarea
               value={editingAnnouncementMessage}
               onChange={(event) =>
                 setEditingAnnouncementMessage(event.target.value)
               }
               className="min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
             />

             <div className="flex gap-2">
               <Button
                 type="button"
                 size="sm"
                 onClick={() => void handleUpdateAnnouncement()}
                 disabled={
                   updatingAnnouncement ||
                   !editingAnnouncementTitle.trim() ||
                   !editingAnnouncementMessage.trim()
                 }
               >
                 {updatingAnnouncement ? "Saving..." : "Save"}
               </Button>

               <Button
                 type="button"
                 size="sm"
                 variant="outline"
                 onClick={() => {
                   setEditingAnnouncementId(null);
                   setEditingAnnouncementTitle("");
                   setEditingAnnouncementMessage("");
                 }}
               >
                 Cancel
               </Button>
             </div>
           </div>
         ) : (
           <>
             <div className="flex items-start justify-between gap-3">
               <div>
                 <h3 className="font-semibold">{announcement.title}</h3>

                 {announcement.is_pinned && (
                   <span className="mt-2 inline-block rounded-full bg-islamic-green/10 px-2 py-1 text-xs font-medium text-islamic-green">
                     Pinned
                   </span>
                 )}
               </div>

               {canManageAnnouncements && (
                 <div className="flex flex-wrap justify-end gap-2">
                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     onClick={() =>
                       void handleTogglePinnedAnnouncement(announcement)
                     }
                   >
                     {announcement.is_pinned ? "Unpin" : "Pin"}
                   </Button>

                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     onClick={() =>
                       handleStartEditingAnnouncement(announcement)
                     }
                   >
                     Edit
                   </Button>

                   <Button
                     type="button"
                     size="sm"
                     variant="destructive"
                     onClick={() =>
                       void handleDeleteAnnouncement(announcement.id)
                     }
                   >
                     Delete
                   </Button>
                 </div>
               )}
             </div>

             <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
               {announcement.message}
             </p>

             <p className="mt-3 text-xs text-muted-foreground">
               {new Date(
                 announcement.published_at
               ).toLocaleDateString()}
             </p>
           </>
         )}
       </article>
       ))}
   </div>
   )}
   </section>
            <section className="grid gap-3 sm:grid-cols-2">
              {mosque.phone && (
                <a
                  href={`tel:${mosque.phone}`}
                  className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/50"
                >
                  <Phone className="h-5 w-5" />
                  <span>{mosque.phone}</span>
                </a>
              )}

          {mosque.website && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <h3 className="font-semibold">Support This Mosque</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Donations are handled directly by the mosque. Visit the mosque’s
                official website to donate.
              </p>
            </div>
          )}

              {mosque.website && (
                <a
                  href={mosque.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/50"
                >
                  <Globe2 className="h-5 w-5" />
                  <span>Visit Website</span>
                </a>
              )}
            </section>
          </div>
        </div>
        </div>
    </main>
  );
};

export default MosqueProfile;