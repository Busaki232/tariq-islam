import {
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe2,
  BadgeCheck,
  Loader2,
  Pencil,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { openInAppLink } from "@/utils/openInAppLink";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("mosques");

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
  const [
    uploadingMosqueImage,
    setUploadingMosqueImage,
  ] = useState(false);

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
const canManage =
  Boolean(user?.id) && data.claimed_by === user.id;

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

if (!fullName || !roleAtMosque || !email || !phone || !proofDetails) {
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
const handleMosqueImageChange = async (
  event: ChangeEvent<HTMLInputElement>
) => {
  const file = event.currentTarget.files?.[0] ?? null;

  event.currentTarget.value = "";

  if (
    !file ||
    !mosque ||
    !mosqueId ||
    !canManageAnnouncements ||
    uploadingMosqueImage
  ) {
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.type)) {
    window.alert(
      "Please select a JPG, PNG, or WebP image."
    );
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    window.alert(
      "The mosque picture must be 5 MB or smaller."
    );
    return;
  }

  setUploadingMosqueImage(true);

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const storagePath =
    `${mosqueId}/profile-${Date.now()}.${extension}`;

  try {
    const { error: uploadError } =
      await supabase.storage
        .from("mosque-images")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } =
      supabase.storage
        .from("mosque-images")
        .getPublicUrl(storagePath);

    const imageUrl = publicUrlData.publicUrl;

    const { data, error: updateError } =
      await supabase
        .from("mosques")
        .update({
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mosqueId)
        .select(
          "id,name,address,city,state,phone,website,image_url,description,verified,prayer_times,claimed_by"
        )
        .single();

    if (updateError) {
      await supabase.storage
        .from("mosque-images")
        .remove([storagePath]);

      throw updateError;
    }

    setMosque(data);
  } catch (error) {
    console.error(
      "Could not update mosque picture:",
      error
    );

    window.alert(
      "The mosque picture could not be updated."
    );
  } finally {
    setUploadingMosqueImage(false);
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
     {t("profile.backToMosques", {
       defaultValue: "Back to Mosques",
     })}
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
  "Nigerian Islamic Association":
    nigerianIslamicAssociationImage,
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
    {t("profile.backToMosques", {
      defaultValue: "Back to Mosques",
    })}
        </Button>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="relative aspect-[16/7] bg-muted">
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

            {canManageAnnouncements && (
              <>
                <input
                  id="mosque-profile-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) =>
                    void handleMosqueImageChange(event)
                  }
                />

                <button
                  type="button"
                  disabled={uploadingMosqueImage}
                  onClick={() =>
                    document
                      .getElementById(
                        "mosque-profile-image-input"
                      )
                      ?.click()
                  }
                  className="absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/70 text-white shadow-xl backdrop-blur-md transition hover:bg-black/85 disabled:opacity-60"
                  aria-label={
                    mosque.image_url
                      ? "Change mosque picture"
                      : "Add mosque picture"
                  }
                  title={
                    mosque.image_url
                      ? "Change mosque picture"
                      : "Add mosque picture"
                  }
                >
                  {uploadingMosqueImage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Pencil className="h-5 w-5" />
                  )}
                </button>
              </>
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
              {t("profile.followers.count", {
                count: mosqueFollowerCount,
                defaultValue: "{{count}} Followers",
              })}
            </p>
                <p className="text-sm text-muted-foreground">
                  {t("profile.followers.description", {
                    defaultValue:
                      "Follow this mosque for announcements and event updates.",
                  })}
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
          ? t("profile.followers.pleaseWait", {
              defaultValue: "Please wait...",
            })
          : isFollowingMosque
            ? t("profile.followers.following", {
                defaultValue: "Following",
              })
            : t("profile.followers.followMosque", {
                defaultValue: "Follow Mosque",
              })}
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
              ? t("profile.followers.notificationsOn", {
                  defaultValue: "Notifications On",
                })
              : t("profile.followers.notificationsOff", {
                  defaultValue: "Notifications Off",
                })}
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
          {t("profile.claim.title", {
            defaultValue: "Claim This Mosque",
          })}
        </h2>

       <p className="mt-1 text-sm text-muted-foreground">
         {t("profile.claim.description", {
           defaultValue:
             "Mosque representatives can request access to manage prayer times, announcements, and profile information.",
         })}
       </p>
      </div>

      {!user ? (
        <Button
          type="button"
          onClick={() => navigate("/auth")}
        >
          {t("profile.claim.signIn", {
            defaultValue: "Sign In to Claim",
          })}
        </Button>
      ) : existingClaimStatus === "pending" ? (
        <span className="rounded-full bg-islamic-gold/15 px-3 py-2 text-sm font-medium text-islamic-gold">
        {t("profile.claim.pending", {
          defaultValue: "Claim Pending Review",
        })}
        </span>
      ) : existingClaimStatus === "approved" ? (
        <span className="rounded-full bg-islamic-green/15 px-3 py-2 text-sm font-medium text-islamic-green">
         {t("profile.claim.approved", {
           defaultValue: "Claim Approved",
         })}
        </span>
      ) : (
        <Button
          type="button"
          onClick={() => setClaimFormOpen((current) => !current)}
        >
       {claimFormOpen
         ? t("profile.claim.closeForm", {
             defaultValue: "Close Claim Form",
           })
         : t("profile.claim.openForm", {
             defaultValue: "Claim This Mosque",
           })}
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
           {t("profile.claim.previousRejected", {
             defaultValue:
               "Your previous claim was not approved. You may submit updated information.",
           })}

            </div>
          )}

          <div>
          <label className="text-sm font-medium">
            {t("profile.claim.fullName", {
              defaultValue: "Full Name",
            })}
          </label>
            <input
              type="text"
              value={claimFullName}
              onChange={(event) =>
                setClaimFullName(event.target.value)
              }
          placeholder={t("profile.claim.fullNamePlaceholder", {
            defaultValue: "Your full name",
          })}
            />
          </div>

          <div>
        <label className="text-sm font-medium">
          {t("profile.claim.role", {
            defaultValue: "Your Role at the Mosque",
          })}
        </label>

            <input
              type="text"
              value={claimRole}
              onChange={(event) =>
                setClaimRole(event.target.value)
              }
            placeholder={t("profile.claim.rolePlaceholder", {
              defaultValue: "Example: Imam, administrator, board member",
            })}
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
            <label className="text-sm font-medium">
              {t("profile.volunteers.email", {
                defaultValue: "Email",
              })}
            </label>

              <input
                type="email"
                value={claimEmail}
                onChange={(event) =>
                  setClaimEmail(event.target.value)
                }
               placeholder={t("profile.claim.emailPlaceholder", {
                 defaultValue: "you@example.com",
               })}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div>
            <label className="text-sm font-medium">
             {t("profile.volunteers.phone", {
               defaultValue: "Phone",
             })}
            </label>

              <input
                type="tel"
                value={claimPhone}
                onChange={(event) =>
                  setClaimPhone(event.target.value)
                }
        placeholder={t("profile.claim.phonePlaceholder", {
          defaultValue: "Phone number",
        })}
                className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
          </div>


          <div>
            <label className="text-sm font-medium">
              {t("profile.claim.proofDetails", {
                defaultValue: "Proof and Verification Details",
              })}
            </label>

            <textarea
              value={claimProofDetails}
              onChange={(event) =>
                setClaimProofDetails(event.target.value)
              }
              placeholder={t("profile.claim.proofPlaceholder", {
                defaultValue:
                  "Explain your relationship to the mosque and how the admin can verify your role.",
              })}
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
            !claimPhone.trim() ||
            !claimProofDetails.trim()
            }
            className="w-full"
          >
            {submittingClaim
              ? t("profile.claim.submitting", {
                  defaultValue: "Submitting Claim...",
                })
              : t("profile.claim.submit", {
                  defaultValue: "Submit Claim for Review",
                })}
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
       {t("profile.management.title", {
         defaultValue: "Mosque Profile Management",
       })}
     </h2>

     <p className="mt-1 text-sm text-muted-foreground">
       {t("profile.management.description", {
         defaultValue: "Update this mosque’s public information.",
       })}
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
          ? t("profile.management.closeEditForm", {
              defaultValue: "Close Edit Form",
            })
          : t("profile.management.editProfile", {
              defaultValue: "Edit Mosque Profile",
            })}
      </Button>
    </div>

    {editingMosqueProfile && (
      <div className="mt-5 space-y-4 border-t pt-5">
        <div>
        <label className="text-sm font-medium">
          {t("profile.management.mosqueName", {
            defaultValue: "Mosque Name",
          })}
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
               {t("profile.management.address", {
                 defaultValue: "Address",
               })}
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
          {t("profile.management.city", {
            defaultValue: "City",
          })}
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
              {t("profile.management.state", {
                defaultValue: "State",
              })}
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
             {t("profile.management.phone", {
               defaultValue: "Phone",
             })}
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
            {t("profile.management.website", {
              defaultValue: "Website",
            })}
          </label>

            <input
              type="url"
              value={editMosqueWebsite}
              onChange={(event) =>
                setEditMosqueWebsite(event.target.value)
              }
            placeholder={t("profile.management.websitePlaceholder", {
              defaultValue: "https://example.org",
            })}
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div>
         <label className="text-sm font-medium">
           {t("profile.management.descriptionLabel", {
             defaultValue: "Description",
           })}
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
           ? t("profile.management.saving", {
               defaultValue: "Saving Profile...",
             })
           : t("profile.management.save", {
               defaultValue: "Save Mosque Profile",
             })}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setEditingMosqueProfile(false)}
            disabled={savingMosqueProfile}
            className="flex-1"
          >
       {t("profile.volunteers.cancel", {
         defaultValue: "Cancel",
       })}
          </Button>
        </div>
      </div>
    )}
  </section>
)}

