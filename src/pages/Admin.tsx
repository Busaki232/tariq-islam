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
import { Loader2, Store, Building2, UserCog, Clock, CheckCircle, XCircle, Handshake, Users } from 'lucide-react';
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
  const [applications, setApplications] = useState<PendingItem[]>([]);
  const [prayerUpdates, setPrayerUpdates] = useState<PendingItem[]>([]);
  const [partnerships, setPartnerships] = useState<PendingItem[]>([]);
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
      const [adsRes, mosquesRes, appsRes, prayerRes, partnershipsRes] = await Promise.all([
        supabase.from('advertisements').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('mosque_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('leadership_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('prayer_time_updates').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('partnership_inquiries').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      ]);

      setAdvertisements(adsRes.data || []);
      setMosques(mosquesRes.data || []);
      setApplications(appsRes.data || []);
      setPrayerUpdates(prayerRes.data || []);
      setPartnerships(partnershipsRes.data || []);
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
    { label: 'Pending Partnerships', count: partnerships.length, icon: Handshake }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage pending submissions and applications</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="advertisements">
              Advertisements ({advertisements.length})
            </TabsTrigger>
            <TabsTrigger value="mosques">
              Mosques ({mosques.length})
            </TabsTrigger>
            <TabsTrigger value="applications">
              Applications ({applications.length})
            </TabsTrigger>
            <TabsTrigger value="prayer-updates">
              Prayer Updates ({prayerUpdates.length})
            </TabsTrigger>
            <TabsTrigger value="partnerships">
              Partnerships ({partnerships.length})
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
