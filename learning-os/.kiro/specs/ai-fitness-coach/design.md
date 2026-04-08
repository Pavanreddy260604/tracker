# Design Document: AI Fitness Coach

## Overview

AI Fitness Coach is a full-stack intelligent fitness coaching system implementing a closed-loop architecture (INPUT → ANALYSIS → DECISION → ACTION → FEEDBACK → MEMORY UPDATE). The system guides beginners through their fitness journey with zero confusion by tracking workouts, nutrition, and body metrics while learning from user data to provide adaptive, personalized coaching.

### Core Design Principles

1. **Simplicity First**: One action at a time, minimal decisions, clear visual hierarchy
2. **Closed-Loop Learning**: Every interaction feeds back into the system to improve future recommendations
3. **Evidence-Based**: All workout and nutrition logic grounded in fitness science
4. **Mobile-First**: Designed for gym environments with dark theme and high contrast

### Technology Stack

- **Frontend**: React (Vite), Tailwind CSS
- **Backend**: Node.js, Express.js, REST API
- **Database**: MongoDB
- **Authentication**: JWT with bcrypt password hashing

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  Home   │  │ Workout │  │ Progress│  │Nutrition│  │ Profile │           │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘           │
│       └────────────┴────────────┴────────────┴────────────┘                 │
│                              │                                               │
│                    React + Tailwind CSS                                      │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │ HTTPS/REST
┌──────────────────────────────┼──────────────────────────────────────────────┐
│                         API GATEWAY                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Express.js REST API (v1)                                            │   │
│  │  - JWT Authentication Middleware                                     │   │
│  │  - Rate Limiting (5 auth attempts/min)                               │   │
│  │  - Request Validation                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────────┐
│                         SERVICE LAYER                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    User      │  │   Workout    │  │  Progression │  │ Substitution │    │
│  │   Profile    │  │   Engine     │  │   Engine     │  │   Engine     │    │
│  │   Engine     │  │              │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Execution   │  │  Nutrition   │  │ Daily Plan   │  │   Coach      │    │
│  │   Engine     │  │   Engine     │  │  Generator   │  │   Engine     │    │
│  │              │  │              │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐                                                           │
│  │ Monitoring   │                                                           │
│  │   Engine     │                                                           │
│  └──────────────┘                                                           │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────────┐
│                       DATA LAYER (MongoDB)                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    users     │  │   exercises  │  │   workouts   │  │nutrition_logs│    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  sessions    │  │progression_  │  │  food_db     │  │  feedback_   │    │
│  │              │  │   history    │  │              │  │    logs      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────────���────────────────────────────────────────────────────────────┘
```

### Closed-Loop Architecture Flow

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐    ┌──────────┐    ┌──────────────┐
│  INPUT  │───▶│ ANALYSIS │───▶│ DECISION │───▶│ ACTION │───▶│ FEEDBACK │───▶│ MEMORY UPDATE│
└─────────┘    └──────────┘    └──────────┘    └────────┘    └──────────┘    └──────────────┘
     │              │               │              │              │                │
     ▼              ▼               ▼              ▼              ▼                ▼
  User         Historical       Algorithm      API Response    User Response   Profile Update
  Action       Data Lookup      Selection      Execution       Capture         & Learning
```

## Components and Interfaces

### Backend Services

#### User Profile Engine
```typescript
interface UserProfileEngine {
  // Profile Management
  createProfile(userId: string, data: ProfileData): Promise<UserProfile>;
  updateProfile(userId: string, updates: Partial<ProfileData>): Promise<UserProfile>;
  getProfile(userId: string): Promise<UserProfile>;
  
  // Derived Metrics Calculation
  calculateBMI(height: number, weight: number): number;
  calculateTDEE(profile: ProfileData): number;
  calculateCalorieTarget(profile: ProfileData, goal: FitnessGoal): number;
  calculateProteinTarget(weight: number, goal: FitnessGoal): number;
}

interface ProfileData {
  height: number;           // cm
  weight: number;           // kg
  age: number;
  gender: 'male' | 'female' | 'other';
  fitnessGoal: 'muscle_gain' | 'fat_loss' | 'strength';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  gymType: 'home' | 'commercial' | 'outdoor';
  availableEquipment: string[];
  trainingDaysPerWeek: number;
}
```

