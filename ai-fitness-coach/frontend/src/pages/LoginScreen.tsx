import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Dumbbell, ShieldCheck, Mail, Lock, ArrowRight, Activity } from 'lucide-react';
import { toast } from 'sonner';

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // In a real flow, we'd call authApi.login
      // For now, let's allow "admin/admin" or use the Dev Login
      if (email === 'admin' && password === 'admin') {
         handleDevLogin();
      } else {
         toast.error("Invalid credentials", {
           description: "Try 'admin' / 'admin' or use the Dev Login bypass."
         });
      }
    } finally {
      setLoading(false);
    }
  };

  const location = useLocation();

  const handleDevLogin = () => {
    // Inject Mock Authentication
    const mockUser = {
      id: "user_123",
      email: "test@example.com",
      name: "Champ"
    };
    const mockToken = "mock_jwt_token_for_verification";
    
    login(mockToken, mockUser);
    toast.success("Welcome back!", {
      description: "Authenticated via Dev Bypass. All features are now unlocked."
    });
    
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Aesthetic */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/30 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px]" />
      </div>

      <Card className="w-full max-w-sm p-8 bg-zinc-950/50 backdrop-blur-2xl border-zinc-900 shadow-2xl relative z-10 space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]">
            <Dumbbell className="h-6 w-6 text-black fill-black" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">ANTIGRAVITY</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">AI Fitness Coach</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
             <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Email or username" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:ring-primary/20 h-11"
                />
             </div>
          </div>
          <div className="space-y-2">
             <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input 
                  type="password"
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-zinc-900/50 border-zinc-800 focus:ring-primary/20 h-11"
                />
             </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 font-black uppercase text-xs tracking-widest group">
            {loading ? "Authenticating..." : "Sign In"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-900" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold">
            <span className="bg-zinc-950 px-2 text-zinc-600 tracking-widest">Developer Access</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={handleDevLogin}
          className="w-full h-11 border-dashed border-zinc-800 hover:bg-zinc-900/50 hover:border-primary/50 text-zinc-400 hover:text-primary font-bold transition-all"
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Bypass to Dashboard
        </Button>

        <div className="flex items-center justify-center space-x-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
           <Activity className="h-3 w-3" />
           <span>System Status: Online</span>
        </div>
      </Card>
    </div>
  );
};

export default LoginScreen;
