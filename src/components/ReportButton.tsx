import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Flag, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ReportButtonProps {
  contentType: 'message' | 'post' | 'profile' | 'review' | 'advertisement';
  contentId: string;
  reportedUserId?: string;
  variant?: 'default' | 'icon';
}

const ReportButton = ({ contentType, contentId, reportedUserId, variant = 'default' }: ReportButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { value: 'hate_speech', label: 'Hate Speech' },
    { value: 'extremism', label: 'Extremism or Terrorism' },
    { value: 'harassment', label: 'Harassment or Bullying' },
    { value: 'spam', label: 'Spam or Scam' },
    { value: 'violence', label: 'Violence or Threats' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'other', label: 'Other Violation' },
  ];

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to report content');
      return;
    }

    if (!reportType) {
      toast.error('Please select a report reason');
      return;
    }

    if (description.trim().length < 10) {
      toast.error('Please provide a detailed description (minimum 10 characters)');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('reports')
        .insert([{
          content_type: contentType,
          content_id: contentId,
          report_type: reportType as any,
          description: description.trim(),
          reported_user_id: reportedUserId || null,
        }]);

      if (error) throw error;

      toast.success('Report submitted successfully. Our moderation team will review it shortly.');
      setOpen(false);
      setReportType('');
      setDescription('');
    } catch (error: any) {
      console.error('Error submitting report:', error);
      if (error.message?.includes('reported_by != reported_user_id')) {
        toast.error('You cannot report your own content');
      } else {
        toast.error('Failed to submit report. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="sm">
            <Flag className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Flag className="w-4 h-4 mr-2" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Report Content
          </DialogTitle>
          <DialogDescription>
            Help us maintain a safe community by reporting content that violates our guidelines.
            All reports are confidential.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Reason for Report *</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger id="report-type">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Please provide details about why you're reporting this content..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/1000 characters (minimum 10)
            </p>
          </div>

          <div className="bg-muted p-3 rounded-md text-sm text-muted-foreground">
            <p className="font-medium mb-1">What happens next?</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Our moderation team will review your report</li>
              <li>Action will be taken if guidelines are violated</li>
              <li>Severe violations may result in immediate suspension</li>
              <li>You'll be notified of the outcome</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportButton;
