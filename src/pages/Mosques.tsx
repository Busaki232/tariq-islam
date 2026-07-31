// src/pages/Mosques.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroButton } from "@/components/ui/hero-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { openInAppLink } from "@/utils/openInAppLink";
import brooklynIslamicCenterImage from "@/assets/brooklyn-islamic-center.png";
import ciogcChicagoImage from "@/assets/ciogc-chicago.jpeg";
import islamicSocietySouthTexasImage from "@/assets/islamic-society-south-texas.png";

import {
  Star,
  MapPin,
  Clock,
  Phone,
  Globe,
  Search,
  Users,
  Calendar,
  Book,
  Navigation,
  LocateFixed,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import MosqueDetailModal from "@/components/MosqueDetailModal";
import PrayerTimeUpdateModal from "@/components/PrayerTimeUpdateModal";

import islamicAssociationChicagoImage from "@/assets/nigerian-islamic-association-chicago.png";
import muslimCenterDetroitImage from "@/assets/muslim-center-detroit-exterior.png";
import islamicCenterMinnesotaImage from "@/assets/islamic-center-minnesota.png";
import masjidAlHikmahClevelandImage from "@/assets/masjid-al-hikmah-cleveland.png";
import islamicSocietyGreaterMilwaukeeImage from "@/assets/islamic-society-greater-milwaukee.png";
import islamicSocietyMidwestImage from "@/assets/islamic-society-midwest.png";

import muslimCommunityCenterChicagoImage from "@/assets/muslim-community-center-chicago.png";
import islamicCenterChicagoImage from "@/assets/islamic-center-chicago.png";

type Mosque = {
id: string | number;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string;
  website: string;
  image: string;
  featured: boolean;
  rating: number;
  reviews: number;
  diverseCommunity: boolean;
  languages: string[];
  services: string[];
  prayerTimes: {
    fajr: string;
    dhuhr: string;
    asr: string;
    maghrib: string;
    isha: string;
    jummah: string;
  };
  imam: string;
  description: string;
};

type MosqueWithDistance = Mosque & {
  distance: number | null;
};

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Mosques() {
  const { t, i18n } = useTranslation("mosques");
  const lang = (i18n.resolvedLanguage || i18n.language || "en").toLowerCase();
  const isRtl = lang.startsWith("ar");

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlLat = Number(searchParams.get("lat"));
  const urlLng = Number(searchParams.get("lng"));
  const hasUserLocation = Number.isFinite(urlLat) && Number.isFinite(urlLng);

  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrayerTimeUpdateOpen, setIsPrayerTimeUpdateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "near" | "illinois" | "us" | "all"
  >(hasUserLocation ? "near" : "all");
 const [databaseMosques, setDatabaseMosques] = useState<Mosque[]>([]);

 useEffect(() => {
   const loadVerifiedMosques = async () => {
     const { data, error } = await supabase
       .from("mosques")
       .select(
         "id,name,address,city,state,phone,website,image_url,verified,rating_average,review_count,languages,services,prayer_times,imam_name,description"
       )
       .eq("verified", true)
       .order("created_at", { ascending: false });

     if (error) {
       console.error("Unable to load verified mosques:", error);
       return;
     }

     const mappedMosques: Mosque[] = (data ?? []).map((mosque) => {
       const prayerTimes =
         mosque.prayer_times &&
         typeof mosque.prayer_times === "object" &&
         !Array.isArray(mosque.prayer_times)
           ? (mosque.prayer_times as Record<string, unknown>)
           : {};

       return {
         id: mosque.id,
         name: mosque.name,
         address: mosque.address,
         city: mosque.city,
         state: mosque.state,
         latitude: Number.NaN,
         longitude: Number.NaN,
         phone: mosque.phone ?? "",
         website: mosque.website ?? "",
   image:
     mosque.image_url ||
     (mosque.website?.includes("ciogc.org")
       ? ciogcChicagoImage
       : mosque.website?.includes("icconline.org")
         ? islamicCenterChicagoImage
         : mosque.website?.includes("mccchicago.org")
           ? muslimCommunityCenterChicagoImage
           : mosque.name === "Islamic Society of South Texas (ISST)"
             ? islamicSocietySouthTexasImage
             : islamicAssociationChicagoImage),
         featured: mosque.verified === true,
         rating: Number(mosque.rating_average ?? 0),
         reviews: Number(mosque.review_count ?? 0),
         diverseCommunity: (mosque.languages?.length ?? 0) >= 3,
         languages: mosque.languages ?? [],
         services: mosque.services ?? [],
         prayerTimes: {
           fajr: String(prayerTimes.fajr ?? "Not provided"),
           dhuhr: String(prayerTimes.dhuhr ?? "Not provided"),
           asr: String(prayerTimes.asr ?? "Not provided"),
           maghrib: String(prayerTimes.maghrib ?? "Not provided"),
           isha: String(prayerTimes.isha ?? "Not provided"),
           jummah: String(prayerTimes.jummah ?? "Not provided"),
         },
         imam: mosque.imam_name || "Not provided",
         description:
           mosque.description || "Verified mosque and Islamic center.",
       };
     });

     setDatabaseMosques(mappedMosques);
   };

   void loadVerifiedMosques();
 }, []);


const staticMosques: Mosque[] = [
    {
      id: "e3c40772-382a-48e9-9536-fe8417956188",
      name: "Nigerian Islamic Association",
      address: "932 W Sheridan RD, Chicago, Illinois 60613",
      city: "Chicago",
      state: "IL",
      latitude: 41.9521,
      longitude: -87.6547,
      phone: "(773)665-2451",
      website: "https://nigeriaislamicassociation.org",
      image: islamicAssociationChicagoImage,
      featured: true,
      rating: 4.9,
      reviews: 187,
      diverseCommunity: true,
      languages: ["English", "Yoruba"],
      services: [
        "Jummah Prayers",
        "Multicultural Community",
        "Youth Programs",
        "Sister Circles",
        "Islamic Education",
        "Community Outreach",
      ],
      prayerTimes: {
        fajr: "5:30 AM",
        dhuhr: "12:45 PM",
        asr: "3:30 PM",
        maghrib: "6:15 PM",
        isha: "8:00 PM",
        jummah: "1:00 PM",
      },
      imam: "Call for Details",
      description:
        "Premier Islamic center serving the Chicago area with weekly Friday prayers featuring sermons in multiple languages including English, Hausa, and Yoruba. Active youth programs, sister circles, and community outreach programs.",
    },
  {
    id: "f9729b08-53e7-47e4-971a-07230c51b6db",
    name: "Islamic Society of Midwest",
      address: "501 Midway Dr, Mt Prospect, IL 60056",
      city: "Mt Prospect",
      state: "IL",
      latitude: 42.0481,
      longitude: -87.9374,
      phone: "(847) 640-7272",
      website: "https://www.islamicsom.org",
      image: islamicSocietyMidwestImage,
      featured: true,
      rating: 4.8,
      reviews: 124,
      diverseCommunity: true,
      languages: ["English", "Arabic", "Urdu", "Bengali"],
      services: [
        "Friday Prayers",
        "Multicultural Community",
        "Youth Programs",
        "Islamic Education",
        "Cultural Events",
        "Community Outreach",
      ],
      prayerTimes: {
        fajr: "5:30 AM",
        dhuhr: "12:50 PM",
        asr: "3:35 PM",
        maghrib: "6:20 PM",
        isha: "8:05 PM",
        jummah: "1:15 PM",
      },
      imam: "Call for Details",
      description:
        "Beautiful Islamic center serving the local Muslim community. Offers comprehensive programs for families, youth development, and cultural preservation.",
    },
  {
    id: "83a09926-b10c-4a50-8d96-fc157b32f6c6",
    name: "Islamic Center of Detroit",
      address: "14350 Tireman, Detroit, MI 48228",
      city: "Detroit",
      state: "MI",
      latitude: 42.3519,
      longitude: -83.1849,
      phone: "(313) 584-4143",
      website: "https://www.icdonline.org",
      image: muslimCenterDetroitImage,
      featured: true,
      rating: 4.7,
      reviews: 156,
      diverseCommunity: true,
      languages: ["English", "Arabic", "Somali", "Bengali"],
      services: [
        "Daily Prayers",
        "Youth Programs",
        "Multicultural Community",
        "Islamic School",
        "Women's Programs",
      ],
      prayerTimes: {
        fajr: "5:35 AM",
        dhuhr: "12:55 PM",
        asr: "3:40 PM",
        maghrib: "6:25 PM",
        isha: "8:10 PM",
        jummah: "1:30 PM",
      },
      imam: "Call for Details",
      description:
        "Comprehensive Islamic center serving Detroit's diverse Muslim community with programs for families, youth development, and women's empowerment.",
    },
 {
   id: "a7156a1b-2616-4b6b-a924-bacd7853bd01",
   name: "Islamic Center of Minnesota",
      address: "1401 Gardena Ave NE, Fridley, MN 55432",
      city: "Minneapolis",
      state: "MN",
      latitude: 45.0861,
      longitude: -93.2635,
      phone: "(763) 571-5604",
      website: "https://www.islamiccentermn.org",
      image: islamicCenterMinnesotaImage,
      featured: false,
      rating: 4.6,
      reviews: 89,
      diverseCommunity: false,
      languages: ["English", "Arabic", "Somali"],
      services: [
        "Friday Prayers",
        "Islamic School",
        "Cultural Events",
        "Youth Activities",
        "Community Support",
      ],
      prayerTimes: {
        fajr: "5:25 AM",
        dhuhr: "12:40 PM",
        asr: "3:25 PM",
        maghrib: "6:10 PM",
        isha: "7:55 PM",
        jummah: "12:45 PM",
      },
      imam: "Call for Details",
      description:
        "Established Islamic center in the Minneapolis area offering religious and educational services for the Muslim community.",
    },
 {
   id: "611d457d-0f71-4c72-8825-6e06281f14d8",
   name: "Islamic Center of Cleveland",
      address: "6055 W130th St, Parma, OH 44130",
      city: "Cleveland",
      state: "OH",
      latitude: 41.3997,
      longitude: -81.7851,
      phone: "(216) 362-0786",
      website: "https://www.iccleveland.org",
      image: masjidAlHikmahClevelandImage,
      featured: false,
      rating: 4.5,
      reviews: 67,
      diverseCommunity: true,
      languages: ["English", "Arabic", "Turkish"],
      services: [
        "Jummah Prayers",
        "Quran Classes",
        "Community Fellowship",
        "Youth Programs",
        "Community Iftar",
      ],
      prayerTimes: {
        fajr: "5:40 AM",
        dhuhr: "1:00 PM",
        asr: "3:45 PM",
        maghrib: "6:30 PM",
        isha: "8:15 PM",
        jummah: "1:15 PM",
      },
      imam: "Call for Details",
      description:
        "Growing Islamic community in Cleveland with fellowship programs and emphasis on youth Islamic education.",
    },

    {
      id: "9191e4a2-e2cd-45f6-8d5e-8920fd81ae7f",
      name: "Islamic Society of Milwaukee",
      address: "4707 S 13th St, Milwaukee, WI 53221",
      city: "Milwaukee",
      state: "WI",
      latitude: 42.9584,
      longitude: -87.9291,
      phone: "(414) 282-1812",
      website: "https://www.ismonline.org",
      image: islamicSocietyGreaterMilwaukeeImage,
      featured: false,
      rating: 4.4,
      reviews: 45,
      diverseCommunity: false,
      languages: ["English", "Arabic"],
      services: [
        "Friday Prayers",
        "Islamic Education",
        "Community Events",
        "Interfaith Dialogue",
        "Social Services",
      ],
      prayerTimes: {
        fajr: "5:45 AM",
        dhuhr: "1:05 PM",
        asr: "3:50 PM",
        maghrib: "6:35 PM",
        isha: "8:20 PM",
        jummah: "1:30 PM",
      },
      imam: "Call for Details",
      description:
        "Welcoming Islamic center in Milwaukee focused on community building, interfaith dialogue, and Islamic education.",
    },

    {
      id: "7bcb9a91-698a-44be-b8a0-99cfc69ac0a9",
      name: "Brooklyn Islamic Center",
      city: "Brooklyn",
      state: "NY",
      latitude: 40.6463,
      longitude: -73.9715,
      phone: "(718) 469-4899",
      website: "https://www.bicny.org",
      image: brooklynIslamicCenterImage,
      featured: false,
      rating: 4.6,
      reviews: 52,
      diverseCommunity: true,
      languages: ["English", "Arabic", "Bengali", "Urdu"],
      services: [
        "Jummah Prayers",
        "Multicultural Community",
        "Youth Programs",
        "Islamic Education",
        "Cultural Events",
        "Community Outreach",
      ],
      prayerTimes: {
        fajr: "5:20 AM",
        dhuhr: "12:40 PM",
        asr: "3:25 PM",
        maghrib: "6:10 PM",
        isha: "7:55 PM",
        jummah: "1:15 PM",
      },
      imam: "Call for Details",
      description:
        "Vibrant Islamic community center in Brooklyn serving New York's diverse Muslim population with religious services, cultural programs, and youth initiatives.",
    },
  ];

const mosques = useMemo(() => {
  return [...databaseMosques, ...staticMosques];
}, [databaseMosques]);

  const handleSubmitMosque = () => {
    if (!user) {
      toast({
        title: t("auth.signInRequiredTitle", {
          defaultValue: "Sign in Required",
        }),
        description: t("auth.submitMosqueBody", {
          defaultValue: "Please sign in to submit a mosque.",
        }),
        variant: "default",
      });
      navigate("/auth");
      return;
    }

    navigate("/submit-mosque");
  };

  const handleGetDirections = (mosque: Mosque) => {
    const encodedAddress = encodeURIComponent(mosque.address);
    window.open(
      `https://maps.google.com/maps?daddr=${encodedAddress}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

const handleMoreDetails = (mosque: Mosque) => {
  if (typeof mosque.id === "string") {
    navigate(`/mosques/${mosque.id}`);
    return;
  }

  setSelectedMosque(mosque);
  setIsModalOpen(true);
};

  const handleVisitWebsite = (website: string) => {
    void openInAppLink(website);
  };

  const handleCallMosque = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handlePrayerTimeUpdates = () => {
    if (!user) {
      toast({
        title: t("auth.signInRequiredTitle", {
          defaultValue: "Sign in Required",
        }),
        description: t("auth.prayerUpdatesBody", {
          defaultValue: "Please sign in to submit prayer time updates.",
        }),
        variant: "default",
      });
      navigate("/auth");
      return;
    }

    setIsPrayerTimeUpdateOpen(true);
  };

  const handleUseMyLocation = async () => {
    try {
      setGettingLocation(true);

      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported"));
            return;
          }

          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 60000,
          });
        }
      );

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setSearchParams({
        lat: String(lat),
        lng: String(lng),
      });

      setActiveFilter("near");
    } catch {
      toast({
        title: "Location unavailable",
        description: "Please allow location access to find nearby mosques.",
        variant: "destructive",
      });
    } finally {
      setGettingLocation(false);
    }
  };

  const filteredMosques = useMemo<MosqueWithDistance[]>(() => {
    let list: MosqueWithDistance[] = mosques.map((mosque) => ({
      ...mosque,
     distance:
       hasUserLocation &&
       Number.isFinite(mosque.latitude) &&
       Number.isFinite(mosque.longitude)
         ? distanceMiles(
             urlLat,
             urlLng,
             mosque.latitude,
             mosque.longitude
           )
         : null,
    }));

    const q = searchTerm.trim().toLowerCase();

    if (q) {
      list = list.filter(
        (mosque) =>
          mosque.name.toLowerCase().includes(q) ||
          mosque.city.toLowerCase().includes(q) ||
          mosque.state.toLowerCase().includes(q) ||
          mosque.address.toLowerCase().includes(q) ||
          mosque.imam.toLowerCase().includes(q) ||
          mosque.services.some((service) => service.toLowerCase().includes(q))
      );
    }

    if (activeFilter === "near") {
      if (hasUserLocation) {
        list = [...list].sort(
          (a, b) => (a.distance ?? 9999) - (b.distance ?? 9999)
        );
      }
    }

    if (activeFilter === "illinois") {
      list = list.filter((mosque) => mosque.state === "IL");
    }

    if (activeFilter === "us") {
      list = list.filter((mosque) =>
        ["IL", "MI", "MN", "OH", "WI", "NY"].includes(mosque.state)
      );
    }

    return list;
  }, [activeFilter, hasUserLocation, searchTerm, urlLat, urlLng]);

    return (
    <main
      className="min-h-screen bg-background pt-16 pb-28"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <section className="bg-gradient-to-br from-secondary/30 to-background py-12">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              {hasUserLocation && activeFilter === "near"
                ? "Mosques Near You"
                : t("header.title", {
                    defaultValue: "Find Mosques & Islamic Centers",
                  })}
            </h1>

            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-6">
              {hasUserLocation && activeFilter === "near"
                ? "Showing nearby mosques sorted by distance from your location."
                : t("header.subtitle", {
                    defaultValue:
                      "Discover welcoming Islamic centers, prayer times, community programs, and Islamic education near you.",
                  })}
            </p>

            <HeroButton
              size="lg"
              onClick={handleUseMyLocation}
              disabled={gettingLocation}
              className="mx-auto"
            >
              <LocateFixed className="mr-2 h-5 w-5" />
              {gettingLocation ? "Getting Location..." : "Use My Location"}
            </HeroButton>
          </div>
        </div>
      </section>

      <section className="py-8 border-b border-border/50">
        <div className="container mx-auto px-4">
          <Card className="shadow-lg mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search
                    className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
                      isRtl ? "right-3" : "left-3"
                    }`}
                    size={20}
                  />

                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t("filters.searchPlaceholder", {
                      defaultValue: "Search mosques by name, city, or imam...",
                    })}
                    className={`${isRtl ? "pr-10" : "pl-10"} h-12 text-base`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "near", label: "Near Me" },
              { key: "illinois", label: "Illinois" },
              { key: "us", label: "United States" },
              { key: "all", label: "All" },
            ].map((item) => (
              <Badge
                key={item.key}
                onClick={() => {
                  if (item.key === "near" && !hasUserLocation) {
                    void handleUseMyLocation();
                    return;
                  }

                  setActiveFilter(item.key as "near" | "illinois" | "us" | "all");
                }}
                className={`cursor-pointer px-4 py-2 transition-colors ${
                  activeFilter === item.key
                    ? "bg-islamic-green text-white"
                    : "bg-secondary text-foreground hover:bg-islamic-green hover:text-white"
                }`}
              >
                {item.label}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {activeFilter === "near" && hasUserLocation
                ? `Nearby Mosques (${filteredMosques.length})`
                : `Islamic Centers (${filteredMosques.length} locations)`}
            </h2>

            <p className="text-muted-foreground">
              {activeFilter === "near" && hasUserLocation
                ? "Nearest mosques are shown first based on your current location."
                : "Browse mosque and Islamic center listings."}
            </p>
          </div>

    {filteredMosques.length === 0 ? (
      <Card>
        <CardContent className="p-8 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />

          <h3 className="text-lg font-semibold">
            {t("directory.noMosquesFound", {
              defaultValue: "No mosques found",
            })}
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            {t("directory.tryAnotherSearch", {
              defaultValue: "Try another search or switch to All.",
            })}
          </p>
        </CardContent>
      </Card>
    ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredMosques.map((mosque) => (
                <Card
                  key={mosque.id}
                  className={`shadow-lg hover:shadow-xl transition-all ${
                    mosque.featured ? "ring-2 ring-islamic-green" : ""
                  }`}
                >
                  <div className="relative">
                    <img
                      src={mosque.image}
                      alt={mosque.name}
                      className="w-full h-48 object-cover rounded-t-lg"
                      loading="lazy"
                    />

                    {mosque.featured && (
                      <Badge className="absolute top-3 left-3 bg-islamic-green text-white">
                        Featured
                      </Badge>
                    )}

                   {mosque.diverseCommunity && (
                     <Badge
                       variant="secondary"
                       className="absolute top-3 right-3 bg-islamic-gold text-white"
                     >
                       {t("directory.diverseCommunity", {
                         defaultValue: "Diverse Community",
                       })}
                     </Badge>
                   )}

                  </div>

                  <CardHeader>
                    <CardTitle className="text-xl">{mosque.name}</CardTitle>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-islamic-gold text-islamic-gold" />
                        <span className="text-sm font-medium">{mosque.rating}</span>
                      </div>

                     <span className="text-sm text-muted-foreground">
                       {t("directory.reviews", {
                         count: mosque.reviews,
                         defaultValue: "({{count}} reviews)",
                       })}
                     </span>
                    </div>

                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{mosque.address}</span>
                    </div>

                    {mosque.distance != null && (
                      <div className="flex items-center gap-2 text-sm font-medium text-islamic-green">
                        <Navigation className="w-4 h-4" />
              <span>
                {t("directory.milesAway", {
                  distance: mosque.distance.toFixed(1),
                  defaultValue: "{{distance}} miles away",
                })}
              </span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent>
                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {mosque.description}
                    </p>
        <div className="mb-4 space-y-2">
          <HeroButton
            type="button"
            size="sm"
            className="w-full"
            onClick={() => handleMoreDetails(mosque)}
          >
            <span className="mr-2 text-base">🕌</span>

           {typeof mosque.id === "string"
             ? t("directory.viewProfile", {
                 defaultValue: "View Mosque Profile",
               })
             : t("directory.moreDetails", {
                 defaultValue: "More Details",
               })}
          </HeroButton>

          <HeroButton
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => handleGetDirections(mosque)}
          >
            <Navigation className="mr-2 h-4 w-4" />
           {t("directory.getDirections", {
             defaultValue: "Get Directions",
           })}
          </HeroButton>
        </div>

                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-islamic-green" />
                   <span className="font-medium">
                     {t("directory.imam", {
                       defaultValue: "Imam:",
                     })}
                   </span>
                  <span>
                    {mosque.imam === "Call for Details"
                      ? t("directory.callForDetails", {
                          defaultValue: "Call for Details",
                        })
                      : mosque.imam}
                  </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-islamic-green" />
                        <span className="font-medium">
                          {t("directory.languages", {
                            defaultValue: "Languages:",
                          })}
                        </span>
                        <span>{mosque.languages.join(", ")}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {mosque.services.slice(0, 4).map((service) => (
                          <Badge key={service} variant="secondary" className="text-xs">
                            {service}
                          </Badge>
                        ))}

                        {mosque.services.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                        {t("directory.moreServices", {
                          count: mosque.services.length - 4,
                          defaultValue: "+{{count}} more",
                        })}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-islamic-green" />
                        <span className="font-medium text-sm">
                  {t("directory.prayerTimesToday", {
                    defaultValue: "Prayer Times Today",
                  })}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                   {t("directory.prayers.fajr", {
                     defaultValue: "Fajr:",
                   })}{" "}
                          <span className="font-medium">
                            {mosque.prayerTimes.fajr}
                          </span>
                        </div>
                        <div>
                   {t("directory.prayers.dhuhr", {
                     defaultValue: "Dhuhr:",
                   })}{" "}
                          <span className="font-medium">
                            {mosque.prayerTimes.dhuhr}
                          </span>
                        </div>
                        <div>
             {t("directory.prayers.asr", {
               defaultValue: "Asr:",
             })}{" "}
                          <span className="font-medium">
                            {mosque.prayerTimes.asr}
                          </span>
                        </div>
                        <div>
                          {t("directory.prayers.maghrib", {
                            defaultValue: "Maghrib:",
                          })}{" "}
                          <span className="font-medium">
                            {mosque.prayerTimes.maghrib}
                          </span>
                        </div>
                        <div>
                      {t("directory.prayers.isha", {
                        defaultValue: "Isha:",
                      })}{" "}
                          <span className="font-medium">
                            {mosque.prayerTimes.isha}
                          </span>
                        </div>
                        <div className="font-semibold text-islamic-green">
                        {t("directory.prayers.jummah", {
                          defaultValue: "Jummah:",
                        })}{" "}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <button
                        type="button"
                        onClick={() => (window.location.href = `tel:${mosque.phone}`)}
                        className="flex items-center gap-2 text-sm hover:text-islamic-green"
                      >
                        <Phone className="w-4 h-4 text-islamic-green" />
                        <span>{mosque.phone}</span>
                      </button>

                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm text-islamic-green hover:underline"
                        onClick={() => handleVisitWebsite(mosque.website)}
                      >
                        <Globe className="w-4 h-4 text-islamic-green" />
                        <span>{mosque.website}</span>
                      </button>
                    </div>
</CardContent>
</Card>
))}
</div>
)}
</div>
</section>
<section className="border-t bg-muted/30 py-6">
  <div className="container mx-auto px-4">
    <div className="mx-auto max-w-3xl rounded-xl border bg-background p-4 text-center">
      <p className="text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">
          Disclaimer:
        </span>{" "}
        Tariq Islam is an independent platform and is not affiliated with,
        endorsed by, or officially associated with any mosque or Islamic
        organization listed in this directory. Mosque information is provided
        for general community reference. Tariq Islam serves Muslims around the
        world by helping users discover and connect with Islamic resources.
      </p>
    </div>
  </div>
</section>
      <section className="py-16 bg-gradient-to-br from-secondary/30 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Missing Your Mosque?
            </h2>

            <p className="text-lg text-muted-foreground mb-8">
              Help us build a comprehensive directory. Submit your mosque or
              Islamic center to be featured in our community directory.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <HeroButton size="lg" onClick={handleSubmitMosque}>
                <Calendar className="mr-2" />
                Submit Mosque
              </HeroButton>

              <HeroButton variant="outline" size="lg" onClick={handlePrayerTimeUpdates}>
                <Book className="mr-2" />
                Prayer Time Updates
              </HeroButton>
            </div>
          </div>
        </div>
      </section>

      <MosqueDetailModal
        mosque={selectedMosque}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <PrayerTimeUpdateModal
        isOpen={isPrayerTimeUpdateOpen}
        onClose={() => setIsPrayerTimeUpdateOpen(false)}
      />
    </main>
  );
}