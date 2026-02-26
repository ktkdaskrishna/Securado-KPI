import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import MicrosoftLoginButton from './MicrosoftLoginButton';

const SECURADO_LOGO_PRIMARY = "https://customer-assets.emergentagent.com/job_streamhub-crm/artifacts/39apig25_Securado%20Logo-01.jpg";

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Show SSO errors from redirect
  useEffect(() => {
    const ssoError = searchParams.get('error');
    if (ssoError) {
      setError(ssoError);
      toast.error(ssoError);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      toast.success('Login successful');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid email or password';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0dfd4] via-[#f5f5f5] to-[#e8e8ea] p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#800000]/5 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[#86c881]/10 blur-3xl"></div>
      </div>
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="mx-auto mb-6">
            <img 
              src={SECURADO_LOGO_PRIMARY} 
              alt="Securado" 
              className="h-16 w-auto mx-auto"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#800000] to-[#9a1919] items-center justify-center hidden mx-auto">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-[#333333]">Welcome back</CardTitle>
          <CardDescription className="text-gray-500">
            Sign in to your Securado CRM account
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#333333]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-gray-300 focus:border-[#800000] focus:ring-[#800000]/20"
                data-testid="login-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#333333]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-gray-300 focus:border-[#800000] focus:ring-[#800000]/20"
                data-testid="login-password-input"
              />
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2" data-testid="login-error-message">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#800000] to-[#9a1919] hover:from-[#9a1919] hover:to-[#b02020] text-white shadow-lg shadow-[#800000]/25 transition-all duration-200"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          
          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or continue with</span>
            </div>
          </div>
          
          {/* Microsoft SSO Login */}
          <MicrosoftLoginButton 
            onSuccess={() => {
              toast.success('Microsoft login successful');
              navigate('/dashboard');
            }}
            onError={(err) => {
              toast.error(err.message || 'Microsoft login failed');
            }}
          />
          
          <div className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#800000] hover:text-[#9a1919] font-medium hover:underline">
              Register
            </Link>
          </div>
          
          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Protected by Securado's Digital Vaccine
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Powered by AI, ML, and Human Intelligence
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