#### Workout Engine
```typescript
interface WorkoutEngine {
  // Plan Generation
  generateWorkoutPlan(userId: string, constraints: WorkoutConstraints): Promise<WorkoutPlan>;
  getWorkoutPlan(planId: string): Promise<WorkoutPlan>;
  getActiveWorkoutPlan(userId: string): Promise<WorkoutPlan | null>;
  
  // Workout Distribution
  distributeExercises(goal: FitnessGoal, equipment: string[]): ExerciseDistribution;
  assignRepRanges(goal: FitnessGoal): RepRangeConfig;
  calculateWeeklyVolume(plan: WorkoutPlan): VolumeMetrics;
}

interface WorkoutConstraints {
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  availableEquipment: string[];
  daysPerWeek: number;
  sessionDuration: number;  // minutes
}

interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  days: WorkoutDay[];
  createdAt: Date;
  active: boolean;
}

interface WorkoutDay {
  dayOfWeek: number;
  exercises: PlannedExercise[];
  estimatedDuration: number;
}

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes?: string;
}
```

#### Execution Engine
```typescript
interface ExecutionEngine {
  // Session Management
  startSession(userId: string, planId: string, dayIndex: number): Promise<WorkoutSession>;
  getSession(sessionId: string): Promise<WorkoutSession>;
  completeSession(sessionId: string): Promise<WorkoutSession>;
  
  // Set Management
  completeSet(sessionId: string, exerciseIndex: number, setData: SetData): Promise<WorkoutSession>;
  skipExercise(sessionId: string, exerciseIndex: number, reason?: string): Promise<WorkoutSession>;
  
  // Real-time Guidance
  getNextAction(sessionId: string): Promise<WorkoutAction>;
  suggestWeightAdjustment(sessionId: string, exerciseIndex: number, difficulty: DifficultyRating): WeightSuggestion;
}

interface WorkoutSession {
  id: string;
  userId: string;
  planId: string;
  dayIndex: number;
  startTime: Date;
  endTime?: Date;
  exercises: SessionExercise[];
  status: 'active' | 'completed' | 'abandoned';
}

interface SessionExercise {
  exerciseId: string;
  plannedSets: number;
  completedSets: SetData[];
  skipped: boolean;
  skipReason?: string;
}

interface SetData {
  setNumber: number;
  weight: number;
  reps: number;
  completedAt: Date;
  difficultyRating?: 1 | 2 | 3 | 4 | 5;  // RPE scale
}
```

#### Progression Engine
```typescript
interface ProgressionEngine {
  // Volume Tracking
  calculateSessionVolume(exercises: SessionExercise[]): number;
  calculateWeeklyVolume(userId: string, weekStart: Date): Promise<VolumeMetrics>;
  
  // Progression Logic
  checkProgressionEligibility(userId: string, exerciseId: string): Promise<ProgressionStatus>;
  applyProgression(userId: string, exerciseId: string): Promise<ProgressionResult>;
  
  // Plateau Detection
  detectPlateau(userId: string, exerciseId: string): Promise<PlateauStatus>;
  suggestDeload(userId: string, exerciseId: string): Promise<DeloadSuggestion>;
  
  // History
  getProgressionHistory(userId: string, exerciseId: string): Promise<ProgressionEntry[]>;
}

interface ProgressionStatus {
  consecutiveSuccesses: number;
  eligibleForIncrease: boolean;
  suggestedIncrease: number;  // percentage
}

interface PlateauStatus {
  isPlateaued: boolean;
  consecutiveFailures: number;
  suggestedAction: 'deload' | 'variation' | 'rest' | 'none';
}
```

#### Substitution Engine
```typescript
interface SubstitutionEngine {
  // Substitution
  findAlternatives(exerciseId: string, availableEquipment: string[]): Promise<AlternativeExercise[]>;
  convertWeight(sourceExercise: string, targetExercise: string, weight: number): number;
  
  // Learning
  recordSubstitutionPreference(userId: string, original: string, substitute: string, rating: number): Promise<void>;
  getPersonalizedAlternatives(userId: string, exerciseId: string, availableEquipment: string[]): Promise<AlternativeExercise[]>;
}

interface AlternativeExercise {
  exerciseId: string;
  similarityScore: number;  // 0-1
  muscleActivationMatch: number;  // 0-1
  movementPatternMatch: boolean;
  loadConversionFactor: number;
}
```

#### Nutrition Engine
```typescript
interface NutritionEngine {
  // Food Logging
  logFood(userId: string, entry: FoodEntry): Promise<NutritionLog>;
  parseFoodEntry(text: string): Promise<ParsedFood>;
  getQuickAddFoods(userId: string): Promise<FoodItem[]>;
  
  // Targets
  getDailyTargets(userId: string): Promise<DailyTargets>;
  getRemainingMacros(userId: string, date: Date): Promise<MacroRemaining>;
  
  // Suggestions
  suggestProteinFoods(userId: string, gap: number): Promise<FoodSuggestion[]>;
}

interface FoodEntry {
  foodId?: string;
  description: string;
  servings: number;
  loggedAt: Date;
}

interface NutritionLog {
  id: string;
  userId: string;
  date: Date;
  entries: LogEntry[];
  totals: MacroTotals;
}

interface MacroTotals {
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
}
```

