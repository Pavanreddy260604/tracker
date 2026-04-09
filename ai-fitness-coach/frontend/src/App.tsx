import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext'
import { useAuth } from './contexts/AuthContext'
import { DailyPlanCard } from './components/premium/DailyPlanCard'
import { NutritionProgress } from './components/premium/NutritionProgress'
import { StreakDisplay } from './components/premium/StreakDisplay'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Sun, Moon, LogOut, Settings, User } from 'lucide-react'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'
import ProtectedRoute from './components/ProtectedRoute';
import { useTodayPlan, useStreak, useNutritionProgress } from './hooks/useDashboardData';
import WorkoutScreen from './pages/WorkoutScreen';
import ProgressScreen from './pages/ProgressScreen';
import NutritionScreen from './pages/NutritionScreen';
import ProfileScreen from './pages/ProfileScreen';
import LoginScreen from './pages/LoginScreen';
import { BottomNav } from './components/shared/BottomNav';
import { useEffect } from 'react';

const COACH_TIPS = [
  "Hydration is key for recovery. Aim for 3L of water today!",
  "Progressive overload is the #1 driver of muscle growth. Add 2.5kg when sets feel easy.",
  "Sleep 7-9 hours to maximize recovery and hormone production.",
  "Protein synthesis peaks post-workout — log your meal within 90 minutes.",
  "Consistency beats intensity. Show up even on low-energy days.",
  "Breathe out on exertion, breathe in on the return. Control your breath.",
  "Rest days are growth days — your muscles rebuild stronger during recovery.",
];

function HomeScreen() {
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const { plan, loading: planLoading, refetch: refetchPlan } = useTodayPlan()
  const { streak, loading: streakLoading, refetch: refetchStreak } = useStreak()
  const { progress, loading: nutritionLoading, refetch: refetchNutrition } = useNutritionProgress()
  const navigate = useNavigate()
  const location = useLocation()

  // Refetch all dashboard data when returning from workout completion
  useEffect(() => {
    if ((location.state as any)?.workoutCompleted) {
      refetchPlan();
      refetchStreak();
      refetchNutrition();
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    toast(`Switched to ${nextTheme} mode`)
  }

  const isLoading = planLoading || streakLoading || nutritionLoading

  // Rotate tip by day-of-year
  const tipIndex = Math.floor(Date.now() / 86400000) % COACH_TIPS.length;
  const todayTip = COACH_TIPS[tipIndex];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8 animate-in fade-in duration-700 pb-24">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter sm:text-4xl">
            Welcome back, <span className="text-primary">{user?.name || 'Champ'}</span>
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/profile')}>
            <User className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={logout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
          {/* Main Daily Plan */}
          <div className="lg:col-span-2 space-y-6">
            <DailyPlanCard
              type={plan?.workoutType || 'rest'}
              workoutName={plan?.workoutName}
              exercises={plan?.exercises}
              className="h-full"
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <NutritionProgress
                calories={{
                  current: progress?.currentCalories || 0,
                  target: plan?.nutritionTargets?.calories || 2000,
                }}
                protein={{
                  current: progress?.currentProtein || 0,
                  target: plan?.nutritionTargets?.protein || 150,
                }}
              />
              <div className="space-y-6">
                <div className="p-6 rounded-2xl border bg-card/50 backdrop-blur-sm space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Quick Actions
                  </h4>
                  <div className="grid gap-2">
                    <Button variant="secondary" className="justify-start h-11" onClick={() => navigate('/nutrition')}>
                      Log a Meal
                    </Button>
                    <Button variant="secondary" className="justify-start h-11" onClick={() => navigate('/progress')}>
                      Update Weight
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            <StreakDisplay
              count={streak?.current || 0}
              longest={streak?.longest || 0}
              hasFreeze={streak?.hasFreeze || false}
              isFreezeActive={streak?.isFreezeActive || false}
              onFreezeUsed={refetchStreak}
            />

            <Card className="p-6 border-primary/20 bg-primary/5">
              <h4 className="font-bold mb-2">Coach's Tip</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">"{todayTip}"</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-primary/20">
        <Routes>
          <Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
          <Route path="/workout" element={<ProtectedRoute><WorkoutScreen /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><ProgressScreen /></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute><NutritionScreen /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
          <Route path="/login" element={<LoginScreen />} />
        </Routes>
        <BottomNav />
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App;
