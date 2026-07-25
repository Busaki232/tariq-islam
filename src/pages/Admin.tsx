import Navigation from "@/components/Navigation";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Store,
  Building2,
  UserCog,
  Clock,
  CheckCircle,
  XCircle,
  Handshake,
  Users,
  Shield
} from 'lucide-react';
import { UserManagementTab } from '@/components/admin/UserManagementTab';

interface PendingItem {
  id: string;
  created_at: string;
  status: string;
  [key: string]: any;
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const { toast } = useToast();


  
  const [advertisements, setAdvertisements] = useState<PendingItem[]>([]);
  const [mosques, setMosques] = useState<PendingItem[]>([]);
  const [mosqueClaims, setMosqueClaims] = useState<PendingItem[]>([]);
  const [applications, setApplications] = useState<PendingItem[]>([]);
  const [prayerUpdates, setPrayerUpdates] = useState<PendingItem[]>([]);
  const [partnerships, setPartnerships] = useState<PendingItem[]>([]);
  const [scholarApplications, setScholarApplications] =
    useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!rolesLoading && !isAdmin) {
      navigate('/');
      return;
    }
    
    if (isAdmin) {
      fetchPendingItems();
    }
  }, [isAdmin, rolesLoading, navigate]);

  const fetchPendingItems = async () => {
    try {
    const [
      adsRes,
      mosquesRes,
      claimsRes,
      appsRes,
      prayerRes,
      partnershipsRes,
      scholarsRes,
    ] = await Promise.all([
        supabase.from('advertisements').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('mosque_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase
          .from("mosque_claim_requests")
          .select(`
            *,
            mosques (
              id,
              name,
              address,
              city,
              state
            )
          `)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
supabase
  .from("leadership_applications")
  .select("*")
  .eq("status", "pending")
  .order("created_at", { ascending: false }),

supabase
  .from("prayer_time_updates")
  .select("*")
  .eq("status", "pending")
  .order("created_at", { ascending: false }),

supabase
  .from("partnership_inquiries")
  .select("*")
  .eq("status", "pending")
  .order("created_at", { ascending: false }),

supabase
  .from("scholar_profiles")
  .select("*")
  .order("created_at", { ascending: false }),
]);

      setAdvertisements(adsRes.data || []);
      setMosques(mosquesRes.data || []);
      setMosqueClaims(claimsRes.data || []);
      setApplications(appsRes.data || []);
      setPrayerUpdates(prayerRes.data || []);
      setPartnerships(partnershipsRes.data || []);
      setScholarApplications(scholarsRes.data || []);
    } catch (error) {
      console.error('Error fetching pending items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending items',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (table: string, id: string, type: string) => {
    try {
      const { error } = await supabase
        .from(table as any)
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Approved',
        description: `${type} has been approved successfully`
      });

      fetchPendingItems();
    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve item',
        variant: 'destructive'
      });
    }
  };

  const handleReject = async (table: string, id: string, type: string) => {
    const reason = rejectionReason[id];
    if (!reason?.trim()) {
      toast({
        title: 'Rejection reason required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from(table as any)
        .update({ 
          status: 'declined',
          rejection_reason: reason 
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Rejected',
        description: `${type} has been rejected`
      });

      setRejectionReason(prev => ({ ...prev, [id]: '' }));
      fetchPendingItems();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject item',
        variant: 'destructive'
      });
    }
  };

const handleApproveMosqueClaim = async (claim: PendingItem) => {
  try {
    const { error: mosqueError } = await supabase
      .from("mosques")
      .update({
        claimed_by: claim.user_id,
      })
      .eq("id", claim.mosque_id);

    if (mosqueError) {
      throw mosqueError;
    }

    const { error: claimError } = await supabase
      .from("mosque_claim_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (claimError) {
      throw claimError;
    }

    toast({
      title: "Mosque claim approved",
      description: `${claim.full_name} can now manage this mosque.`,
    });

    void fetchPendingItems();
  } catch (error) {
    console.error("Error approving mosque claim:", error);

    toast({
      title: "Error",
      description: "Failed to approve mosque claim",
      variant: "destructive",
    });
  }
};