#### Daily Plan Generator
```typescript
interface DailyPlanGenerator {
  generateDailyPlan(userId: string, date: Date): Promise<DailyPlan>;
  adjustForFatigue(userId: string, plan: DailyPlan, fatigueLevel: number): DailyPlan;
  redistributeVolume(userId: string, missedDays: number[]): Promise<WorkoutPlan>;
}

interface DailyPlan {
  date: Date;
  userId: string;
  workout: PlannedWorkout | null;
  calorieTarget: number;
  proteinTarget: number;
  fatigueAdjustment?: 'reduced' | 'rest';
}

interface PlannedWorkout {
  planId: string;
  dayIndex: number;
  suggestedStartingWeights: Map<string, number>;
}
```

#### Coach Engine
```typescript
interface CoachEngine {
  askQuestion(userId: string, question: string, context?: ConversationContext): Promise<CoachResponse>;
  getConversationHistory(sessionId: string): Promise<ConversationMessage[]>;
}

interface CoachResponse {
  answer: string;
  relatedData?: {
    exercises?: Exercise[];
    workouts?: WorkoutSession[];
    nutritionLogs?: NutritionLog[];
  };
  followUpQuestion?: string;
}

interface ConversationContext {
  sessionId: string;
  previousMessages: ConversationMessage[];
}
```

#### Monitoring Engine
```typescript
interface MonitoringEngine {
  // Tracking
  trackMetrics(userId: string, metrics: BodyMetrics): Promise<void>;
  getMetricHistory(userId: string, metricType: string, range: DateRange): Promise<MetricPoint[]>;
  
  // Reporting
  generateWeeklyReport(userId: string, weekStart: Date): Promise<WeeklyReport>;
  
  // Progress Detection
  detectProgressStatus(userId: string): Promise<ProgressStatus>;
  suggestInterventions(userId: string, status: ProgressStatus): Promise<Intervention[]>;
}

interface WeeklyReport {
  weekStart: Date;
  totalWorkouts: number;
  totalVolume: number;
  nutritionAdherence: number;  // percentage
  streakDays: number;
  progress: ProgressStatus;
}

interface ProgressStatus {
  status: 'progressing' | 'stagnant' | 'regressing';
  metrics: {
    weight?: TrendDirection;
    strength: TrendDirection;
    consistency: TrendDirection;
  };
}

type TrendDirection = 'increasing' | 'stable' | 'decreasing';
```

### Frontend Components

#### Screen Architecture

```
App
├── AuthProvider
├── Router
│   ├── HomeScreen
│   │   ├── DailyPlanCard
│   │   ├── StreakDisplay
│   │   └── QuickActions
│   ├── WorkoutScreen
│   │   ├── ActiveWorkoutView
│   │   │   ├── ExerciseDisplay
│   │   │   ├── SetLogger
│   │   │   └── RestTimer
│   │   └── WorkoutPreview
│   ├── ProgressScreen
│   │   ├── ProgressCharts
│   │   ├── WeeklyReport
│   │   └── StreakMilestones
│   ├── NutritionScreen
│   │   ├── MacroDisplay
│   │   ├── FoodLogger
│   │   └── QuickAddList
│   └── ProfileScreen
│       ├── ProfileForm
│       ├── EquipmentSelector
│       └── SettingsPanel
```

#### Component Interfaces

```typescript
// Home Screen Components
interface DailyPlanCardProps {
  plan: DailyPlan;
  onStartWorkout: () => void;
  onLogNutrition: () => void;
}

interface StreakDisplayProps {
  currentStreak: number;
  milestone: number;
  showCelebration: boolean;
}

// Workout Screen Components
interface ExerciseDisplayProps {
  exercise: Exercise;
  currentSet: number;
  totalSets: number;
  weight: number;
  targetReps: number;
  demonstration: MediaReference;
}

interface SetLoggerProps {
  setNumber: number;
  suggestedWeight: number;
  targetReps: number;
  onComplete: (data: SetData) => void;
  onSkip: () => void;
}

interface RestTimerProps {
  duration: number;
  nextExercise?: Exercise;
  onComplete: () => void;
}

// Progress Screen Components
interface ProgressChartsProps {
  metrics: MetricType[];
  dateRange: DateRange;
  data: MetricPoint[];
}

// Nutrition Screen Components
interface MacroDisplayProps {
  consumed: MacroTotals;
  targets: DailyTargets;
  remaining: MacroRemaining;
}

interface FoodLoggerProps {
  onLog: (entry: FoodEntry) => void;
  recentFoods: FoodItem[];
}
```

## Data Models

### MongoDB Collections

