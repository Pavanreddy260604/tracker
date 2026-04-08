# Implementation Plan: AI Fitness Coach

## Overview

This implementation plan covers building a full-stack AI Fitness Coach application with React frontend, Node.js/Express backend, and MongoDB database. The system implements a closed-loop architecture for intelligent fitness coaching with progressive overload, exercise substitution, and nutrition tracking.

## Tasks

- [ ] 1. Set up project structure and core infrastructure
  - [ ] 1.1 Initialize backend project with Express.js and TypeScript
    - Create backend directory with package.json, tsconfig.json
    - Set up Express server with middleware (cors, helmet, express.json)
    - Configure environment variables and database connection
    - _Requirements: 12.1, 13.1_
  
  - [ ] 1.2 Initialize frontend project with React and Vite
    - Create frontend directory with Vite + React + TypeScript
    - Configure Tailwind CSS with dark theme
    - Set up React Router for 5 primary screens
    - _Requirements: 11.1, 11.3_
  
  - [ ] 1.3 Set up testing frameworks
    - Configure Jest for backend unit tests
    - Configure Vitest for frontend tests
    - Set up fast-check for property-based testing
    - _Requirements: 12.1_

- [ ] 2. Implement database models and migrations
  - [ ] 2.1 Create User model with profile and derived metrics
    - Define Mongoose schema for users collection
    - Include profile fields, derived metrics, streak, preferences
    - Create indexes for email and streak queries
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 15.1_
  
  - [ ] 2.2 Create Exercise model with alternatives
    - Define Mongoose schema for exercises collection
    - Include movement pattern, muscles, equipment, instructions, media
    - Create indexes for movement pattern, equipment, muscles
    - _Requirements: 2.1, 2.2, 2.3, 2.6_
  
  - [ ] 2.3 Create WorkoutPlan and WorkoutSession models
    - Define Mongoose schema for workout_plans collection
    - Define Mongoose schema for workout_sessions collection
    - Create indexes for userId, status, and date queries
    - _Requirements: 3.1, 4.1, 5.1_
  
  - [ ] 2.4 Create Nutrition and Food models
    - Define Mongoose schema for nutrition_logs collection
    - Define Mongoose schema for food_db collection
    - Create indexes for userId, date, and food queries
    - _Requirements: 7.1, 7.4_
  
  - [ ] 2.5 Create ProgressionHistory and FeedbackLog models
    - Define Mongoose schema for progression_history collection
    - Define Mongoose schema for feedback_logs collection
    - Define Mongoose schema for coach_conversations collection
    - _Requirements: 5.6, 14.1, 9.5_

- [ ] 3. Implement authentication and security
  - [ ] 3.1 Create authentication service with bcrypt and JWT
    - Implement password hashing with bcrypt (12 salt rounds minimum)
    - Implement JWT generation with 7-day expiration
    - Create auth middleware for protected routes
    - _Requirements: 12.2, 12.3, 13.4_
  
  - [ ]* 3.2 Write property tests for authentication
    - **Property 35: Password Hashing** - Verify all stored passwords use bcrypt with 12+ salt rounds
    - **Property 36: JWT Expiration** - Verify all issued JWTs expire 7 days after issuance
    - **Property 40: JWT Validation** - Verify protected endpoints reject invalid/expired/missing tokens
    - **Validates: Requirements 12.2, 12.3, 13.4**
  
  - [ ] 3.3 Implement rate limiting middleware
    - Add express-rate-limit for authentication endpoints
    - Configure 5 attempts per minute limit
    - Return 429 status for exceeded limits
    - _Requirements: 12.5_
  
  - [ ]* 3.4 Write property test for rate limiting
    - **Property 37: Rate Limiting** - Verify auth endpoints reject requests exceeding 5 attempts per minute
    - **Validates: Requirements 12.5**

- [ ] 4. Implement User Profile Engine
  - [ ] 4.1 Create user profile service and controller
    - Implement createProfile, updateProfile, getProfile methods
    - Calculate derived metrics (BMI, TDEE, calorie/protein targets)
    - Trigger recalculation on profile updates
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 4.2 Write property tests for derived metrics
    - **Property 1: Profile Completeness** - Verify new users have all required profile fields
    - **Property 2: Derived Metrics Calculation** - Verify BMI and TDEE calculations are correct
    - **Property 3: Profile Update Triggers Recalculation** - Verify metrics recalculate on profile change
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 7.2**
  
  - [ ] 4.3 Create profile API endpoints
    - POST /api/v1/auth/register - User registration
    - POST /api/v1/auth/login - User login
    - GET /api/v1/profile - Get current user profile
    - PUT /api/v1/profile - Update profile
    - _Requirements: 13.1, 13.4_

