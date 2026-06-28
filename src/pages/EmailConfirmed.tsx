import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const EmailConfirmed = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    // Wait for auth state to settle
    if (loading) return;

    // Check if user is authenticated (confirmation successful)
    if (user) {
      setStatus('success');
      setMessage('Your email has been confirmed successfully!');
    } else {
      // If still no user after loading, the confirmation failed
      const timer = setTimeout(() => {
        if (!user) {
          setStatus('error');
          setMessage('Email confirmation failed or link has expired.');
        }
      }, 3000); // Give Supabase 3 seconds to process the token

      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  const handleContinue = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              {status === 'loading' && (
                <div className="bg-gradient-primary rounded-full p-4">
                  <Loader2 className="text-white animate-spin" size={32} />
                </div>
              )}
              {status === 'success' && (
                <div className="bg-green-500 rounded-full p-4">
                  <CheckCircle className="text-white" size={32} />
                </div>
              )}
              {status === 'error' && (
                <div className="bg-red-500 rounded-full p-4">
                  <XCircle className="text-white" size={32} />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {status === 'loading' && 'Confirming Email...'}
              {status === 'success' && 'Email Confirmed!'}
              {status === 'error' && 'Confirmation Failed'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{message}</p>
            
            {status === 'success' && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700">
                    Welcome to Tariq Islam! You can now sign in to your account and access all features.
                  </p>
                </div>
                <Button 
                  onClick={handleContinue}
                  className="w-full bg-gradient-primary hover:opacity-90"
                >
                  Continue to App
                </Button>
              </div>
            )}
            
            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">
                    The confirmation link may have expired or is invalid. 
                    Please try signing up again or contact support.
                  </p>
                </div>
                <Button 
                  onClick={() => navigate('/auth')}
                  variant="outline"
                  className="w-full"
                >
                  Back to Sign Up
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmed;