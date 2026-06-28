import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Report {
  id: string;
  reported_by: string | null;
  reported_user_id: string | null;
  content_type: string;
  content_id: string;
  report_type: string;
  description: string;
  status: string;
  is_auto_flagged: boolean;
  severity_score: number | null;
  created_at: string;
}

const ModerationDashboard = () => {
  const { user } = useAuth();
  const { isAdmin, isModerator, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    underReview: 0,
    resolved: 0,
    totalToday: 0
  });

  useEffect(() => {
    if (!rolesLoading && !isAdmin && !isModerator) {
      toast.error('Access denied. Moderator privileges required.');
      navigate('/');
    } else if (!rolesLoading && (isAdmin || isModerator)) {
      fetchReports();
      fetchStats();
    }
  }, [isAdmin, isModerator, rolesLoading, navigate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('status, created_at');

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = (data || []).reduce((acc, report) => {
        if (report.status === 'pending') acc.pending++;
        if (report.status === 'under_review') acc.underReview++;
        if (report.status === 'resolved') acc.resolved++;
        if (new Date(report.created_at) >= today) acc.totalToday++;
        return acc;
      }, { pending: 0, underReview: 0, resolved: 0, totalToday: 0 });

      setStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleReportAction = async (
    reportId: string,
    action: 'under_review' | 'resolved' | 'dismissed',
    notes?: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: action,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          resolution_notes: notes || null
        })
        .eq('id', reportId);

      if (error) throw error;

      toast.success(`Report ${action === 'resolved' ? 'resolved' : action === 'dismissed' ? 'dismissed' : 'moved to review'}`);
      fetchReports();
      fetchStats();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Failed to update report');
    }
  };

  const takeModerationAction = async (
    reportId: string,
    userId: string,
    actionType: 'warning' | 'content_removed' | 'user_suspended' | 'user_banned',
    reason: string,
    contentType?: string,
    contentId?: string
  ) => {
    if (!user) return;

    try {
      const { error: logError } = await supabase
        .from('moderation_logs')
        .insert({
          moderator_id: user.id,
          target_user_id: userId,
          report_id: reportId,
          action_type: actionType,
          reason: reason,
          content_type: contentType,
          content_id: contentId
        });

      if (logError) throw logError;

      // If suspension or ban, create suspension record
      if (actionType === 'user_suspended' || actionType === 'user_banned') {
        const { error: suspensionError } = await supabase
          .from('user_suspensions')
          .insert({
            user_id: userId,
            suspended_by: user.id,
            reason: reason,
            is_permanent: actionType === 'user_banned',
            expires_at: actionType === 'user_suspended' 
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
              : null
          });

        if (suspensionError) throw suspensionError;
      }

      await handleReportAction(reportId, 'resolved', reason);
      toast.success('Moderation action completed');
    } catch (error) {
      console.error('Error taking moderation action:', error);
      toast.error('Failed to complete moderation action');
    }
  };

  const getStatusBadge = (status: string, isAutoFlagged: boolean) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'destructive',
      under_review: 'default',
      resolved: 'secondary',
      dismissed: 'outline'
    };

    return (
      <div className="flex gap-2">
        <Badge variant={variants[status] || 'default'}>
          {status.replace('_', ' ')}
        </Badge>
        {isAutoFlagged && (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
            Auto-Flagged
          </Badge>
        )}
      </div>
    );
  };

  const getSeverityColor = (severity: number | null) => {
    if (!severity) return 'text-muted-foreground';
    if (severity >= 80) return 'text-destructive';
    if (severity >= 50) return 'text-orange-600';
    return 'text-yellow-600';
  };

  if (rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin && !isModerator) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-islamic-green" />
          <div>
            <h1 className="text-3xl font-bold">Moderation Dashboard</h1>
            <p className="text-muted-foreground">Content moderation and community safety</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Under Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.underReview}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-islamic-green" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalToday}</div>
            </CardContent>
          </Card>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="under_review">Under Review ({stats.underReview})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All Reports</TabsTrigger>
          </TabsList>

          {['pending', 'under_review', 'resolved', 'all'].map((status) => (
            <TabsContent key={status} value={status} className="space-y-4">
              {loading ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Loading reports...
                  </CardContent>
                </Card>
              ) : (
                reports
                  .filter(r => status === 'all' || r.status === status)
                  .map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      getStatusBadge={getStatusBadge}
                      getSeverityColor={getSeverityColor}
                      handleReportAction={handleReportAction}
                      takeModerationAction={takeModerationAction}
                    />
                  ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

// Report Card Component
const ReportCard = ({ report, getStatusBadge, getSeverityColor, handleReportAction, takeModerationAction }: any) => {
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('');
  const [showActions, setShowActions] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {report.report_type.replace('_', ' ').toUpperCase()} - {report.content_type}
            </CardTitle>
            <CardDescription>
              Reported {new Date(report.created_at).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(report.status, report.is_auto_flagged)}
            {report.severity_score && (
              <div className={`text-sm font-medium ${getSeverityColor(report.severity_score)}`}>
                Severity: {report.severity_score}/100
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-1">Description:</p>
          <p className="text-sm text-muted-foreground">{report.description}</p>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Content ID: {report.content_id}</p>
          {report.reported_user_id && <p>Reported User ID: {report.reported_user_id}</p>}
        </div>

        {report.status === 'pending' || report.status === 'under_review' ? (
          <>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReportAction(report.id, 'under_review')}
              >
                <Clock className="w-4 h-4 mr-2" />
                Start Review
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowActions(!showActions)}
              >
                Take Action
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReportAction(report.id, 'dismissed', 'No violation found')}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Dismiss
              </Button>
            </div>

            {showActions && (
              <div className="space-y-3 pt-3 border-t">
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select moderation action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Issue Warning</SelectItem>
                    <SelectItem value="content_removed">Remove Content</SelectItem>
                    <SelectItem value="user_suspended">Suspend User (7 days)</SelectItem>
                    <SelectItem value="user_banned">Ban User (Permanent)</SelectItem>
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Reason for action (required)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />

                <Button
                  onClick={() => {
                    if (notes.trim().length < 10) {
                      toast.error('Please provide a detailed reason');
                      return;
                    }
                    if (report.reported_user_id) {
                      takeModerationAction(
                        report.id,
                        report.reported_user_id,
                        action as any,
                        notes,
                        report.content_type,
                        report.content_id
                      );
                    }
                  }}
                  disabled={!action || notes.trim().length < 10}
                  className="w-full"
                >
                  Confirm Action
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            {report.resolution_notes && (
              <>
                <p className="font-medium">Resolution Notes:</p>
                <p>{report.resolution_notes}</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ModerationDashboard;