- [ ] 5. Implement Exercise Intelligence Database
  - [ ] 5.1 Create exercise service with alternatives logic
    - Implement getExercise, listExercises, findAlternatives methods
    - Include load conversion logic for equipment variations
    - Rank alternatives by similarity score
    - _Requirements: 2.1, 2.4, 2.5_
  
  - [ ]* 5.2 Write property tests for exercise data
    - **Property 4: Exercise Data Completeness** - Verify exercises have all required fields
    - **Property 5: Exercise Alternatives Availability** - Verify exercises have 3+ ranked alternatives
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
  
  - [ ] 5.3 Create exercise API endpoints
    - GET /api/v1/exercises - List exercises (with pagination)
    - GET /api/v1/exercises/:id - Get exercise details
    - GET /api/v1/exercises/:id/alternatives - Get alternatives
    - _Requirements: 13.1, 13.3_

- [ ] 6. Implement Workout Engine
  - [ ] 6.1 Create workout plan generation service
    - Implement generateWorkoutPlan based on goal, equipment, experience
    - Distribute exercises across movement patterns
    - Assign rep ranges based on goal (6-10 hypertrophy, 1-5 strength, 12-15 endurance)
    - Calculate weekly volume per muscle group
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 6.2 Write property tests for workout generation
    - **Property 6: Workout Plan Respects Constraints** - Verify exercises use available equipment and correct rep ranges
    - **Property 7: Beginner Workout Constraints** - Verify beginners get 3-4 days with compound movements
    - **Property 8: Weekly Volume Within Range** - Verify 10-20 sets per muscle group per week
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6**
  
  - [ ] 6.3 Create workout plan API endpoints
    - POST /api/v1/workout-plans - Generate new plan
    - GET /api/v1/workout-plans - List user's plans
    - GET /api/v1/workout-plans/active - Get active plan
    - GET /api/v1/workout-plans/:id - Get specific plan
    - _Requirements: 13.1, 13.3_

- [ ] 7. Implement Execution Engine
  - [ ] 7.1 Create workout session service
    - Implement startSession, getSession, completeSession methods
    - Implement set completion with weight and reps logging
    - Implement skip exercise with reason logging
    - _Requirements: 4.1, 4.3, 4.6_
  
  - [ ]* 7.2 Write property tests for session management
    - **Property 9: Session Start Returns First Exercise** - Verify session start returns exercise with all required data
    - **Property 10: Set Completion Captures Data** - Verify set completion stores weight, reps, timestamp
    - **Property 12: Skip Exercise Logs and Adjusts** - Verify skip logs reason and updates session
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6**
  
  - [ ] 7.3 Implement weight adjustment suggestions
    - Calculate weight reduction (5-10%) for high difficulty (RPE ≥ 4)
    - Suggest adjustments for subsequent sets
    - _Requirements: 4.4_
  
  - [ ]* 7.4 Write property test for weight adjustment
    - **Property 11: Weight Adjustment Suggestion** - Verify high RPE triggers 5-10% weight reduction suggestion
    - **Validates: Requirements 4.4**
  
  - [ ] 7.5 Create workout session API endpoints
    - POST /api/v1/sessions - Start workout session
    - GET /api/v1/sessions/:id - Get session state
    - POST /api/v1/sessions/:id/sets - Complete a set
    - POST /api/v1/sessions/:id/skip - Skip exercise
    - POST /api/v1/sessions/:id/complete - Complete session
    - _Requirements: 13.1_