<section>
  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<h2 className="text-xl font-semibold">
  {t("profile.prayerTimes.title", {
    defaultValue: "Prayer Times",
  })}
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
         ? t("profile.prayerTimes.closeForm", {
             defaultValue: "Close Prayer Form",
           })
         : t("profile.prayerTimes.edit", {
             defaultValue: "Edit Prayer Times",
           })}
      </Button>
    )}
  </div>
  {canManageAnnouncements && editingPrayerTimes && (
    <div className="mb-5 space-y-4 rounded-2xl border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t("profile.prayerTimes.fajr", {
              defaultValue: "Fajr",
            })}
          </label>
          <input
            type="text"
            value={editFajr}
            onChange={(event) => setEditFajr(event.target.value)}
         placeholder={t("profile.prayerTimes.fajrPlaceholder", {
           defaultValue: "Example: 5:30 AM",
         })}
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

  <div>
    <label className="text-sm font-medium">
      {t("profile.prayerTimes.dhuhr", {
        defaultValue: "Dhuhr",
      })}
    </label>

    <input
      type="text"
      value={editDhuhr}
      onChange={(event) => setEditDhuhr(event.target.value)}
      placeholder={t("profile.prayerTimes.dhuhrPlaceholder", {
        defaultValue: "Example: 1:00 PM",
      })}
      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
    />
  </div>

 <div>
   <label className="text-sm font-medium">
     {t("profile.prayerTimes.asr", {
       defaultValue: "Asr",
     })}
   </label>

   <input
     type="text"
     value={editAsr}
     onChange={(event) => setEditAsr(event.target.value)}
     placeholder={t("profile.prayerTimes.asrPlaceholder", {
       defaultValue: "Example: 5:00 PM",
     })}
     className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
   />
 </div>

 <div>
   <label className="text-sm font-medium">
     {t("profile.prayerTimes.maghrib", {
       defaultValue: "Maghrib",
     })}
   </label>

   <input
     type="text"
     value={editMaghrib}
     onChange={(event) => setEditMaghrib(event.target.value)}
     placeholder={t("profile.prayerTimes.maghribPlaceholder", {
       defaultValue: "Example: 8:15 PM",
     })}
     className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
   />
 </div>

 <div>
   <label className="text-sm font-medium">
     {t("profile.prayerTimes.isha", {
       defaultValue: "Isha",
     })}
   </label>

   <input
     type="text"
     value={editIsha}
     onChange={(event) => setEditIsha(event.target.value)}
     placeholder={t("profile.prayerTimes.ishaPlaceholder", {
       defaultValue: "Example: 9:45 PM",
     })}
     className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
   />
 </div>

 <div>
   <label className="text-sm font-medium">
     {t("profile.prayerTimes.jummah", {
       defaultValue: "Jummah",
     })}
   </label>

   <input
     type="text"
     value={editJummah}
     onChange={(event) => setEditJummah(event.target.value)}
     placeholder={t("profile.prayerTimes.jummahPlaceholder", {
       defaultValue: "Example: 1:00 PM Khutbah, 1:30 PM Salah",
     })}
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
       ? t("profile.prayerTimes.saving", {
           defaultValue: "Saving Prayer Times...",
         })
       : t("profile.prayerTimes.save", {
           defaultValue: "Save Prayer Times",
         })}
   </Button>

   <Button
     type="button"
     variant="outline"
     onClick={() => setEditingPrayerTimes(false)}
     disabled={savingPrayerTimes}
     className="flex-1"
   >
     {t("profile.prayerTimes.cancel", {
       defaultValue: "Cancel",
     })}
   </Button>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
   {[
     [
       t("profile.prayerTimes.fajr", {
         defaultValue: "Fajr",
       }),
       mosque.prayer_times?.fajr,
     ],
     [
       t("profile.prayerTimes.dhuhr", {
         defaultValue: "Dhuhr",
       }),
       mosque.prayer_times?.dhuhr,
     ],
     [
       t("profile.prayerTimes.asr", {
         defaultValue: "Asr",
       }),
       mosque.prayer_times?.asr,
     ],
     [
       t("profile.prayerTimes.maghrib", {
         defaultValue: "Maghrib",
       }),
       mosque.prayer_times?.maghrib,
     ],
     [
       t("profile.prayerTimes.isha", {
         defaultValue: "Isha",
       }),
       mosque.prayer_times?.isha,
     ],
     [
       t("profile.prayerTimes.jummah", {
         defaultValue: "Jummah",
       }),
       mosque.prayer_times?.jummah,
     ],
   ].map(([label, time]) => (
     <div
       key={label}
       className="rounded-xl border bg-muted/20 p-4 text-center"
     >
       <p className="text-sm text-muted-foreground">
         {label}
       </p>

       <p className="mt-1 font-semibold">
         {time ||
           t("profile.prayerTimes.notProvided", {
             defaultValue: "Not provided",
           })}
       </p>
     </div>
   ))}
 </div>
  </section>
  <section className="rounded-2xl border bg-card p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
     <h2 className="text-xl font-semibold">
       {t("profile.events.title", {
         defaultValue: "Mosque Events",
       })}
     </h2>

     <p className="mt-1 text-sm text-muted-foreground">
       {t("profile.events.description", {
         defaultValue: "Upcoming programs and community activities.",
       })}
     </p>
      </div>

      {canManageAnnouncements && (
        <Button
          type="button"
          onClick={() => setEventFormOpen((current) => !current)}
          variant={eventFormOpen ? "outline" : "default"}
        >
      {eventFormOpen
        ? t("profile.events.closeForm", {
            defaultValue: "Close Event Form",
          })
        : t("profile.events.openForm", {
            defaultValue: "Create Mosque Event",
          })}
        </Button>
      )}
    </div>

    {canManageAnnouncements && eventFormOpen && (
      <div className="mt-5 space-y-4 border-t pt-5">

<div>
  <label className="text-sm font-medium">
    {t("profile.events.eventTitle", {
      defaultValue: "Event Title",
    })}
  </label>

  <input
    type="text"
    value={eventTitle}
    onChange={(event) => setEventTitle(event.target.value)}
    placeholder={t("profile.events.eventTitlePlaceholder", {
      defaultValue: "Enter event title",
    })}
    className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
  />
</div>

<div>
  <label className="text-sm font-medium">
    {t("profile.events.descriptionLabel", {
      defaultValue: "Description",
    })}
  </label>

  <textarea
    value={eventDescription}
    onChange={(event) => setEventDescription(event.target.value)}
    placeholder={t("profile.events.descriptionPlaceholder", {
      defaultValue: "Describe the event",
    })}
    className="mt-2 min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
  />
</div>

<div className="grid gap-4 sm:grid-cols-2">
  <div>
    <label className="text-sm font-medium">
      {t("profile.events.date", {
        defaultValue: "Date",
      })}
    </label>

    <input
      type="date"
      value={eventDate}
      onChange={(event) => setEventDate(event.target.value)}
      min={new Date().toISOString().split("T")[0]}
      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
    />
  </div>

  <div>
    <label className="text-sm font-medium">
      {t("profile.events.time", {
        defaultValue: "Time",
      })}
    </label>

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
    <label className="text-sm font-medium">
      {t("profile.events.location", {
        defaultValue: "Location",
      })}
    </label>

    <input
      type="text"
      value={eventLocation}
      onChange={(event) => setEventLocation(event.target.value)}
      placeholder={t("profile.events.locationPlaceholder", {
        defaultValue: "Main prayer hall",
      })}
      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
    />
  </div>

  <div>
    <label className="text-sm font-medium">
      {t("profile.events.category", {
        defaultValue: "Category",
      })}
    </label>

    <select
      value={eventCategory}
      onChange={(event) => setEventCategory(event.target.value)}
      className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
    >
      <option value="religious">
        {t("profile.events.categories.religious", {
          defaultValue: "Religious",
        })}
      </option>

      <option value="educational">
        {t("profile.events.categories.educational", {
          defaultValue: "Educational",
        })}
      </option>

      <option value="cultural">
        {t("profile.events.categories.cultural", {
          defaultValue: "Cultural",
        })}
      </option>

      <option value="social">
        {t("profile.events.categories.social", {
          defaultValue: "Social",
        })}
      </option>

      <option value="general">
        {t("profile.events.categories.general", {
          defaultValue: "General",
        })}
      </option>
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
  {savingMosqueEvent
    ? t("profile.events.creating", {
        defaultValue: "Creating Event...",
      })
    : t("profile.events.create", {
        defaultValue: "Create Event",
      })}
</Button>
      </div>
    )}

    <div className="mt-5 space-y-3">
      {mosqueEvents.length === 0 ? (
        <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          {t("profile.events.empty", {
            defaultValue: "No upcoming mosque events.",
          })}
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
              {t("profile.events.eventTitle", {
                defaultValue: "Event Title",
              })}
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
         {t("profile.events.descriptionLabel", {
           defaultValue: "Description",
         })}
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
               {t("profile.events.date", {
                 defaultValue: "Date",
               })}
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
                 {t("profile.events.time", {
                   defaultValue: "Time",
                 })}
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
                {t("profile.events.location", {
                  defaultValue: "Location",
                })}
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
                {t("profile.events.category", {
                  defaultValue: "Category",
                })}
              </label>

               <select
                 onChange={(changeEvent) =>
                   setEditingEventCategory(changeEvent.target.value)
                 }
                 className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
               >
                <option value="community">
                  {t("profile.events.categories.community", {
                    defaultValue: "Community",
                  })}
                </option>

                <option value="lecture">
                  {t("profile.events.categories.lecture", {
                    defaultValue: "Lecture",
                  })}
                </option>

                <option value="education">
                  {t("profile.events.categories.education", {
                    defaultValue: "Education",
                  })}
                </option>

                <option value="youth">
                  {t("profile.events.categories.youth", {
                    defaultValue: "Youth",
                  })}
                </option>

                <option value="sisters">
                  {t("profile.events.categories.sisters", {
                    defaultValue: "Sisters",
                  })}
                </option>

                <option value="fundraiser">
                  {t("profile.events.categories.fundraiser", {
                    defaultValue: "Fundraiser",
                  })}
                </option>

                <option value="jummah">
                  {t("profile.events.categories.jummah", {
                    defaultValue: "Jummah",
                  })}
                </option>
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
               {updatingMosqueEvent
                 ? t("profile.events.saving", {
                     defaultValue: "Saving Event...",
                   })
                 : t("profile.events.save", {
                     defaultValue: "Save Event",
                   })}
             </Button>

             <Button
               type="button"
               variant="outline"
               onClick={() => setEditingMosqueEventId(null)}
               disabled={updatingMosqueEvent}
               className="flex-1"
             >
               {t("profile.events.cancel", {
                 defaultValue: "Cancel",
               })}
             </Button>
           </div>
         </div>
       ) : (
         <>
           <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
             <div>
               <h3 className="font-semibold">
       {event.title ||
         t("profile.events.fallbackTitle", {
           defaultValue: "Mosque Event",
         })}
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
                   {t("profile.events.edit", {
                     defaultValue: "Edit",
                   })}
                   </Button>

                   <Button
                     type="button"
                     size="sm"
                     variant="destructive"
                     onClick={() =>
                       void handleDeleteMosqueEvent(event.id)
                     }
                   >
                 {t("profile.announcements.delete", {
                   defaultValue: "Delete",
                 })}
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
              {t("profile.events.locationValue", {
                location: event.location,
                defaultValue: "Location: {{location}}",
              })}
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
     <h2 className="text-xl font-semibold">
       {t("profile.livestreams.title", {
         defaultValue: "Mosque Livestreams",
       })}
     </h2>

     <p className="mt-1 text-sm text-muted-foreground">
       {t("profile.livestreams.description", {
         defaultValue:
           "Watch live broadcasts and view upcoming mosque programs.",
       })}
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
             ? t("profile.livestreams.closeForm", {
                 defaultValue: "Close Livestream Form",
               })
             : t("profile.livestreams.openForm", {
                 defaultValue: "Create Livestream",
               })}
          </Button>
        )}
      </div>

      {canManageAnnouncements && livestreamFormOpen && (
        <div className="mt-5 space-y-4 border-t pt-5">

        <div className="rounded-xl border border-islamic-gold/30 bg-islamic-gold/10 p-3 text-sm text-muted-foreground">
          Tariq Islam will review this request and may contact you by phone or email
          to verify your relationship with the mosque. Access is not granted until
          the claim is approved.
        </div>

      <div>
        <label className="text-sm font-medium">
          {t("profile.livestreams.livestreamTitle", {
            defaultValue: "Livestream Title",
          })}
        </label>

        <input
          type="text"
          value={livestreamTitle}
          onChange={(event) =>
            setLivestreamTitle(event.target.value)
          }
          placeholder={t(
            "profile.livestreams.titlePlaceholder",
            {
              defaultValue: "Example: Friday Jummah Khutbah",
            }
          )}
          className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
        />
      </div>

       <div>
         <label className="text-sm font-medium">
           {t("profile.livestreams.descriptionLabel", {
             defaultValue: "Description",
           })}
         </label>

         <textarea
           value={livestreamDescription}
           onChange={(event) =>
             setLivestreamDescription(event.target.value)
           }
           placeholder={t(
             "profile.livestreams.descriptionPlaceholder",
             {
               defaultValue: "Describe the livestream",
             }
           )}
           className="mt-2 min-h-[110px] w-full rounded-md border bg-background p-3 text-sm"
         />
       </div>

      <div>
        <label className="text-sm font-medium">
          {t("profile.livestreams.streamUrl", {
            defaultValue: "Stream URL",
          })}
        </label>

        <input
          type="url"
          value={livestreamUrl}
          onChange={(event) =>
            setLivestreamUrl(event.target.value)
          }
          placeholder={t("profile.livestreams.urlPlaceholder", {
            defaultValue: "https://youtube.com/live/...",
          })}
          className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
        />
      </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">
              {t("profile.livestreams.status", {
                defaultValue: "Status",
              })}
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
              <option value="upcoming">
                {t("profile.livestreams.statuses.upcoming", {
                  defaultValue: "Upcoming",
                })}
              </option>

              <option value="live">
                {t("profile.livestreams.statuses.live", {
                  defaultValue: "Live",
                })}
              </option>

              <option value="ended">
                {t("profile.livestreams.statuses.ended", {
                  defaultValue: "Ended",
                })}
              </option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              {t("profile.livestreams.date", {
                defaultValue: "Date",
              })}
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
              {t("profile.livestreams.time", {
                defaultValue: "Time",
              })}
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
             {t("profile.livestreams.scheduleRequired", {
               defaultValue:
                 "Upcoming livestreams require a date and time.",
             })}
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
              ? t("profile.livestreams.creating", {
                  defaultValue: "Creating Livestream...",
                })
              : t("profile.livestreams.create", {
                  defaultValue: "Create Livestream",
                })}
          </Button>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {mosqueLivestreams.length === 0 ? (
          <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
           {t("profile.livestreams.empty", {
             defaultValue:
               "No mosque livestreams are currently available.",
           })}
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
                       ? t("profile.livestreams.badges.liveNow", {
                           defaultValue: "LIVE NOW",
                         })
                       : livestream.status === "upcoming"
                         ? t("profile.livestreams.badges.upcoming", {
                             defaultValue: "UPCOMING",
                           })
                         : t("profile.livestreams.badges.ended", {
                             defaultValue: "ENDED",
                           })}
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
                         ? t("profile.livestreams.watchLive", {
                             defaultValue: "Watch Live",
                           })
                         : livestream.status === "upcoming"
                           ? t("profile.livestreams.viewStream", {
                               defaultValue: "View Stream",
                             })
                           : t("profile.livestreams.watchRecording", {
                               defaultValue: "Watch Recording",
                             })}
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
                         {t("profile.livestreams.goLive", {
                           defaultValue: "Go Live",
                         })}
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
                           {t("profile.livestreams.end", {
                             defaultValue: "End",
                           })}
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
                       {t("profile.livestreams.delete", {
                         defaultValue: "Delete",
                       })}
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
     {t("profile.volunteers.title", {
       defaultValue: "Volunteer Opportunities",
     })}
   </h2>

   <p className="mt-1 text-sm text-muted-foreground">
     {t("profile.volunteers.description", {
       defaultValue:
         "Help the mosque with upcoming programs and community activities.",
     })}
   </p>
      </div>

      {canManageAnnouncements && (
        <Button
          type="button"
          onClick={() => setVolunteerFormOpen((current) => !current)}
          variant={volunteerFormOpen ? "outline" : "default"}
        >
         {volunteerFormOpen
           ? t("profile.volunteers.closeForm", {
               defaultValue: "Close Volunteer Form",
             })
           : t("profile.volunteers.openForm", {
               defaultValue: "Create Opportunity",
             })}
        </Button>
      )}
    </div>

    {canManageAnnouncements && volunteerFormOpen && (
      <div className="mt-5 space-y-4 border-t pt-5">

      <div>
        <label className="text-sm font-medium">
          {t("profile.volunteers.opportunityTitle", {
            defaultValue: "Opportunity Title",
          })}
        </label>

        <input
          type="text"
          value={volunteerTitle}
          onChange={(event) => setVolunteerTitle(event.target.value)}
          placeholder={t("profile.volunteers.titlePlaceholder", {
            defaultValue: "Example: Ramadan food distribution",
          })}
          className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          {t("profile.volunteers.descriptionLabel", {
            defaultValue: "Description",
          })}
        </label>

        <textarea
          value={volunteerDescription}
          onChange={(event) =>
            setVolunteerDescription(event.target.value)
          }
          placeholder={t("profile.volunteers.descriptionPlaceholder", {
            defaultValue:
              "Describe the work volunteers will help with",
          })}
          className="mt-2 min-h-[120px] w-full rounded-md border bg-background p-3 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t("profile.volunteers.date", {
              defaultValue: "Volunteer Date",
            })}
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
            {t("profile.volunteers.needed", {
              defaultValue: "Volunteers Needed",
            })}
          </label>

          <input
            type="number"
            min="1"
            value={volunteersNeeded}
            onChange={(event) =>
              setVolunteersNeeded(event.target.value)
            }
       placeholder={t("profile.volunteers.optional", {
         defaultValue: "Optional",
       })}
       className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
       />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">
            {t("profile.volunteers.startTime", {
              defaultValue: "Start Time",
            })}
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
            {t("profile.volunteers.endTime", {
              defaultValue: "End Time",
            })}
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
          {t("profile.volunteers.location", {
            defaultValue: "Location",
          })}
        </label>

        <input
          type="text"
          value={volunteerLocation}
          onChange={(event) =>
            setVolunteerLocation(event.target.value)
          }
          placeholder={t("profile.volunteers.locationPlaceholder", {
            defaultValue: "Example: Mosque community hall",
          })}
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
           ? t("profile.volunteers.creating", {
               defaultValue: "Creating Opportunity...",
             })
           : t("profile.volunteers.create", {
               defaultValue: "Create Volunteer Opportunity",
             })}

        </Button>
      </div>
    )}

    <div className="mt-5 space-y-4">
      {volunteerOpportunities.length === 0 ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        {t("profile.volunteers.empty", {
          defaultValue:
            "No volunteer opportunities are currently available.",
        })}
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
                  {isFull
                    ? t("profile.volunteers.full", {
                        defaultValue: "Full",
                      })
                    : t("profile.volunteers.open", {
                        defaultValue: "Open",
                      })}
                    </span>

                    {isSignedUp && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700">
                        {t("profile.volunteers.signedUp", {
                          defaultValue: "You are signed up",
                        })}
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
                  {t("profile.volunteers.timeValue", {
                    time: opportunity.start_time
                      ? new Date(
                          `${opportunity.volunteer_date}T${opportunity.start_time}`
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : t("profile.volunteers.notProvided", {
                          defaultValue: "Not provided",
                        }),
                    defaultValue: "Time: {{time}}",
                  })}

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
    {t("profile.volunteers.locationValue", {
      location: opportunity.location,
      defaultValue: "Location: {{location}}",
    })}
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
                 {t("profile.volunteers.cancelSignup", {
                   defaultValue: "Cancel Signup",
                 })}
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
                  {isFull
                    ? t("profile.volunteers.opportunityFull", {
                        defaultValue: "Opportunity Full",
                      })
                    : t("profile.volunteers.signUp", {
                        defaultValue: "Sign Up",
                      })}
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
                         ? t("profile.volunteers.hideVolunteers", {
                             defaultValue: "Hide Volunteers",
                           })
                         : t("profile.volunteers.viewVolunteers", {
                             count: signupCount,
                             defaultValue: "View Volunteers ({{count}})",
                           })}
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
                 ? t("profile.volunteers.countOfNeeded", {
                     count: signupCount,
                     needed: opportunity.volunteers_needed,
                     defaultValue: "{{count}} of {{needed}} volunteers",
                   })
                 : t("profile.volunteers.signupCount", {
                     count: signupCount,
                     defaultValue: "{{count}} volunteers signed up",
                   })}
             </span>

                  {opportunity.volunteers_needed !== null && (
              <span className="text-muted-foreground">
                {t("profile.volunteers.spotsRemaining", {
                  count: Math.max(
                    0,
                    opportunity.volunteers_needed - signupCount
                  ),
                  defaultValue: "{{count}} spots remaining",
                })}
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
                 {t("profile.volunteers.signupTitle", {
                   defaultValue: "Volunteer Signup",
                 })}
                  </h4>

                  <div>
                    <label className="text-sm font-medium">
           {t("profile.volunteers.fullName", {
             defaultValue: "Full Name",
           })}
                    </label>

                    <input
                      type="text"
                      value={volunteerFullName}
                      onChange={(event) =>
                        setVolunteerFullName(event.target.value)
                      }
               placeholder={t("profile.volunteers.fullNamePlaceholder", {
                 defaultValue: "Enter your full name",
               })}
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
                        placeholder={t("profile.volunteers.optional", {
                          defaultValue: "Optional",
                        })}
                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      />
                    </div>

                    <div>
                    <label className="text-sm font-medium">
                      {t("profile.volunteers.email", {
                        defaultValue: "Email",
                      })}
                    </label>

                      <input
                        type="email"
                        value={volunteerEmail}
                        onChange={(event) =>
                          setVolunteerEmail(event.target.value)
                        }
                   placeholder={t("profile.volunteers.optional", {
                     defaultValue: "Optional",
                   })}
                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
               {t("profile.volunteers.messageToMosque", {
                 defaultValue: "Message to the Mosque",
               })}
                    </label>

                    <textarea
                      value={volunteerNotes}
                      onChange={(event) =>
                        setVolunteerNotes(event.target.value)
                      }
      placeholder={t("profile.volunteers.notesPlaceholder", {
        defaultValue: "Add any helpful details or availability",
      })}
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
                       ? t("profile.volunteers.submittingSignup", {
                           defaultValue: "Submitting Signup...",
                         })
                       : t("profile.volunteers.confirmSignup", {
                           defaultValue: "Confirm Volunteer Signup",
                         })}
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
                    {t("profile.volunteers.cancel", {
                      defaultValue: "Cancel",
                    })}
                    </Button>
                  </div>
                </div>
              )}

              {canManageAnnouncements && volunteerListOpen && (
                <div className="mt-5 border-t pt-5">
                  <h4 className="font-semibold">
                {t("profile.volunteers.registeredTitle", {
                  defaultValue: "Registered Volunteers",
                })}
                  </h4>

                  {loadingVolunteerSignups ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                    {t("profile.volunteers.loading", {
                      defaultValue: "Loading volunteers...",
                    })}
                    </p>
                  ) : volunteerSignups.length === 0 ? (
                    <p className="mt-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                 {t("profile.volunteers.noSignups", {
                   defaultValue: "No volunteers have signed up yet.",
                 })}
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
                         t("profile.volunteers.defaultMemberName", {
                           defaultValue: "Tariq Islam Member",
                         })}
                              </p>

                              {signup.email && (
                                <p className="mt-1 text-sm text-muted-foreground">
                     {t("profile.volunteers.emailValue", {
                       email: signup.email,
                       defaultValue: "Email: {{email}}",
                     })}
                                </p>
                              )}

                              {signup.phone && (
                                <p className="mt-1 text-sm text-muted-foreground">
                {t("profile.volunteers.phoneValue", {
                  phone: signup.phone,
                  defaultValue: "Phone: {{phone}}",
                })}
                                </p>
                              )}
                            </div>

                            <span className="w-fit rounded-full bg-islamic-green/10 px-2 py-1 text-xs font-medium text-islamic-green">
                              {signup.status === "attended"
                                ? t("profile.volunteers.attended", {
                                    defaultValue: "Attended",
                                  })
                                : t("profile.volunteers.signedUpStatus", {
                                    defaultValue: "Signed Up",
                                  })}
                            </span>
                          </div>

                          {signup.notes && (
                            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                              {signup.notes}
                            </p>
                          )}

                    <p className="mt-3 text-xs text-muted-foreground">
                      {t("profile.volunteers.signedUpOn", {
                        date: new Date(signup.created_at).toLocaleDateString(),
                        defaultValue: "Signed up {{date}}",
                      })}
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
   <h2 className="text-xl font-semibold">
     {t("profile.announcements.title", {
       defaultValue: "Announcements",
     })}
   </h2>

    {canManageAnnouncements && (
      <div className="mb-4 space-y-3 rounded-xl border bg-muted/20 p-4">
        <div>
          <label className="text-sm font-medium">
            {t("profile.announcements.titleLabel", {
              defaultValue: "Announcement Title",
            })}
          </label>

          <input
            type="text"
            value={announcementTitle}
            onChange={(event) =>
              setAnnouncementTitle(event.target.value)
            }
          placeholder={t("profile.announcements.titlePlaceholder", {
            defaultValue: "Enter announcement title",
          })}
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            {t("profile.announcements.messageLabel", {
              defaultValue: "Announcement Message",
            })}
          </label>

          <textarea
            value={announcementMessage}
            onChange={(event) =>
              setAnnouncementMessage(event.target.value)
            }
        placeholder={t("profile.announcements.messagePlaceholder", {
          defaultValue: "Write the mosque announcement",
        })}
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

      {t("profile.announcements.pinThis", {
        defaultValue: "Pin this announcement",
      })}
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
            ? t("profile.announcements.publishing", {
                defaultValue: "Publishing Announcement...",
              })
            : t("profile.announcements.publish", {
                defaultValue: "Publish Announcement",
              })}
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
   {t("profile.announcements.empty", {
     defaultValue: "No announcements have been posted yet.",
   })}
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
            {updatingAnnouncement
              ? t("profile.announcements.saving", {
                  defaultValue: "Saving...",
                })
              : t("profile.announcements.save", {
                  defaultValue: "Save",
                })}
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
        {t("profile.announcements.cancel", {
          defaultValue: "Cancel",
        })}
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
                 {t("profile.announcements.pinned", {
                   defaultValue: "Pinned",
                 })}
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
              {announcement.is_pinned
                ? t("profile.announcements.unpin", {
                    defaultValue: "Unpin",
                  })
                : t("profile.announcements.pin", {
                    defaultValue: "Pin",
                  })}
                   </Button>

                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     onClick={() =>
                       handleStartEditingAnnouncement(announcement)
                     }
                   >
                    {t("profile.announcements.edit", {
                      defaultValue: "Edit",
                    })}
                   </Button>

                   <Button
                     type="button"
                     size="sm"
                     variant="destructive"
                     onClick={() =>
                       void handleDeleteAnnouncement(announcement.id)
                     }
                   >
               {t("profile.announcements.delete", {
                 defaultValue: "Delete",
               })}
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

       <div className="rounded-xl border bg-muted/20 p-4">
         <h3 className="font-semibold">
           {t("profile.support.title", {
             defaultValue: "Support This Mosque",
           })}
         </h3>

         <p className="mt-1 text-sm text-muted-foreground">
           {t("profile.support.description", {
             defaultValue:
               "Donations are handled directly by the mosque. Visit the mosque’s official website to donate.",
           })}
         </p>
       </div>

       {mosque.website && (
         <button
           type="button"
           onClick={() =>
             void openInAppLink(mosque.website!)
           }
           className="flex items-center gap-3 rounded-xl border p-4 text-left hover:bg-muted/50"
         >
           <Globe2 className="h-5 w-5" />

           <span>
             {t("profile.support.visitWebsite", {
               defaultValue: "Visit Website",
             })}
           </span>
         </button>
       )}
       </section>
       </div>
       </div>
       </div>
       </main>
       );
       };

       export default MosqueProfile;