#### users
```javascript
{
  _id: ObjectId,
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  profile: {
    height: Number,          // cm
    weight: Number,          // kg
    age: Number,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    fitnessGoal: { type: String, enum: ['muscle_gain', 'fat_loss', 'strength'] },
    experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    gymType: { type: String, enum: ['home', 'commercial', 'outdoor'] },
    availableEquipment: [String],
    trainingDaysPerWeek: Number
  },
  derivedMetrics: {
    bmi: Number,
    tdee: Number,
    dailyCalorieTarget: Number,
    dailyProteinTarget: Number,
    lastCalculated: Date
  },
  streak: {
    current: Number,
    longest: Number,
    lastActivityDate: Date,
    freezeUsed: { type: Boolean, default: false },
    freezeMonth: Number
  },
  preferences: {
    darkMode: { type: Boolean, default: true },
    hapticFeedback: { type: Boolean, default: true },
    reminderTime: String,  // "20:00"
    units: { type: String, enum: ['metric', 'imperial'], default: 'metric' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

// Indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ "streak.lastActivityDate": 1 });
```

#### exercises
```javascript
{
  _id: ObjectId,
  name: { type: String, required: true },
  movementPattern: { 
    type: String, 
    enum: ['push', 'pull', 'squat', 'hinge', 'lunge', 'carry'] 
  },
  primaryMuscles: [String],
  secondaryMuscles: [String],
  equipment: [String],
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
  instructions: {
    setup: [String],
    execution: [String],
    breathing: [String]
  },
  commonMistakes: [String],
  safetyWarnings: [String],
  alternatives: [{
    exerciseId: ObjectId,
    similarityScore: Number,
    loadConversionFactor: Number
  }],
  media: {
    videoUrl: String,
    animationUrl: String,
    thumbnailUrl: String
  },
  isActive: { type: Boolean, default: true }
}

// Indexes
db.exercises.createIndex({ name: 1 });
db.exercises.createIndex({ movementPattern: 1 });
db.exercises.createIndex({ equipment: 1 });
db.exercises.createIndex({ primaryMuscles: 1 });
```

#### workout_plans
```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users' },
  name: String,
  goal: { type: String, enum: ['muscle_gain', 'fat_loss', 'strength'] },
  days: [{
    dayOfWeek: { type: Number, min: 0, max: 6 },
    name: String,
    exercises: [{
      exerciseId: { type: ObjectId, ref: 'exercises' },
      sets: Number,
      repsMin: Number,
      repsMax: Number,
      restSeconds: Number,
      notes: String,
      order: Number
    }],
    estimatedDuration: Number
  }],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}

// Indexes
db.workout_plans.createIndex({ userId: 1, active: 1 });
db.workout_plans.createIndex({ userId: 1, createdAt: -1 });
```

#### workout_sessions
```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users' },
  planId: { type: ObjectId, ref: 'workout_plans' },
  dayIndex: Number,
  startTime: { type: Date, required: true },
  endTime: Date,
  status: { type: String, enum: ['active', 'completed', 'abandoned'] },
  exercises: [{
    exerciseId: { type: ObjectId, ref: 'exercises' },
    plannedSets: Number,
    sets: [{
      setNumber: Number,
      weight: Number,
      reps: Number,
      completedAt: Date,
      difficultyRating: { type: Number, min: 1, max: 5 }
    }],
    skipped: { type: Boolean, default: false },
    skipReason: String
  }],
  totalVolume: Number,
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    notes: String
  }
}

// Indexes
db.workout_sessions.createIndex({ userId: 1, startTime: -1 });
db.workout_sessions.createIndex({ userId: 1, status: 1 });
db.workout_sessions.createIndex({ planId: 1 });
```

#### progression_history
```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users' },
  exerciseId: { type: ObjectId, ref: 'exercises' },
  date: { type: Date, required: true },
  weight: Number,
  sets: Number,
  reps: Number,
  totalVolume: Number,
  progressionApplied: Boolean,
  progressionAmount: Number,
  plateauDetected: Boolean
}

// Indexes
db.progression_history.createIndex({ userId: 1, exerciseId: 1, date: -1 });
db.progression_history.createIndex({ userId: 1, date: -1 });
```

#### nutrition_logs
```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users' },
  date: { type: Date, required: true },
  entries: [{
    foodId: { type: ObjectId, ref: 'food_db' },
    description: String,
    servings: Number,
    calories: Number,
    protein: Number,
    carbohydrates: Number,
    fats: Number,
    loggedAt: { type: Date, default: Date.now }
  }],
  totals: {
    calories: Number,
    protein: Number,
    carbohydrates: Number,
    fats: Number
  }
}

// Indexes
db.nutrition_logs.createIndex({ userId: 1, date: -1 });
db.nutrition_logs.createIndex({ userId: 1, "entries.foodId": 1 });
```