- [ ] 8. Implement Progression Engine
  - [ ] 8.1 Create progression tracking service
    - Implement volume calculation (sets × reps × weight)
    - Track consecutive successes/failures per exercise
    - Implement progression eligibility check (2 consecutive successes)
    - Apply 2.5-5% weight increase for eligible exercises
    - _Requirements: 5.1, 5.2_
  
  - [ ]* 8.2 Write property tests for progression
    - **Property 13: Volume Calculation Correctness** - Verify volume = sum(sets × reps × weight)
    - **Property 14: Progression Trigger** - Verify 2 consecutive successes triggers 2.5-5% increase
    - **Property 15: Plateau Detection** - Verify 2 consecutive failures flags plateau
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**
  
  - [ ] 8.3 Implement plateau detection and deload suggestions
    - Detect plateau from consecutive failures
    - Suggest deload or exercise variation
    - Maintain progression history per exercise
    - _Requirements: 5.3, 5.5, 5.6_
  
  - [ ]* 8.4 Write property test for progression history
    - **Property 16: Progression History Persistence** - Verify completed sessions persist progression entries
    - **Validates: Requirements 5.6**

- [ ] 9. Implement Substitution Engine
  - [ ] 9.1 Create exercise substitution service
    - Implement findAlternatives with ranking by similarity
    - Implement weight conversion using load conversion factors
    - Return top 3 alternatives with similarity scores
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 9.2 Write property tests for substitution
    - **Property 17: Substitution Ranking** - Verify alternatives ranked by similarity, muscle activation, equipment
    - **Property 18: Weight Conversion** - Verify weight converted using load conversion factor
    - **Validates: Requirements 6.2, 6.3, 6.4**
  
  - [ ] 9.3 Implement substitution preference learning
    - Record user substitution preferences
    - Adjust future rankings based on preferences
    - _Requirements: 6.6_
  
  - [ ]* 9.4 Write property test for substitution learning
    - **Property 19: Substitution Learning** - Verify preferences adjust future alternative rankings
    - **Validates: Requirements 6.6**
  
  - [ ] 9.5 Create substitution API endpoints
    - GET /api/v1/exercises/:id/substitutes - Get alternatives
    - POST /api/v1/substitutions/preference - Record preference
    - _Requirements: 13.1_

- [ ] 10. Implement Nutrition Engine
  - [ ] 10.1 Create nutrition logging service
    - Implement logFood with macro extraction
    - Calculate daily totals for calories, protein, carbs, fats
    - Set protein target (1.6-2.2g/kg for muscle_gain)
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ]* 10.2 Write property tests for nutrition
    - **Property 20: Food Logging Extracts Macros** - Verify food entries extract all macros
    - **Property 21: Protein Target for Muscle Gain** - Verify protein target is 1.6-2.2g/kg
    - **Validates: Requirements 7.1, 7.3**
  
  - [ ] 10.3 Implement nutrition suggestions and quick-add
    - Suggest protein foods when intake below 80% of target
    - Track frequent foods for quick-add (3+ logs in 30 days)
    - Calculate remaining macros for the day
    - _Requirements: 7.5, 7.6, 7.7_
  
  - [ ]* 10.4 Write property tests for nutrition suggestions
    - **Property 22: Protein Gap Suggestions** - Verify suggestions when protein below 80% target
    - **Property 23: Quick-Add from Frequent Foods** - Verify quick-add for 3+ logged foods
    - **Validates: Requirements 7.5, 7.7**
  
  - [ ] 10.5 Create nutrition API endpoints
    - POST /api/v1/nutrition/logs - Log food entry
    - GET /api/v1/nutrition/logs - Get daily log
    - GET /api/v1/nutrition/targets - Get daily targets
    - GET /api/v1/nutrition/remaining - Get remaining macros
    - GET /api/v1/nutrition/quick-add - Get quick-add foods
    - _Requirements: 13.1_

- [ ] 11. Implement Daily Plan Generator
  - [ ] 11.1 Create daily plan generation service
    - Generate daily plan with workout, calorie target, protein target
    - Suggest starting weights from previous session
    - Adjust for fatigue (reduce intensity 20% or suggest rest)
    - _Requirements: 8.1, 8.4, 8.6_
  
  - [ ]* 11.2 Write property tests for daily plan
    - **Property 24: Daily Plan Contains Required Elements** - Verify plan includes workout, calories, protein
    - **Property 25: Starting Weights from History** - Verify weights based on previous session
    - **Property 26: Fatigue Adjustment** - Verify high fatigue reduces intensity or suggests rest
    - **Validates: Requirements 8.1, 8.4, 8.6**
  
  - [ ] 11.3 Create daily plan API endpoint
    - GET /api/v1/daily-plan - Get today's plan
    - GET /api/v1/daily-plan/:date - Get plan for specific date
    - _Requirements: 13.1_

