import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { HeroButton } from "@/components/ui/hero-button";
import { Star, MapPin, Clock, Phone, Globe, Users, Calendar, Navigation, X } from "lucide-react";

interface MosqueDetailModalProps {
  mosque: {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
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
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

const MosqueDetailModal = ({ mosque, isOpen, onClose }: MosqueDetailModalProps) => {
  if (!mosque) return null;

  const handleGetDirections = () => {
    const encodedAddress = encodeURIComponent(mosque.address);
    window.open(`https://maps.google.com/maps?daddr=${encodedAddress}`, '_blank', 'noopener,noreferrer');
  };

  const handleCallPhone = () => {
    window.open(`tel:${mosque.phone}`, '_self');
  };

  const handleVisitWebsite = () => {
    const website = mosque.website.startsWith('http') ? mosque.website : `https://${mosque.website}`;
    window.open(website, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{mosque.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Image and Basic Info */}
          <div className="relative">
            <img 
              src={mosque.image} 
              alt={mosque.name}
              className="w-full h-64 object-cover rounded-lg"
            />
            <div className="absolute top-3 left-3 flex gap-2">
              {mosque.featured && (
                <Badge className="bg-islamic-green text-white">
                  Featured
                </Badge>
              )}
              {mosque.diverseCommunity && (
                <Badge variant="secondary" className="bg-islamic-gold text-white">
                  Diverse Community
                </Badge>
              )}
            </div>
          </div>

          {/* Rating and Address */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 fill-islamic-gold text-islamic-gold" />
                <span className="font-medium">{mosque.rating}</span>
              </div>
              <span className="text-muted-foreground">({mosque.reviews} reviews)</span>
            </div>
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-5 h-5" />
              <span>{mosque.address}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">About</h3>
            <p className="text-muted-foreground">{mosque.description}</p>
          </div>

          {/* Imam and Languages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-islamic-green" />
                <span className="font-medium">Imam:</span>
                <span>{mosque.imam}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-islamic-green" />
                <span className="font-medium">Languages:</span>
                <span>{mosque.languages.join(", ")}</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Services & Programs</h3>
            <div className="flex flex-wrap gap-2">
              {mosque.services.map((service, index) => (
                <Badge key={index} variant="secondary">
                  {service}
                </Badge>
              ))}
            </div>
          </div>

          {/* Prayer Times */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Prayer Times</h3>
            <div className="p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-islamic-green" />
                <span className="font-medium">Today's Prayer Schedule</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="text-center p-2 bg-background rounded">
                  <div className="text-sm text-muted-foreground">Fajr</div>
                  <div className="font-semibold text-islamic-green">{mosque.prayerTimes.fajr}</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="text-sm text-muted-foreground">Dhuhr</div>
                  <div className="font-semibold text-islamic-green">{mosque.prayerTimes.dhuhr}</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="text-sm text-muted-foreground">Asr</div>
                  <div className="font-semibold text-islamic-green">{mosque.prayerTimes.asr}</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="text-sm text-muted-foreground">Maghrib</div>
                  <div className="font-semibold text-islamic-green">{mosque.prayerTimes.maghrib}</div>
                </div>
                <div className="text-center p-2 bg-background rounded">
                  <div className="text-sm text-muted-foreground">Isha</div>
                  <div className="font-semibold text-islamic-green">{mosque.prayerTimes.isha}</div>
                </div>
                <div className="text-center p-2 bg-islamic-green/10 rounded border-2 border-islamic-green">
                  <div className="text-sm text-islamic-green font-medium">Jummah</div>
                  <div className="font-bold text-islamic-green">{mosque.prayerTimes.jummah}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact and Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact & Visit</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <HeroButton onClick={handleGetDirections} className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Get Directions
              </HeroButton>
              
              <HeroButton variant="outline" onClick={handleCallPhone} className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Call {mosque.phone}
              </HeroButton>
              
              <HeroButton variant="outline" onClick={handleVisitWebsite} className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Visit Website
              </HeroButton>
            </div>
          </div>

          {/* Map Embed */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Location</h3>
            <div className="w-full h-64 bg-secondary/30 rounded-lg flex items-center justify-center">
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(mosque.address)}&output=embed`}
                width="100%"
                height="100%"
                className="rounded-lg"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MosqueDetailModal;