#### food_db
```javascript
{
  _id: ObjectId,
  name: { type: String, required: true },
  category: String,
  servingSize: {
    amount: Number,
    unit: String
  },
  macros: {
    calories: Number,
    protein: Number,
    carbohydrates: Number,
    fats: Number
  },
  isIndian: { type: Boolean, default: false },
  isCommon: { type: Boolean, default: false }
}

// Indexes
db.food_db.createIndex({ name: 1 });
db.food_db.createIndex({ category: 1 });
db.food_db.createIndex({ isCommon: 1 });
```

#### feedback_logs
```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users' },
  timestamp: { type: Date, default: Date.now },
  inputType: { 
    type: String, 
    enum: ['workout_complete', 'food_log', 'question', 'substitution', 'profile_update'] 
  },
  inputData: mongoose.Schema.Types.Mixed,
  analysisResult: mongoose.Schema.Types.Mixed,
  decision: {
    type: String,
    reasoning: String
  },
  action: mongoose.Schema.Types.Mixed,
  feedback: {
    userResponse: String,
    satisfaction: { type: Number, min: 1, max: 5 }
  },
  memoryUpdate: mongoose.Schema.Types.Mixed
}

// Indexes
db.feedback_logs.createIndex({ userId: 1, timestamp: -1 });
db.feedback_logs.createIndex({ inputType: 1 });
```

#### coach_conversations
```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'users' },
  sessionId: String,
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  context: {
    referencedExercises: [ObjectId],
    referencedWorkouts: [ObjectId],
    referencedNutrition: [ObjectId]
  },
  createdAt: { type: Date, default: Date.now }
}

// Indexes
db.coach_conversations.createIndex({ userId: 1, createdAt: -1 });
db.coach_conversations.createIndex({ sessionId: 1 });
```

### Entity Relationships

```
users ─────────────────────────────────────────────────────────────────┐
   │                                                                   │
   ├── 1:N ── workout_plans                                           │
   │              │                                                    │
   │              └── N:N ── exercises (via workout_plans.days.exercises)
   │                                                                   │
   ├── 1:N ── workout_sessions                                        │
   │              │                                                    │
   │              └── N:1 ── workout_plans                            │
   │              └── N:N ── exercises (via exercises.exerciseId)     │
   │                                                                   │
   ├── 1:N ── progression_history                                     │
   │              │                                                    │
   │              └── N:1 ── exercises                                │
   │                                                                   │
   ├── 1:N ── nutrition_logs                                          │
   │              │                                                    │
   │              └── N:N ── food_db (via entries.foodId)             │
   │                                                                   │
   ├── 1:N ── feedback_logs                                           │
   │                                                                   │
   └── 1:N ── coach_conversations                                     │
                                                                       │
exercises ─────────────────────────────────────────────────────────────┤
   │                                                                   │
   └── 1:N ── self-referential alternatives                           │
                                                                       │
food_db ───────────────────────────────────────────────────────────────┘
```
## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Profile Completeness

*For any* newly registered user, the profile shall contain all required fields: height, weight, age, gender, fitness goal, experience level, and gym type with available equipment.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Derived Metrics Calculation

*For any* user profile with valid height and weight, the system shall calculate BMI as weight/(height/100)² and TDEE using the Mifflin-St Jeor equation, with calorie targets adjusted by goal (surplus for muscle_gain, deficit for fat_loss, maintenance for strength).

**Validates: Requirements 1.5, 7.2**

### Property 3: Profile Update Triggers Recalculation

*For any* profile update that changes weight, height, age, or goal, the system shall recalculate all derived metrics (BMI, TDEE, calorie target, protein target) and persist the updated values.

**Validates: Requirements 1.4**

### Property 4: Exercise Data Completeness

*For any* exercise in the database, the system shall store name, movement pattern, primary muscles, equipment requirements, difficulty level, instructions (setup, execution, breathing), common mistakes, safety warnings, and media references.

**Validates: Requirements 2.1, 2.2, 2.3, 2.6**

### Property 5: Exercise Alternatives Availability

*For any* exercise requiring specific equipment, the system shall store at least 3 ranked alternative exercises with similarity scores and load conversion factors.

**Validates: Requirements 2.4, 2.5**

### Property 6: Workout Plan Respects Constraints

*For any* generated workout plan, all exercises shall use only equipment marked as available for that user, and rep ranges shall match the user's goal (6-10 for muscle_gain, 1-5 for strength, 12-15 for fat_loss).

**Validates: Requirements 3.1, 3.4, 3.6**

### Property 7: Beginner Workout Constraints

*For any* workout plan generated for a beginner user, the plan shall contain 3-4 training days per week and focus on fundamental compound movements.