- [ ] 12. Implement Coach Engine
  - [ ] 12.1 Create coach Q&A service
    - Implement askQuestion with user context analysis
    - Reference user goals, experience, equipment in responses
    - Maintain conversation context for follow-ups
    - _Requirements: 9.1, 9.2, 9.5_
  
  - [ ]* 12.2 Write property tests for coach
    - **Property 27: Coach Response Uses User Context** - Verify responses reference user context
    - **Property 28: Form Question Returns Exercise Cues** - Verify form questions return targeted cues
    - **Property 29: Conversation Context Continuity** - Verify follow-ups maintain context
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**
  
  - [ ] 12.3 Create coach API endpoints
    - POST /api/v1/coach/ask - Ask a question
    - GET /api/v1/coach/conversations/:sessionId - Get conversation history
    - _Requirements: 13.1_

- [ ] 13. Implement Monitoring Engine
  - [ ] 13.1 Create progress monitoring service
    - Track body weight, workout volume, strength metrics
    - Generate weekly reports (workouts, volume, nutrition adherence, streak)
    - Detect progress status (progressing, stagnant, regressing)
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ]* 13.2 Write property tests for monitoring
    - **Property 30: Weekly Report Completeness** - Verify reports include all required metrics
    - **Property 31: Progress Status Detection** - Verify correct status classification
    - **Validates: Requirements 10.2, 10.3**
  
  - [ ] 13.3 Implement streak tracking
    - Calculate consecutive days of engagement
    - Detect milestones (7 days, 30 days)
    - Offer streak freeze once per month
    - _Requirements: 15.1, 15.2, 15.3, 15.5_
  
  - [ ]* 13.4 Write property tests for streak
    - **Property 32: Streak Calculation** - Verify streak = consecutive activity days
    - **Property 33: Streak Milestone Detection** - Verify 7-day celebration, 30-day badge
    - **Property 34: Streak Freeze Offer** - Verify freeze offered once per month
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.5**
  
  - [ ] 13.5 Create monitoring API endpoints
    - POST /api/v1/monitoring/metrics - Log body metrics
    - GET /api/v1/monitoring/history - Get metric history
    - GET /api/v1/monitoring/weekly-report - Get weekly report
    - GET /api/v1/monitoring/progress - Get progress status
    - _Requirements: 13.1_

- [ ] 14. Implement Closed-Loop System
  - [ ] 14.1 Create feedback logging service
    - Log INPUT events with timestamp
    - Log DECISION events with reasoning
    - Capture FEEDBACK from user responses
    - Update user MEMORY based on feedback
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ]* 14.2 Write property tests for closed-loop
    - **Property 41: Closed-Loop Event Logging** - Verify all events logged correctly
    - **Property 42: Feedback-Driven Parameter Adjustment** - Verify dissatisfaction adjusts parameters
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6**

- [ ] 15. Checkpoint - Backend complete, verify all tests pass
  - Ensure all backend tests pass, ask the user if questions arise.

- [ ] 16. Implement frontend core infrastructure
  - [ ] 16.1 Create API client and auth context
    - Implement axios/fetch API client with JWT handling
    - Create AuthContext for user state management
    - Implement protected route wrapper
    - _Requirements: 12.3, 13.4_
  
  - [ ] 16.2 Create shared UI components
    - Create Button, Card, Input, Modal components
    - Implement dark theme with high contrast
    - Add haptic feedback utilities
    - _Requirements: 11.3, 11.7_

- [ ] 17. Implement Home Screen
  - [ ] 17.1 Create HomeScreen with daily plan display
    - Display daily workout, calorie target, protein target
    - Show current streak prominently
    - Implement quick action buttons (start workout, log food)
    - _Requirements: 8.5, 11.1, 15.4_
  
  - [ ] 17.2 Create DailyPlanCard component
    - Display workout preview or rest day message
    - Show macro progress rings
    - Handle start workout and log nutrition actions
    - _Requirements: 8.1, 8.5_
  
  - [ ] 17.3 Create StreakDisplay component
    - Show current streak count
    - Display milestone celebration animation
    - Show streak freeze option when applicable
    - _Requirements: 15.2, 15.3, 15.4_

