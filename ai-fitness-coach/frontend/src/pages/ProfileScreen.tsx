import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile, getCoachSettings, updateCoachSettings, getAvailableEquipment } from '../api/profileApi';
import { PhysicalStatsCard } from '../components/premium/PhysicalStatsCard';
import { EquipmentSelector } from '../components/premium/EquipmentSelector';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ChevronLeft, User, Settings, ShieldCheck, Flame, Info } from 'lucide-react';
import { toast } from 'sonner';

const ProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [coachSettings, setCoachSettings] = useState<any>(null);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prof, coach, equip] = await Promise.all([
          getProfile().catch(() => ({ height: 180, weight: 75, age: 25, gender: 'male', activityLevel: 1.5, streak: { current: 0 } })),
          getCoachSettings().catch(() => ({ equipmentIds: [], experienceLevel: 'intermediate', trainingDays: 4 })),
          getAvailableEquipment().catch(() => [{id:'db', name:'Dumbbells'}, {id:'bb', name:'Barbell'}])
        ]);
        setProfile(prof);
        setCoachSettings(coach);
        setEquipmentList(equip);
      } catch (error) {
        console.error('Failed to fetch profile data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateProfile(profile),
        updateCoachSettings(coachSettings)
      ]);
      toast.success("Profile updated!", {
        description: "Your health metrics and coaching preferences have been synchronized."
      });
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground animate-in fade-in duration-500">
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8 pb-32">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">User Profile</h1>
            <p className="text-xs font-medium text-primary flex items-center justify-center">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Verified Account
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90 font-bold"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </header>

        <main className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Stats & Streaks */}
          <div className="space-y-6">
            <PhysicalStatsCard 
              height={profile.height}
              weight={profile.weight}
              age={profile.age}
              gender={profile.gender}
              activityLevel={profile.activityLevel || 1.2}
            />

            <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 space-y-4">
               <div className="flex items-center space-x-3 text-primary">
                 <Flame className="h-5 w-5" />
                 <h4 className="font-black text-xs uppercase tracking-widest">Active Streak</h4>
               </div>
               <div className="flex items-baseline space-x-2">
                 <span className="text-4xl font-black">{profile.streak?.current || 0}</span>
                 <span className="text-xs font-bold text-muted-foreground uppercase">Days Strong</span>
               </div>
            </div>
          </div>

          {/* Middle Column: Personal Info & Settings */}
          <div className="lg:col-span-2 space-y-8">
            <section className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-black tracking-tight text-lg">Physical Metrics</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricInput 
                  label="Height (cm)" 
                  value={profile.height} 
                  onChange={(v: number) => setProfile({...profile, height: v})} 
                />
                <MetricInput 
                  label="Weight (kg)" 
                  value={profile.weight} 
                  onChange={(v: number) => setProfile({...profile, weight: v})} 
                />
                <MetricInput 
                  label="Age" 
                  value={profile.age} 
                  onChange={(v: number) => setProfile({...profile, age: v})} 
                />
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Gender</label>
                  <select 
                    value={profile.gender}
                    onChange={(e) => setProfile({...profile, gender: e.target.value})}
                    className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800 text-sm font-bold"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-4 mt-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Activity Level</label>
                  <select 
                    value={profile.activityLevel}
                    onChange={(e) => setProfile({...profile, activityLevel: parseFloat(e.target.value)})}
                    className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800 text-sm font-bold"
                  >
                    <option value="1.2">Sedentary (Little to no exercise)</option>
                    <option value="1.375">Light (Exercise 1-3 days/week)</option>
                    <option value="1.55">Moderate (Exercise 3-5 days/week)</option>
                    <option value="1.725">Active (Exercise 6-7 days/week)</option>
                    <option value="1.9">Very Active (Hard exercise daily)</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-900">
               <div className="flex items-center space-x-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-black tracking-tight text-lg">Training Environment</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pb-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Experience Level</label>
                  <select 
                    value={coachSettings.experienceLevel}
                    onChange={(e) => setCoachSettings({...coachSettings, experienceLevel: e.target.value})}
                    className="w-full h-12 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800 text-sm font-bold"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">Training Days / Week</label>
                  <Input 
                    type="number" 
                    min="1" max="7"
                    value={coachSettings.trainingDays}
                    onChange={(e) => setCoachSettings({...coachSettings, trainingDays: parseInt(e.target.value)})}
                    className="h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800 text-sm font-bold pl-4"
                  />
                </div>
              </div>

              <EquipmentSelector 
                available={equipmentList}
                selected={coachSettings.equipmentIds || []}
                onChange={(ids) => setCoachSettings({...coachSettings, equipmentIds: ids})}
              />

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start space-x-3">
                 <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                 <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                   Changing your available equipment will cause the AI to reassess your upcoming workout plans to ensure accessibility.
                 </p>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

const MetricInput = ({ label, value, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest ml-1">{label}</label>
    <Input 
      type="number" 
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border-none ring-1 ring-zinc-200 dark:ring-zinc-800 text-sm font-bold pl-4"
    />
  </div>
);

export default ProfileScreen;