**Validates: Requirements 3.3**

### Property 8: Weekly Volume Within Range

*For any* active workout plan, the total weekly sets per muscle group shall fall within the range of 10-20 sets.

**Validates: Requirements 3.5**

### Property 9: Session Start Returns First Exercise

*For any* workout session start request, the system shall return the first exercise with demonstration media, setup instructions, weight, target reps, and key cues.

**Validates: Requirements 4.1, 4.2**

### Property 10: Set Completion Captures Data

*For any* set completion, the system shall require and store weight used, reps completed, and timestamp, updating the session state accordingly.

**Validates: Requirements 4.3**

### Property 11: Weight Adjustment Suggestion

*For any* set where the user reports difficulty (RPE ≥ 4), the system shall suggest a weight reduction of 5-10% for subsequent sets of the same exercise.

**Validates: Requirements 4.4**

### Property 12: Skip Exercise Logs and Adjusts

*For any* exercise skip action, the system shall log the skip with reason and update the session to reflect the remaining exercises.

**Validates: Requirements 4.6**

### Property 13: Volume Calculation Correctness

*For any* workout session, the total volume shall equal the sum of (sets × reps × weight) for all completed sets across all exercises.

**Validates: Requirements 5.1**

### Property 14: Progression Trigger

*For any* exercise where a user successfully completes all prescribed sets and reps for 2 consecutive sessions, the system shall increase the working weight by 2.5-5% for the next session.

**Validates: Requirements 5.2**

### Property 15: Plateau Detection

*For any* exercise where a user fails to complete prescribed volume for 2 consecutive sessions, the system shall flag the exercise as plateaued and suggest deload or variation.

**Validates: Requirements 5.3, 5.5**

### Property 16: Progression History Persistence

*For any* completed workout session, the system shall persist progression history entries for each exercise with date, weight, sets, reps, and volume.

**Validates: Requirements 5.6**

### Property 17: Substitution Ranking

*For any* substitution request, the system shall return alternatives ranked by movement pattern similarity, muscle activation match, and equipment availability, with at most 3 options displayed.

**Validates: Requirements 6.2, 6.3**

### Property 18: Weight Conversion

*For any* selected exercise substitution, the system shall convert the working weight using the stored load conversion factor between the original and alternative exercise.

**Validates: Requirements 6.4**

### Property 19: Substitution Learning

*For any* recorded substitution preference, the system shall adjust future alternative rankings to prioritize preferred substitutions for that user.

**Validates: Requirements 6.6**

### Property 20: Food Logging Extracts Macros

*For any* food log entry, the system shall extract and store calories, protein, carbohydrates, and fats from the food database or parsed input.

**Validates: Requirements 7.1**

### Property 21: Protein Target for Muscle Gain

*For any* user with muscle_gain goal, the daily protein target shall be set within the range of 1.6-2.2g per kg of bodyweight.

**Validates: Requirements 7.3**

### Property 22: Protein Gap Suggestions

*For any* day where protein intake is below 80% of target, the system shall suggest protein-rich foods to close the gap.

**Validates: Requirements 7.5**

### Property 23: Quick-Add from Frequent Foods

*For any* user with repeated food logs, the system shall offer quick-add options for foods logged more than 3 times in the past 30 days.

**Validates: Requirements 7.7**

### Property 24: Daily Plan Contains Required Elements

*For any* daily plan, the system shall include workout (if scheduled for that day), calorie target, and protein target.

**Validates: Requirements 8.1**

### Property 25: Starting Weights from History

*For any* workout in a daily plan, the suggested starting weights shall be based on the user's previous session performance for each exercise.

**Validates: Requirements 8.4**

### Property 26: Fatigue Adjustment

*For any* user reporting high fatigue, the daily plan shall either reduce session intensity by 20% or suggest a rest day.

**Validates: Requirements 8.6**

### Property 27: Coach Response Uses User Context

*For any* question to the coach, the response shall reference the user's goals, experience level, and available equipment where relevant.

**Validates: Requirements 9.1, 9.2**

### Property 28: Form Question Returns Exercise Cues

*For any* question about exercise form, the coach shall reference the specific exercise from the user's workout and provide targeted cues.

**Validates: Requirements 9.3**

### Property 29: Conversation Context Continuity

*For any* follow-up question within a conversation session, the coach shall maintain context from previous messages in that session.

**Validates: Requirements 9.5**

### Property 30: Weekly Report Completeness

*For any* weekly report, the system shall include total workouts completed, total volume lifted, nutrition adherence percentage, and streak days.

**Validates: Requirements 10.2**

### Property 31: Progress Status Detection

*For any* user with at least 2 weeks of data, the system shall correctly classify progress status as progressing (consistent improvement), stagnant (no change for 2+ weeks), or regressing (consistent decline).

