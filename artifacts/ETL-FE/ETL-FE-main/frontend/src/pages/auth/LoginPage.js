import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Zap, Eye, EyeOff, Server } from 'lucide-react';
import { cn } from '../../lib/utils';
import { isUsingPlatform2, switchToPlatform2, switchToLocal } from '../../lib/apiClient';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const usePlatform2 = isUsingPlatform2();

  const handleBackendSwitch = (checked) => {
    if (checked) {
      switchToPlatform2();
    } else {
      switchToLocal();
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: usePlatform2 ? 'admin@platform2.com' : '',
      password: usePlatform2 ? 'admin123' : '',
    },
  });

  // Set form values when using Platform 2
  useEffect(() => {
    if (usePlatform2) {
      setValue('email', 'admin@platform2.com');
      setValue('password', 'admin123');
    }
  }, [usePlatform2, setValue]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const user = await login(data.email, data.password);
      toast.success('Welcome back!');
      
      if (user.status === 'pending') {
        navigate('/pending-approval');
      } else {
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from);
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Invalid credentials';
      toast.error(message);
    } finally {
      setLoading(false);
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

        <Card className="border-border" data-testid="login-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className={cn(errors.email && 'ring-1 ring-destructive')}
                  data-testid="login-email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className={cn(
                      'pr-10',
                      errors.password && 'ring-1 ring-destructive'
                    )}
                    data-testid="login-password"
                    {...register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff size={16} className="text-muted-foreground" />
                    ) : (
                      <Eye size={16} className="text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Use Platform 2 Backend
                  </span>
                </div>
                <Switch
                  checked={usePlatform2}
                  onCheckedChange={handleBackendSwitch}
                  data-testid="backend-switch"
                />
              </div>
              {usePlatform2 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Login: admin@platform2.com / admin123
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Don't have an account?{' '}
          <span className="text-primary cursor-pointer hover:underline">
            Contact your administrator
          </span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
