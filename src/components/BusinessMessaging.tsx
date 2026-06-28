import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Shield, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  contact_request_id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ContactRequest {
  id: string;
  advertisement_id: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  message: string;
  status: string;
  risk_score: number;
  requires_verification: boolean;
  access_granted_at: string | null;
  access_expires_at: string | null;
  created_at: string;
}

interface BusinessMessagingProps {
  contactRequestId: string;
  onClose?: () => void;
}

export const BusinessMessaging = ({ contactRequestId, onClose }: BusinessMessagingProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [contactRequest, setContactRequest] = useState<ContactRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (contactRequestId) {
      fetchContactRequest();
      fetchMessages();
    }
  }, [contactRequestId]);

  const fetchContactRequest = async () => {
    try {
      // Use secure function that respects privacy policies
      const { data, error } = await supabase
        .rpc('get_contact_requests_with_privacy')
        .eq('id', contactRequestId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setContactRequest(data as ContactRequest);
      }
    } catch (error) {
      // Silent fail - component will show appropriate UI
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('business_messages')
        .select('*')
        .eq('contact_request_id', contactRequestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      // Silent fail - empty messages array shown
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !contactRequest) return;

    setIsSending(true);
    try {
      const recipientId = user.id === contactRequest.requester_id 
        ? (await getAdvertisementOwnerId(contactRequest.advertisement_id))
        : contactRequest.requester_id;

      const { error } = await supabase
        .from('business_messages')
        .insert({
          contact_request_id: contactRequestId,
          sender_id: user.id,
          recipient_id: recipientId,
          message: newMessage.trim()
        });

      if (error) throw error;

      // Log the message activity
      await supabase.rpc('log_contact_access', {
        _contact_request_id: contactRequestId,
        _access_type: 'message_sent'
      });

      setNewMessage('');
      fetchMessages();
      
      toast({
        title: "Message sent",
        description: "Your message has been delivered securely."
      });
    } catch (error) {
      // Error handled with user notification
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const getAdvertisementOwnerId = async (advertisementId: string): Promise<string> => {
    // Use secure function to get ad owner without exposing contact info
    const { data, error } = await supabase
      .rpc('get_advertisement_owner_id', { _advertisement_id: advertisementId });
    
    if (error) throw error;
    return data as string;
  };

  const grantContactAccess = async () => {
    if (!contactRequest) return;

    try {
      const { error } = await supabase.rpc('grant_contact_access', {
        _contact_request_id: contactRequestId,
        _hours: 72
      });

      if (error) throw error;

      toast({
        title: "Access granted",
        description: "Contact information access has been granted for 72 hours."
      });

      fetchContactRequest();
    } catch (error) {
      // Error handled with user notification
      toast({
        title: "Error",
        description: "Failed to grant access. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getRiskBadgeVariant = (riskScore: number) => {
    if (riskScore < 30) return 'default';
    if (riskScore < 60) return 'secondary';
    return 'destructive';
  };

  const getRiskText = (riskScore: number) => {
    if (riskScore < 30) return 'Low Risk';
    if (riskScore < 60) return 'Medium Risk';
    return 'High Risk';
  };

  const isAccessExpired = contactRequest?.access_expires_at 
    ? new Date(contactRequest.access_expires_at) < new Date()
    : false;

  const hasValidAccess = contactRequest?.access_granted_at && !isAccessExpired;

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="text-center">Loading conversation...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Business Conversation
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
        
        {contactRequest && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={contactRequest.status === 'approved' ? 'default' : 'secondary'}>
              {contactRequest.status.charAt(0).toUpperCase() + contactRequest.status.slice(1)}
            </Badge>
            
            {contactRequest.risk_score !== null && (
              <Badge variant={getRiskBadgeVariant(contactRequest.risk_score)}>
                <Shield className="w-3 h-3 mr-1" />
                {getRiskText(contactRequest.risk_score)}
              </Badge>
            )}
            
            {contactRequest.requires_verification && (
              <Badge variant="outline">
                Verification Required
              </Badge>
            )}
            
            {hasValidAccess && (
              <Badge variant="default">
                <Clock className="w-3 h-3 mr-1" />
                Access Granted
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Initial contact request */}
        {contactRequest && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Initial Request</span>
                  <span>{formatDistanceToNow(new Date(contactRequest.created_at), { addSuffix: true })}</span>
                </div>
                <p className="font-medium">{contactRequest.requester_name}</p>
                <p className="text-sm">{contactRequest.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs p-3 rounded-lg ${
                    message.sender_id === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{message.message}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Message input */}
        {contactRequest?.status === 'approved' && (
          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              disabled={isSending}
            />
            <Button onClick={sendMessage} disabled={isSending || !newMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Contact access controls */}
        {contactRequest && user && contactRequest.requester_id !== user.id && (
          <div className="space-y-2">
            {contactRequest.status === 'pending' && (
              <Button onClick={grantContactAccess} size="sm">
                Grant Contact Access (72 hours)
              </Button>
            )}
            
            {hasValidAccess && contactRequest.access_expires_at && (
              <p className="text-sm text-muted-foreground">
                Contact access expires {formatDistanceToNow(new Date(contactRequest.access_expires_at), { addSuffix: true })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};