**Validates: Requirements 10.3**

### Property 32: Streak Calculation

*For any* user, the current streak shall equal the count of consecutive days with either workout completion or food logging, ending on the most recent activity date.

**Validates: Requirements 15.1**

### Property 33: Streak Milestone Detection

*For any* streak that reaches 7 days, the system shall flag a milestone celebration. For any streak that reaches 30 days, the system shall unlock an achievement badge.

**Validates: Requirements 15.2, 15.5**

### Property 34: Streak Freeze Offer

*For any* broken streak where the user has not used a streak freeze in the current month, the system shall offer a streak freeze option.

**Validates: Requirements 15.3**

### Property 35: Password Hashing

*For any* stored password, the system shall use bcrypt hashing with a minimum of 12 salt rounds.

**Validates: Requirements 12.2**

### Property 36: JWT Expiration

*For any* issued JWT, the token shall expire 7 days after issuance.

**Validates: Requirements 12.3**

### Property 37: Rate Limiting

*For any* authentication endpoint, the system shall reject requests exceeding 5 attempts per minute from the same IP address.

**Validates: Requirements 12.5**

### Property 38: API Error Responses

*For any* API error, the response shall include an appropriate HTTP status code (4xx for client errors, 5xx for server errors) and a descriptive error message.

**Validates: Requirements 13.2**

### Property 39: Pagination Default

*For any* list endpoint, the default page size shall be 20 items unless otherwise specified.

**Validates: Requirements 13.3**

### Property 40: JWT Validation

*For any* protected endpoint, the system shall reject requests with invalid, expired, or missing JWT tokens with HTTP 401 status.

**Validates: Requirements 13.4**

### Property 41: Closed-Loop Event Logging

*For any* user input, the system shall log an INPUT event with timestamp, perform analysis, log the DECISION with reasoning, execute the action, capture FEEDBACK, and update user MEMORY accordingly.

**Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

### Property 42: Feedback-Driven Parameter Adjustment

*For any* feedback indicating user dissatisfaction (rating ≤ 2), the system shall adjust decision parameters to reduce likelihood of similar dissatisfaction in future interactions.

**Validates: Requirements 14.6**

## Error Handling

### Error Categories

#### Client Errors (4xx)

| Status Code | Error Type | Description | Example |
|-------------|------------|-------------|---------|
| 400 | ValidationError | Invalid request data | Missing required field, invalid email format |
| 401 | AuthenticationError | Invalid or missing JWT | Token expired, malformed token |
| 403 | AuthorizationError | Insufficient permissions | Accessing another user's data |
| 404 | NotFoundError | Resource not found | Exercise ID doesn't exist |
| 409 | ConflictError | Resource conflict | Email already registered |
| 422 | BusinessRuleError | Business rule violation | Cannot start session without active plan |
| 429 | RateLimitError | Too many requests | Auth rate limit exceeded |

#### Server Errors (5xx)

