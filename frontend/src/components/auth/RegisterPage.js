import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { getCurrencyOptions, DEFAULT_CURRENCY } from '../../lib/currency';

const SECURADO_LOGO_PRIMARY = "https://customer-assets.emergentagent.com/job_streamhub-crm/artifacts/39apig25_Securado%20Logo-01.jpg";

export function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    default_currency: DEFAULT_CURRENCY,
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        default_currency: formData.default_currency,
      });
      toast.success('Registration successful! Please wait for admin approval.');
      navigate('/login');
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
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
          <CardTitle className="text-2xl font-bold text-[#333333]">Create an account</CardTitle>
          <CardDescription className="text-gray-500">
            Get started with Securado CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#333333]">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="border-gray-300 focus:border-[#800000] focus:ring-[#800000]/20"
                data-testid="register-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#333333]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="border-gray-300 focus:border-[#800000] focus:ring-[#800000]/20"
                data-testid="register-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-[#333333]">Default Currency</Label>
              <Select 
                value={formData.default_currency} 
                onValueChange={(v) => setFormData({ ...formData, default_currency: v })}
              >
                <SelectTrigger className="border-gray-300 focus:border-[#800000] focus:ring-[#800000]/20" data-testid="register-currency-select">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {getCurrencyOptions().map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.code} - {curr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#333333]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="border-gray-300 focus:border-[#800000] focus:ring-[#800000]/20"
                data-testid="register-password-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#333333]">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                className="border-gray-300 focus:border-[#800000] focus:ring-[#800000]/20"
                data-testid="register-confirm-password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#800000] to-[#9a1919] hover:from-[#9a1919] hover:to-[#b02020] text-white shadow-lg shadow-[#800000]/25 transition-all duration-200"
              disabled={loading}
              data-testid="register-submit-button"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-[#800000] hover:text-[#9a1919] font-medium hover:underline">
              Sign in
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
