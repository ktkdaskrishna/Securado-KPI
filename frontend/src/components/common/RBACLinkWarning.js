import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertTriangle, ShieldAlert, Mail, UserX, ExternalLink } from 'lucide-react';

/**
 * RBAC Link Warning Popup
 * 
 * Shows a warning when a user logs in but is not linked to an Odoo RBAC profile.
 * This means they have restricted access and can only see their own data.
 */
const RBACLinkWarning = ({ user, onDismiss, onContactAdmin }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user is logged in and not linked to RBAC
    if (user && user.rbac_linked === false) {
      // Check if warning was dismissed in this session
      const dismissed = sessionStorage.getItem('rbac_warning_dismissed');
      if (!dismissed) {
        setOpen(true);
      }
    }
  }, [user]);

  const handleDismiss = () => {
    sessionStorage.setItem('rbac_warning_dismissed', 'true');
    setOpen(false);
    onDismiss?.();
  };

  const handleContactAdmin = () => {
    // Could open email client or show contact info
    onContactAdmin?.();
    handleDismiss();
  };

  if (!user || user.rbac_linked !== false) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md bg-[#1e1e1e] border-[#333]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-500">
            <ShieldAlert className="h-5 w-5" />
            Limited Access Warning
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Your account is not linked to an Odoo user profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert className="bg-yellow-500/10 border-yellow-500/30">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-400/90">
              You are signed in as <strong>{user?.email || user?.name}</strong>, but your account 
              is not linked to an Odoo RBAC profile. This means you have <strong>restricted access</strong>.
            </AlertDescription>
          </Alert>

          {/* What this means */}
          <div className="space-y-3">
            <h4 className="font-medium text-white flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-400" />
              What this means:
            </h4>
            <ul className="space-y-2 text-sm text-gray-400 ml-6 list-disc">
              <li>You can only see data that belongs to you</li>
              <li>Dashboard metrics are filtered to your records only</li>
              <li>Team and company-wide data is not visible</li>
              <li>Some features may be restricted</li>
            </ul>
          </div>

          {/* How to fix */}
          <div className="space-y-3">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-400" />
              To get full access:
            </h4>
            <ul className="space-y-2 text-sm text-gray-400 ml-6 list-disc">
              <li>Contact your administrator to link your account</li>
              <li>Ensure your email matches your Odoo user profile</li>
              <li>Ask admin to sync RBAC from Odoo</li>
            </ul>
          </div>

          {/* User info */}
          <div className="bg-[#2a2a2a] rounded-lg p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="text-white ml-2">{user?.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Access Level:</span>
                <span className="text-yellow-400 ml-2">{user?.access_level || 'RESTRICTED'}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="flex-1 border-[#444] text-gray-300 hover:bg-[#333]"
            data-testid="rbac-warning-dismiss-btn"
          >
            Continue with Limited Access
          </Button>
          <Button
            onClick={handleContactAdmin}
            className="flex-1 bg-[#800000] hover:bg-[#990000]"
            data-testid="rbac-warning-contact-btn"
          >
            <Mail className="h-4 w-4 mr-2" />
            Contact Admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RBACLinkWarning;