- [ ] 18. Implement Workout Screen
  - [ ] 18.1 Create WorkoutScreen with session management
    - Display workout preview before starting
    - Handle session start/complete flow
    - Show active workout state
    - _Requirements: 4.1, 11.1_
  
  - [ ] 18.2 Create ActiveWorkoutView component
    - Show one action at a time with clear hierarchy
    - Display current exercise with all details
    - Handle set completion flow
    - _Requirements: 4.1, 4.2, 11.2, 11.6_
  
  - [ ] 18.3 Create ExerciseDisplay component
    - Show exercise demonstration (video/animation)
    - Display setup instructions and key cues
    - Show weight, reps, and set number
    - _Requirements: 4.2, 11.6_
  
  - [ ] 18.4 Create SetLogger component
    - Prompt for weight and reps on set completion
    - Allow difficulty rating (RPE 1-5)
    - Handle skip with reason
    - _Requirements: 4.3, 4.4, 4.6_
  
  - [ ] 18.5 Create RestTimer component
    - Display countdown timer
    - Show next exercise preview
    - Trigger haptic feedback on completion
    - _Requirements: 4.5, 11.7_

- [ ] 19. Implement Progress Screen
  - [ ] 19.1 Create ProgressScreen with charts
    - Display weight, volume, and strength charts
    - Allow date range selection
    - Show progress status indicator
    - _Requirements: 10.5, 11.1_
  
  - [ ] 19.2 Create ProgressCharts component
    - Render line charts for metrics over time
    - Support multiple metric types
    - Handle loading and error states
    - _Requirements: 10.1, 10.5_
  
  - [ ] 19.3 Create WeeklyReport component
    - Display total workouts, volume, nutrition adherence
    - Show streak days and milestone progress
    - Highlight interventions if stagnant/regressing
    - _Requirements: 10.2, 10.4_

- [ ] 20. Implement Nutrition Screen
  - [ ] 20.1 Create NutritionScreen with macro display
    - Show daily macro progress (calories, protein, carbs, fats)
    - Display remaining macros
    - Handle food logging flow
    - _Requirements: 7.6, 11.1_
  
  - [ ] 20.2 Create MacroDisplay component
    - Show circular progress for each macro
    - Display consumed vs target values
    - Highlight protein gap if below 80%
    - _Requirements: 7.6_
  
  - [ ] 20.3 Create FoodLogger component
    - Text input for food description
    - Quick-add list for frequent foods
    - Serving size adjustment
    - _Requirements: 7.1, 7.7_

- [ ] 21. Implement Profile Screen
  - [ ] 21.1 Create ProfileScreen with user settings
    - Display and edit profile information
    - Show derived metrics (BMI, TDEE, targets)
    - Handle equipment selection
    - _Requirements: 1.1, 1.2, 1.3, 11.1_
  
  - [ ] 21.2 Create ProfileForm component
    - Edit height, weight, age, gender
    - Select fitness goal and experience level
    - Update training days per week
    - _Requirements: 1.1, 1.4_
  
  - [ ] 21.3 Create EquipmentSelector component
    - Multi-select for available equipment
    - Group by gym type (home, commercial, outdoor)
    - Save to user profile
    - _Requirements: 1.3, 3.6_

- [ ] 22. Checkpoint - Frontend complete, verify integration
  - Ensure all frontend components render correctly, ask the user if questions arise.

- [ ] 23. Create seed data for exercises and foods
  - [ ] 23.1 Create exercise seed data
    - Add 50+ exercises covering all movement patterns
    - Include instructions, common mistakes, safety warnings
    - Link alternatives with similarity scores and conversion factors
    - Add video/animation URLs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  
  - [ ] 23.2 Create food database seed data
    - Add common Indian and international foods
    - Include pre-calculated macros per serving
    - Mark common foods for quick-add
    - _Requirements: 7.4_

- [ ] 24. Final integration and testing
  - [ ] 24.1 Write API integration tests
    - Test authentication flow end-to-end
    - Test workout session lifecycle
    - Test nutrition logging flow
    - _Requirements: 13.1, 13.2_
  
  - [ ] 24.2 Write frontend integration tests
    - Test screen navigation
    - Test form submissions
    - Test API error handling
    - _Requirements: 11.1_
  
  - [ ] 24.3 Verify error handling across system
    - **Property 38: API Error Responses** - Verify all errors return correct status and message
    - **Property 39: Pagination Default** - Verify list endpoints default to 20 items
    - _Requirements: 13.2, 13.3_

- [ ] 25. Final checkpoint - All tests pass, system ready
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The design uses TypeScript, so implementation uses TypeScript for both frontend and backend