| Status Code | Error Type | Description | Handling |
|-------------|------------|-------------|----------|
| 500 | InternalServerError | Unexpected server error | Log error, return generic message |
| 503 | ServiceUnavailable | External service down | AI coach unavailable, database timeout |

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;        // "VALIDATION_ERROR"
    message: string;     // "Height is required"
    details?: object;    // Additional context
    requestId: string;   // For debugging
  };
}
```

### Error Handling Strategies

#### Input Validation
- All inputs validated at API boundary using Joi/Zod schemas
- Validation errors return 400 with field-specific messages
- Sanitize inputs to prevent injection attacks

#### Database Errors
- Unique constraint violations return 409 Conflict
- Foreign key violations return 422 BusinessRuleError
- Connection errors return 503 ServiceUnavailable

#### Business Logic Errors
- Precondition checks before state mutations
- Clear error messages explaining what went wrong
- Suggested actions when possible

#### Graceful Degradation
- If AI coach is unavailable, return cached responses or generic advice
- If exercise database query fails, return basic exercise info
- If nutrition parsing fails, allow manual macro entry

### Error Logging

```typescript
interface ErrorLog {
  timestamp: Date;
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  context: {
    userId?: string;
    requestId: string;
    endpoint: string;
    method: string;
    requestBody?: object;  // Sanitized
  };
}
```

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to achieve comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
- **Property Tests**: Verify universal properties across all valid inputs

### Property-Based Testing Configuration

- **Library**: fast-check for JavaScript/TypeScript
- **Minimum Iterations**: 100 per property test
- **Test Tag Format**: `Feature: ai-fitness-coach, Property {number}: {property_name}`

### Unit Testing Focus Areas

#### Authentication & Security
- Password hashing with bcrypt
- JWT generation and validation
- Rate limiting enforcement
- Token expiration handling

#### API Endpoints
- Request validation
- Response formatting
- Error handling
- Pagination

#### Business Logic
- Workout plan generation
- Progression calculations
- Volume tracking
- Streak calculations

### Property-Based Testing Focus Areas

#### Profile Management
```typescript
// Property 2: Derived Metrics Calculation
fc.assert(
  fc.property(
    fc.record({
      height: fc.integer({ min: 100, max: 250 }),
      weight: fc.integer({ min: 30, max: 300 }),
      age: fc.integer({ min: 13, max: 100 }),
      gender: fc.constantFrom('male', 'female', 'other'),
      goal: fc.constantFrom('muscle_gain', 'fat_loss', 'strength')
    }),
    (profile) => {
      const bmi = calculateBMI(profile.height, profile.weight);
      const tdee = calculateTDEE(profile);
      const target = calculateCalorieTarget(profile, profile.goal);
      
      // BMI should be weight/(height in meters)²
      expect(bmi).toBeCloseTo(profile.weight / Math.pow(profile.height / 100, 2), 2);
      
      // TDEE should be positive
      expect(tdee).toBeGreaterThan(0);
      
      // Calorie target should reflect goal
      if (profile.goal === 'muscle_gain') expect(target).toBeGreaterThan(tdee);
      if (profile.goal === 'fat_loss') expect(target).toBeLessThan(tdee);
    }
  ),
  { numRuns: 100 }
);
```

#### Workout Generation
```typescript
// Property 6: Workout Plan Respects Constraints
fc.assert(
  fc.property(
    fc.record({
      goal: fc.constantFrom('muscle_gain', 'fat_loss', 'strength'),
      experienceLevel: fc.constantFrom('beginner', 'intermediate', 'advanced'),
      availableEquipment: fc.array(fc.string())
    }),
    async (constraints) => {
      const plan = await workoutEngine.generatePlan(constraints);
      
      // All exercises use available equipment
      for (const day of plan.days) {
        for (const exercise of day.exercises) {
          const exerciseData = await getExercise(exercise.exerciseId);
          const hasAvailableEquipment = exerciseData.equipment.every(
            e => constraints.availableEquipment.includes(e)
          );
          expect(hasAvailableEquipment).toBe(true);
        }
      }
      
      // Rep ranges match goal
      for (const day of plan.days) {
        for (const exercise of day.exercises) {
          if (constraints.goal === 'muscle_gain') {
            expect(exercise.repsMin).toBeGreaterThanOrEqual(6);
            expect(exercise.repsMax).toBeLessThanOrEqual(10);
          }
          if (constraints.goal === 'strength') {
            expect(exercise.repsMin).toBeGreaterThanOrEqual(1);
            expect(exercise.repsMax).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  ),
  { numRuns: 100 }
);
```

#### Volume Calculation
```typescript
// Property 13: Volume Calculation Correctness
fc.assert(
  fc.property(
    fc.array(
      fc.record({
        sets: fc.integer({ min: 1, max: 10 }),
        reps: fc.integer({ min: 1, max: 30 }),
        weight: fc.integer({ min: 0, max: 500 })
      })
    ),
    (exercises) => {
      const volume = calculateTotalVolume(exercises);
      const expectedVolume = exercises.reduce(
        (sum, ex) => sum + (ex.sets * ex.reps * ex.weight), 0
      );
      expect(volume).toBe(expectedVolume);
    }
  ),
  { numRuns: 100 }
);
```

#### Progression Logic
```typescript
// Property 14: Progression Trigger
fc.assert(
  fc.property(
    fc.record({
      consecutiveSuccesses: fc.integer({ min: 0, max: 10 }),
      currentWeight: fc.integer({ min: 20, max: 500 })
    }),
    (data) => {
      const result = checkProgression(data.consecutiveSuccesses, data.currentWeight);
      
      if (data.consecutiveSuccesses >= 2) {
        expect(result.eligibleForIncrease).toBe(true);
        expect(result.suggestedIncrease).toBeGreaterThanOrEqual(0.025);
        expect(result.suggestedIncrease).toBeLessThanOrEqual(0.05);
      } else {
        expect(result.eligibleForIncrease).toBe(false);
      }
    }
  ),
  { numRuns: 100 }
);
```

### Test Coverage Targets

| Category | Target Coverage |
|----------|-----------------|
| Critical Paths | 100% |
| Business Logic | 90% |
| API Endpoints | 85% |
| Utility Functions | 80% |

### Integration Testing

- API endpoint integration with database
- Service layer integration
- Authentication flow end-to-end
- Workout session lifecycle

### Performance Testing

- API response time < 200ms for read operations
- API response time < 500ms for write operations
- Workout generation < 2 seconds
- Substitution lookup < 2 seconds