const handleRejectMosqueClaim = async (claimId: string) => {
  const reason = rejectionReason[claimId];

  if (!reason?.trim()) {
    toast({
      title: "Rejection reason required",
      description: "Please provide a reason for rejecting this claim.",
      variant: "destructive",
    });

    return;
  }

  try {
    const { error } = await supabase
      .from("mosque_claim_requests")
      .update({
        status: "rejected",
        admin_notes: reason.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (error) {
      throw error;
    }

    setRejectionReason((current) => ({
      ...current,
      [claimId]: "",
    }));

    toast({
      title: "Mosque claim rejected",
      description: "The claimant can submit updated information.",
    });

    void fetchPendingItems();
  } catch (error) {
    console.error("Error rejecting mosque claim:", error);

    toast({
      title: "Error",
      description: "Failed to reject mosque claim",
      variant: "destructive",
    });
  }
};
const handleApproveScholar = async (scholarId: string) => {
  try {
    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!currentUser?.id) {
      throw new Error("Administrator account could not be identified.");
    }

    const { error } = await supabase
      .from("scholar_profiles")
      .update({
        verification_status: "approved",
        verification_notes:
          rejectionReason[scholarId]?.trim() || null,
        verified_at: new Date().toISOString(),
        verified_by: currentUser.id,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scholarId);

    if (error) {
      throw error;
    }

    setRejectionReason((current) => ({
      ...current,
      [scholarId]: "",
    }));

    toast({
      title: "Scholar approved",
      description:
        "The scholar profile has been verified successfully.",
    });

    void fetchPendingItems();
  } catch (error) {
    console.error("Error approving scholar:", error);

    toast({
      title: "Error",
      description: "Failed to approve scholar application.",
      variant: "destructive",
    });
  }
};

const handleRejectScholar = async (scholarId: string) => {
  const reason = rejectionReason[scholarId];

  if (!reason?.trim()) {
    toast({
      title: "Rejection reason required",
      description:
        "Please provide a reason before rejecting this application.",
      variant: "destructive",
    });

    return;
  }

  try {
    const { error } = await supabase
      .from("scholar_profiles")
      .update({
        verification_status: "rejected",
        verification_notes: reason.trim(),
        verified_at: null,
        verified_by: null,
        is_featured: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scholarId);

    if (error) {
      throw error;
    }

    setRejectionReason((current) => ({
      ...current,
      [scholarId]: "",
    }));

    toast({
      title: "Scholar rejected",
      description:
        "The scholar application has been rejected.",
    });

    void fetchPendingItems();
  } catch (error) {
    console.error("Error rejecting scholar:", error);

    toast({
      title: "Error",
      description: "Failed to reject scholar application.",
      variant: "destructive",
    });
  }
};

const handleToggleScholarFeatured = async (
  scholarId: string,
  currentlyFeatured: boolean
) => {
  try {
    const { error } = await supabase
      .from("scholar_profiles")
      .update({
        is_featured: !currentlyFeatured,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scholarId);

    if (error) {
      throw error;
    }

    toast({
      title: currentlyFeatured
        ? "Scholar removed from featured"
        : "Scholar featured",
    });

    void fetchPendingItems();
  } catch (error) {
    console.error("Error updating featured scholar:", error);

    toast({
      title: "Error",
      description: "Failed to update featured status.",
      variant: "destructive",
    });
  }
};

const handleToggleScholarActive = async (
  scholarId: string,
  currentlyActive: boolean
) => {
  try {
    const { error } = await supabase
      .from("scholar_profiles")
      .update({
 ...(currentlyActive
   ? {
       is_active: false,
       is_featured: false,
     }
   : {
       is_active: true,
     }),
 updated_at: new Date().toISOString(),
      })
      .eq("id", scholarId);

    if (error) {
      throw error;
    }

    toast({
      title: currentlyActive
        ? "Scholar deactivated"
        : "Scholar activated",
    });

    void fetchPendingItems();
  } catch (error) {
    console.error("Error updating scholar status:", error);

    toast({
      title: "Error",
      description: "Failed to update scholar status.",
      variant: "destructive",
    });
  }
};

  if (rolesLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const stats = [
    { label: 'Pending Ads', count: advertisements.length, icon: Store },
    { label: 'Pending Mosques', count: mosques.length, icon: Building2 },
    { label: 'Pending Applications', count: applications.length, icon: UserCog },
    { label: 'Pending Prayer Updates', count: prayerUpdates.length, icon: Clock },
{ label: 'Pending Partnerships', count: partnerships.length, icon: Handshake },
{
  label: "Scholar Applications",
      count: scholarApplications.filter(
        (scholar) =>
          scholar.verification_status === "pending"
      ).length,
      icon: UserCog,
    },
  ];

return (
  <>
    <Navigation />

    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-foreground md:text-4xl">
          Admin Dashboard
        </h1>

        <p className="text-muted-foreground">
          Manage pending submissions and applications
        </p>
      </div>

      <Button
        type="button"
        onClick={() => navigate("/moderation")}
        className="w-full sm:w-auto"
      >
        <Shield className="mr-2 h-4 w-4" />
        Content Moderation
      </Button>
    </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.count}</p>
                    </div>
                    <Icon className="h-8 w-8 text-primary opacity-50" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="advertisements" className="w-full">
    <TabsList className="flex h-auto w-full justify-start gap-2 overflow-x-auto p-1">
      <TabsTrigger
        value="advertisements"
        className="shrink-0 whitespace-nowrap px-3"
      >
        Ads ({advertisements.length})
      </TabsTrigger>

      <TabsTrigger
        value="mosques"
        className="shrink-0 whitespace-nowrap px-3"
      >
        Mosques ({mosques.length})
      </TabsTrigger>

      <TabsTrigger
        value="mosque-claims"
        className="shrink-0 whitespace-nowrap px-3"
      >
        Claims ({mosqueClaims.length})
      </TabsTrigger>

      <TabsTrigger
        value="applications"
        className="shrink-0 whitespace-nowrap px-3"
      >
        Applications ({applications.length})
      </TabsTrigger>

      <TabsTrigger
        value="prayer-updates"
        className="shrink-0 whitespace-nowrap px-3"
      >
        Prayer Updates ({prayerUpdates.length})
      </TabsTrigger>

      <TabsTrigger
        value="partnerships"
        className="shrink-0 whitespace-nowrap px-3"
      >
        Partnerships ({partnerships.length})
      </TabsTrigger>

      <TabsTrigger
        value="scholars"
        className="shrink-0 whitespace-nowrap px-3"
      >
        Scholars (
        {
          scholarApplications.filter(
            (scholar) =>
              scholar.verification_status === "pending"
          ).length
        }
        )
      </TabsTrigger>

      <TabsTrigger
        value="users"
        className="shrink-0 whitespace-nowrap px-3"
      >
        <Users className="mr-2 h-4 w-4" />
        Users
      </TabsTrigger>
    </TabsList>
          <TabsContent value="mosque-claims" className="mt-6 space-y-4">
            {mosqueClaims.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending mosque claims
                </CardContent>
              </Card>
            ) : (
              mosqueClaims.map((claim) => {
                const claimedMosque = Array.isArray(claim.mosques)
                  ? claim.mosques[0]
                  : claim.mosques;

                return (
                  <Card key={claim.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle>
                            {claimedMosque?.name || "Mosque ownership claim"}
                          </CardTitle>

                          <CardDescription>
                            Submitted by {claim.full_name} on{" "}
                            {new Date(claim.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>

                        <Badge variant="outline">{claim.status}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium">Claimant</p>
                          <p className="text-sm text-muted-foreground">
                            {claim.full_name}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium">Role at Mosque</p>
                          <p className="text-sm text-muted-foreground">
                            {claim.role_at_mosque}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="break-all text-sm text-muted-foreground">
                            {claim.email}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">
                            {claim.phone || "Not provided"}
                          </p>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-sm font-medium">Mosque Address</p>
                          <p className="text-sm text-muted-foreground">
                            {[
                              claimedMosque?.address,
                              claimedMosque?.city,
                              claimedMosque?.state,
                            ]
                              .filter(Boolean)
                              .join(", ") || "Not provided"}
                          </p>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-sm font-medium">
                            Proof and Verification Details
                          </p>

                          <p className="mt-1 whitespace-pre-line rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                            {claim.proof_details}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Textarea
                          placeholder="Rejection reason, required when rejecting"
                          value={rejectionReason[claim.id] || ""}
                          onChange={(event) => {
                            const value = event.target.value;

                            setRejectionReason((current) => ({
                              ...current,
                              [claim.id]: value,
                            }));
                          }}
                          rows={3}
                        />

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            onClick={() => void handleApproveMosqueClaim(claim)}
                            className="flex-1"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve Claim
                          </Button>

                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() =>
                              void handleRejectMosqueClaim(claim.id)
                            }
                            className="flex-1"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Claim
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="advertisements" className="space-y-4 mt-6">
            {advertisements.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending advertisements
                </CardContent>
              </Card>
            ) : (
              advertisements.map((ad) => (
                <Card key={ad.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{ad.title}</CardTitle>
                        <CardDescription>
                          Submitted {new Date(ad.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{ad.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Description</p>
                        <p className="text-sm text-muted-foreground">{ad.description}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-muted-foreground">{ad.location}</p>
                      </div>
                      {ad.contact_email && (
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{ad.contact_email}</p>
                        </div>
                      )}
                      {ad.contact_phone && (
                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">{ad.contact_phone}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Rejection reason (required if rejecting)"
                        value={rejectionReason[ad.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRejectionReason(prev => ({ ...prev, [ad.id]: value }));
                        }}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove('advertisements', ad.id, 'Advertisement')}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReject('advertisements', ad.id, 'Advertisement')}
                          variant="destructive"
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="mosques" className="space-y-4 mt-6">
            {mosques.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending mosque submissions
                </CardContent>
              </Card>
            ) : (
              mosques.map((mosque) => (
                <Card key={mosque.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{mosque.mosque_name}</CardTitle>
                        <CardDescription>
                          Submitted {new Date(mosque.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{mosque.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Address</p>
                        <p className="text-sm text-muted-foreground">
                          {mosque.address}, {mosque.city}, {mosque.state} {mosque.zip_code}
                        </p>
                      </div>
                      {mosque.imam_name && (
                        <div>
                          <p className="text-sm font-medium">Imam</p>
                          <p className="text-sm text-muted-foreground">{mosque.imam_name}</p>
                        </div>
                      )}
                      {mosque.phone && (
                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">{mosque.phone}</p>
                        </div>
                      )}
                      {mosque.email && (
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{mosque.email}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Rejection reason (required if rejecting)"
                        value={rejectionReason[mosque.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRejectionReason(prev => ({ ...prev, [mosque.id]: value }));
                        }}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove('mosque_submissions', mosque.id, 'Mosque submission')}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReject('mosque_submissions', mosque.id, 'Mosque submission')}
                          variant="destructive"
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-4 mt-6">
            {applications.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending leadership applications
                </CardContent>
              </Card>
            ) : (
              applications.map((app) => (
                <Card key={app.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{app.full_name}</CardTitle>
                        <CardDescription>
                          Submitted {new Date(app.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{app.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{app.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-muted-foreground">{app.location}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium">Experience</p>
                        <p className="text-sm text-muted-foreground">{app.experience}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium">Motivation</p>
                        <p className="text-sm text-muted-foreground">{app.motivation}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Rejection reason (required if rejecting)"
                        value={rejectionReason[app.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRejectionReason(prev => ({ ...prev, [app.id]: value }));
                        }}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove('leadership_applications', app.id, 'Application')}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReject('leadership_applications', app.id, 'Application')}
                          variant="destructive"
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="prayer-updates" className="space-y-4 mt-6">
            {prayerUpdates.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending prayer time updates
                </CardContent>
              </Card>
            ) : (
              prayerUpdates.map((update) => (
                <Card key={update.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{update.mosque_name}</CardTitle>
                        <CardDescription>
                          Submitted {new Date(update.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{update.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Contact Name</p>
                        <p className="text-sm text-muted-foreground">{update.contact_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Contact Email</p>
                        <p className="text-sm text-muted-foreground">{update.contact_email}</p>
                      </div>
                      {update.notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium">Notes</p>
                          <p className="text-sm text-muted-foreground">{update.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Rejection reason (required if rejecting)"
                        value={rejectionReason[update.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRejectionReason(prev => ({ ...prev, [update.id]: value }));
                        }}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove('prayer_time_updates', update.id, 'Prayer time update')}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReject('prayer_time_updates', update.id, 'Prayer time update')}
                          variant="destructive"
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="partnerships" className="space-y-4 mt-6">
            {partnerships.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending partnership inquiries
                </CardContent>
              </Card>
            ) : (
              partnerships.map((partnership) => (
                <Card key={partnership.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{partnership.company_name}</CardTitle>
                        <CardDescription>
                          Submitted {new Date(partnership.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{partnership.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Contact Name</p>
                        <p className="text-sm text-muted-foreground">{partnership.contact_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{partnership.email}</p>
                      </div>
                      {partnership.phone && (
                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">{partnership.phone}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">Inquiry Type</p>
                        <p className="text-sm text-muted-foreground capitalize">{partnership.inquiry_type}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium">Message</p>
                        <p className="text-sm text-muted-foreground">{partnership.message}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Rejection reason (required if rejecting)"
                        value={rejectionReason[partnership.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRejectionReason(prev => ({ ...prev, [partnership.id]: value }));
                        }}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApprove('partnership_inquiries', partnership.id, 'Partnership inquiry')}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleReject('partnership_inquiries', partnership.id, 'Partnership inquiry')}
                          variant="destructive"
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent
            value="scholars"
            className="mt-6 space-y-4"
          >
            {scholarApplications.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No scholar applications
                </CardContent>
              </Card>
            ) : (
              scholarApplications.map((scholar) => (
                <Card key={scholar.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>
                          {scholar.display_name}
                        </CardTitle>

                        <CardDescription>
                          Submitted{" "}
                          {new Date(
                            scholar.created_at
                          ).toLocaleDateString()}
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {scholar.verification_status}
                        </Badge>

                        {scholar.is_featured && (
                          <Badge>Featured</Badge>
                        )}

                        {!scholar.is_active && (
                          <Badge variant="destructive">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium">
                          Biography
                        </p>

                        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                          {scholar.biography ||
                            "No biography provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          Specialties
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {scholar.specialties?.length
                            ? scholar.specialties.join(", ")
                            : "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          Languages
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {scholar.languages?.length
                            ? scholar.languages.join(", ")
                            : "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          Location
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {[scholar.city, scholar.country]
                            .filter(Boolean)
                            .join(", ") || "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          Website
                        </p>

                        <p className="break-all text-sm text-muted-foreground">
                          {scholar.website_url || "Not provided"}
                        </p>
                      </div>

                      {scholar.youtube_url && (
                        <div>
                          <p className="text-sm font-medium">
                            YouTube
                          </p>

                          <p className="break-all text-sm text-muted-foreground">
                            {scholar.youtube_url}
                          </p>
                        </div>
                      )}

                      {scholar.facebook_url && (
                        <div>
                          <p className="text-sm font-medium">
                            Facebook
                          </p>

                          <p className="break-all text-sm text-muted-foreground">
                            {scholar.facebook_url}
                          </p>
                        </div>
                      )}

                      {scholar.instagram_url && (
                        <div>
                          <p className="text-sm font-medium">
                            Instagram
                          </p>

                          <p className="break-all text-sm text-muted-foreground">
                            {scholar.instagram_url}
                          </p>
                        </div>
                      )}
                    </div>

                    <Textarea
                      placeholder="Verification notes or rejection reason"
                      value={
                        rejectionReason[scholar.id] ??
                        scholar.verification_notes ??
                        ""
                      }
                      onChange={(event) => {
                        const value = event.target.value;

                        setRejectionReason((current) => ({
                          ...current,
                          [scholar.id]: value,
                        }));
                      }}
                      rows={3}
                    />

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Button
                        type="button"
                        onClick={() =>
                          void handleApproveScholar(scholar.id)
                        }
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() =>
                          void handleRejectScholar(scholar.id)
                        }
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          scholar.verification_status !==
                          "approved"
                        }
                        onClick={() =>
                          void handleToggleScholarFeatured(
                            scholar.id,
                            scholar.is_featured
                          )
                        }
                      >
                        {scholar.is_featured
                          ? "Remove Featured"
                          : "Feature Scholar"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void handleToggleScholarActive(
                            scholar.id,
                            scholar.is_active
                          )
                        }
                      >
                        {scholar.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  );
};

export default Admin;
