
export interface Exercise {
  name: string;
  repetitions: string;
  rest: string;
  gifUrl?: string; // Added field for GIF URL
}

export interface TrainingDay {
  id: number; // <-- ¡AÑADE ESTA LÍNEA!
  dayName: string; // e.g., "Día 1"
  exercises: Exercise[];
  notes?: string; // For "Actividad libre" or other specific notes
}

export interface TrainingWeek {
  weekNumber: number;
  title: string;
  days: TrainingDay[];
}

export interface AppData {
  programName: string;
  trainerName: string;
  objective: string;
  postWorkoutStretch: {
    label: string;
    url: string;
  };
  weeks: TrainingWeek[];
}

export type ExercisePerformanceData = Record<number, number>; // exerciseIndex -> secondsSpent
export type Coordinate = { lat: number; lng: number; timestamp: number };
export type ExerciseRoutesData = Record<number, Coordinate[]>; // exerciseIndex -> array of coordinates

export interface PausedSessionState {
  weekNumber: number;
  dayName: string;
  exerciseIndex: number;
  phase: 'EXERCISE' | 'REST';
  timeLeftInSeconds: number;
  initialDurationInSeconds: number;
  // No need to store exerciseActualDurations or exerciseRoutes here as they are accumulated/restarted
}

export interface GuidedSessionViewProps {
  day: TrainingDay;
  onClose: (
    reason?: 'completed' | 'closed_manually', 
    completedIndicesInRun?: number[], 
    exerciseActualDurations?: ExercisePerformanceData,
    exerciseRoutes?: ExerciseRoutesData // Added exercise routes
  ) => void;
  onPauseAndExit: (
    currentState: Omit<PausedSessionState, 'weekNumber' | 'dayName'>, 
    completedIndicesInRun: number[], 
    exerciseActualDurations?: ExercisePerformanceData,
    exerciseRoutes?: ExerciseRoutesData // Added exercise routes
  ) => void;
  initialState?: PausedSessionState | null;
  postWorkoutStretchUrl: string;
}

// --- Authentication Types ---
export type UserRole = 'ENTRENADOR' | 'JUGADOR';
export type PlayerTeam = 'INFANTIL' | 'CADETE' | 'JUVENIL';

export interface User {
  nombreCompleto: string;
  id: number; // El backend devuelve un número (Long)
  email: string;
  rol: UserRole;
  team?: PlayerTeam; // Only for players
  codigoRegistro?: string; // Added for players to store their unique access code
}

export interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password_DO_NOT_USE_IN_REAL_APP: string) => Promise<User | null>;
  register: (
    email: string,
    password_DO_NOT_USE_IN_REAL_APP: string,
    role: UserRole,
    details: {
      firstName?: string; // Required if admin
      lastName?: string;  // Required if admin
      team?: PlayerTeam;  // Required if player
      adminCode?: string; // Required if admin for registration
      playerAccessCode?: string; // Required if player for registration
    }
  ) => Promise<User | null>;
  logout: () => void;
  loading: boolean;
}

// --- User Progress Types ---
export interface ActivityLibreDetails {
  activityType: string;
  timeSpent: string;
}

export interface UserDayProgress {
  userId: number; 
  dayKey: string; // "week<N>-day<DayName>" e.g., "week1-Día 1"
  completedExerciseIndices: number[]; // For structured days
  allExercisesCompleted: boolean;
  completedAt?: string; // ISO string, set when allExercisesCompleted becomes true
  activityLibreDetails?: ActivityLibreDetails; // For "Actividad libre" days
  exerciseActualDurations?: ExercisePerformanceData; // To store time spent on each exercise
  exerciseRoutes?: ExerciseRoutesData; // To store GPS routes for specific exercises
}

// --- API Service Types ---
export interface SessionFeedbackData {
  userId: string;
  userNombreCompleto: string; // <-- CAMBIO
  weekNumber: number;
  dayName: string;
  feedbackEmoji: string;
  feedbackLabel: string;
  completedAt: string; // ISO date string
  activityLibreDetails?: ActivityLibreDetails; // Added for free activity feedback
  exerciseActualDurations?: ExercisePerformanceData; // Time spent on exercises for this session
  exerciseRoutes?: ExerciseRoutesData; // GPS routes for specific exercises
}

// Props for AdminDashboardView
export interface PlayerFeedbackDisplay extends SessionFeedbackData {
  id: string; // Unique ID for the feedback entry itself
}

// --- ¡NUEVOS TIPOS PARA LOS DATOS DE LA API! ---

// Representa un PasoEjercicio que viene del backend
export interface ApiPaso {
  id: number;
  orden: number;
  nombreEjercicio: string;
  tipoMedida: 'TIEMPO_MINUTOS' | 'TIEMPO_SEGUNDOS' | 'REPETICIONES';
  cantidad: number;
  descansoDespuesSeg: number;
  gifUrl: string | null;
}

// Representa un BloqueEjercicio que viene del backend
export interface ApiBloque {
  id: number;
  orden: number;
  repeticionesBloque: number;
  pasos: ApiPaso[];
}

// Representa una SesionDiaria que viene del backend
export interface ApiTrainingDay {
  id: number;
  numeroSemana: number;
  numeroDia: number;
  tipoSesion: 'ENTRENAMIENTO_GUIADO' | 'ACTIVIDAD_LIBRE' | 'DESCANSO_ACTIVO';
  titulo: string;
  descripcion: string | null;
  bloques: ApiBloque[] | null;
}

export interface ApiResponse_TrainingWeek {
  weekNumber: number;
  title: string;
  days: ApiTrainingDay[];
}

// me encanta la programación ...