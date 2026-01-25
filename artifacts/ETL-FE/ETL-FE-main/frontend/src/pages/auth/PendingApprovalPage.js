import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Clock, RefreshCw, LogOut, Zap } from 'lucide-react';

const PendingApprovalPage = () => {
  const navigate = useNavigate();
  const { fetchUser, logout, user } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const updatedUser = await fetchUser();
      if (updatedUser && updatedUser.status !== 'pending') {
        toast.success('Your account has been approved!');
        navigate('/dashboard');
      } else {
        toast.info('Your account is still pending approval');
      }
    } catch (err) {
      toast.error('Failed to check status');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Platform 3</h1>
            <p className="text-sm text-muted-foreground">Sales Command Center</p>
          </div>
        </div>

        <Card className="border-border" data-testid="pending-approval-card">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-accent" />
            </div>
            <CardTitle className="text-xl">Pending Approval</CardTitle>
            <CardDescription>
              Your account is currently pending administrator approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{user?.email}</strong>
              </p>
              <p className="mt-2">
                An administrator will review your account shortly. You'll receive
                access once approved.
              </p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleCheckStatus}
                className="w-full"
                disabled={checking}
                data-testid="check-status-button"
              >
                {checking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Check Status
              </Button>

              <Button
                variant="ghost"
                onClick={logout}
                className="w-full"
                data-testid="logout-button"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
