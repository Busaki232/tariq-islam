import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeroButton } from '@/components/ui/hero-button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye, MapPin, Globe, Mail, Phone } from 'lucide-react';
import { EditAdModal } from './EditAdModal';

interface MyAdCardProps {
  ad: {
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
  };
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export const MyAdCard = ({ ad, onDelete, onUpdate }: MyAdCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    approved: 'bg-green-500/10 text-green-700 dark:text-green-400',
    rejected: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };

  const handleDelete = () => {
    onDelete(ad.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image Section */}
          <div className="md:w-1/3">
            {ad.image_url ? (
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full h-64 md:h-full object-cover"
              />
            ) : (
              <div className="w-full h-64 md:h-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground">No image</span>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="md:w-2/3 p-6">
            <CardHeader className="p-0 mb-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-2xl">{ad.title}</CardTitle>
                  {ad.featured && (
                    <Badge className="bg-primary text-primary-foreground">
                      Featured
                    </Badge>
                  )}
                </div>
                <Badge className={statusColors[ad.status as keyof typeof statusColors]}>
                  {ad.status.charAt(0).toUpperCase() + ad.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{ad.view_count} views</span>
                </div>
                {ad.categories && (
                  <Badge variant="secondary">{ad.categories.name}</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <p className="text-muted-foreground mb-4 line-clamp-3">
                {ad.description}
              </p>

              <div className="space-y-2 mb-4">
                {ad.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{ad.location}</span>
                  </div>
                )}
                {ad.contact_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>{ad.contact_email}</span>
                  </div>
                )}
                {ad.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-primary" />
                    <span>{ad.contact_phone}</span>
                  </div>
                )}
                {ad.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-primary" />
                    <a
                      href={ad.website.startsWith('http') ? ad.website : `https://${ad.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {ad.website}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <HeroButton
                  variant="outline"
                  onClick={() => setShowEditModal(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </HeroButton>
                <HeroButton
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </HeroButton>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{ad.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditAdModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        ad={ad}
        onSuccess={() => {
          setShowEditModal(false);
          onUpdate();
        }}
      />
    </>
  );
};
