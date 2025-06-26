
import React, { useState, useEffect, useCallback } from 'react';
import { TRAINING_DATA } from './constants';
import { TrainingWeek, TrainingDay, PausedSessionState, User, SessionFeedbackData, UserDayProgress, ActivityLibreDetails, ExercisePerformanceData, ExerciseRoutesData } from './types';
import WeekSelector from './components/WeekSelector';
import WeekView from './components/WeekView';
import LinkIcon from './components/icons/LinkIcon';
import GuidedSessionView from './components/GuidedSessionView';
import PostSessionFeedbackView from './components/PostSessionFeedbackView';
import { AuthProvider, useAuth } from './components/AuthContext';
import AuthView from './components/AuthView';
import ApiService from './components/ApiService'; 
import PowerIcon from './components/icons/PowerIcon';
import AdminDashboardView from './components/AdminDashboardView';
import UserGroupIcon from './components/icons/UserGroupIcon';
import ActivityLibreCompletionModal from './components/ActivityLibreCompletionModal';

const ADMIN_NOTIFICATION_KEY = 'newAdminFeedbackAvailable_training_app';

const AppContent: React.FC = () => {
  // ---------------- ESTADOS PRINCIPALES ----------------
  const { currentUser, logout, loading: authLoading } = useAuth();
  
  // Para saber qué semana estamos viendo
  const [currentWeekNumber, setCurrentWeekNumber] = useState(1);

  // Para guardar los datos de la semana que vienen de la API
  const [weekData, setWeekData] = useState<TrainingWeek | null>(null);
  
  // Para saber si estamos esperando respuesta de la API
  const [isLoadingWeek, setIsLoadingWeek] = useState(true); 

  // (El resto de tus estados para la lógica de la UI se quedan igual)
  const [guidedSessionDay, setGuidedSessionDay] = useState<TrainingDay | null>(null);
  const [pausedSessionDetails, setPausedSessionDetails] = useState<PausedSessionState | null>(null);
  const [showResumeDialogForDay, setShowResumeDialogForDay] = useState<TrainingDay | null>(null);
  const [showPostSessionFeedback, setShowPostSessionFeedback] = useState(false);
  const [feedbackContext, setFeedbackContext] = useState<{
    week: TrainingWeek; 
    day: TrainingDay;
    activityLibreDetails?: ActivityLibreDetails;
    exerciseActualDurations?: ExercisePerformanceData; 
    exerciseRoutes?: ExerciseRoutesData;
  } | null>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [userProgress, setUserProgress] = useState<Record<string, UserDayProgress>>({});
  const [activityLibreModalInfo, setActivityLibreModalInfo] = useState<{ weekNum: number; day: TrainingDay } | null>(null);
  const [newFeedbackNotification, setNewFeedbackNotification] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState("");
  const [textAndPauseAnimationComplete, setTextAndPauseAnimationComplete] = useState(false);

  const motivationalQuotes = [
    "¡Gran trabajo! Cada sesión te acerca más a tus metas.",
    "¡Lo has dado todo! El esfuerzo de hoy es el éxito de mañana.",
    "¡Impresionante! La disciplina es el puente entre metas y logros.",
    "¡Excelente sesión! Sigue así y verás los resultados.",
    "¡Fantástico! Recuerda, la constancia vence al talento.",
  ];
  const getDayKey = useCallback((weekNum: number, dayName: string) => `week${weekNum}-${dayName}`, []);

  const APP_NAME_CONST = "One Peak";
  const SLOGAN_CONST = "Juntos a la Cima";
  const LETTER_REVEAL_DURATION_MS = 400; 
  const TITLE_LETTER_DELAY_MS = 70;      
  const SLOGAN_LETTER_DELAY_MS = 50;     
  const POST_ANIMATION_PAUSE_MS = 1000;  
  const MINIMUM_LOADING_SCREEN_DURATION_MS = 3000; 
  const SLOGAN_GOLD_COLOR = "#C19A6B";
  const NEW_LOGO_URL = "https://i.ibb.co/JFm8MSvK/Logo-Letras-2-1.png";

    // ---------------- EFECTOS (LÓGICA AUTOMÁTICA) ----------------

  // Efecto para la pantalla de carga inicial
  useEffect(() => {
    // Esta lógica de animación no la tocamos
    const timer = setTimeout(() => setTextAndPauseAnimationComplete(true), 3000);
    return () => clearTimeout(timer); 
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      // Limpiamos todo al principio
      setUserProgress({});
      setPausedSessionDetails(null);

      if (currentUser) {
        // Obtenemos el token para hacer las llamadas a la API
        const token = localStorage.getItem('jwt_token');
        if (!token) return; // Si no hay token, no podemos hacer nada

        try {
          // --- 1. Cargar el PROGRESO GENERAL del usuario ---
          const progressDataFromApi = await ApiService.fetchUserProgress();
          const progressMap: Record<string, UserDayProgress> = {};
          
          progressDataFromApi.forEach((progreso: any) => {
            const dayKey = `week${progreso.sesion.numeroSemana}-${progreso.sesion.titulo}`;
            
            progressMap[dayKey] = {
              userId: currentUser.id,
              dayKey: dayKey,
              allExercisesCompleted: true, // Si hay un registro de progreso, es que se completó
              completedAt: progreso.fechaCompletado,
              // Por ahora, asumimos que los detalles vienen en el feedback, no aquí.
              // Podríamos añadir más campos si el backend los devolviera.
              completedExerciseIndices: [], 
              exerciseActualDurations: progreso.tiemposJson ? JSON.parse(progreso.tiemposJson) : {},
              exerciseRoutes: progreso.rutaGpsJson ? JSON.parse(progreso.rutaGpsJson) : {}
            };
          });
          setUserProgress(progressMap);

          // --- 2. Cargar la SESIÓN PAUSADA, si existe ---
          const pausedDataFromApi = await ApiService.fetchPausedSession();
          if (pausedDataFromApi) {
            // Transformamos los datos del backend al formato que el estado del frontend espera
            const pausedState: PausedSessionState = {
              weekNumber: pausedDataFromApi.sesionDiaria.numeroSemana,
              dayName: pausedDataFromApi.sesionDiaria.titulo,
              exerciseIndex: pausedDataFromApi.ultimoEjercicioIndex,
              phase: pausedDataFromApi.fase as ('EXERCISE' | 'REST'),
              timeLeftInSeconds: pausedDataFromApi.tiempoRestanteSeg,
              initialDurationInSeconds: pausedDataFromApi.duracionInicialSeg,
            };
            setPausedSessionDetails(pausedState);
          }

        } catch (error) {
          console.error("Error al cargar los datos del usuario desde el backend:", error);
          // Si hay un error, nos aseguramos de que todo esté limpio
          setUserProgress({});
          setPausedSessionDetails(null);
        }
      }
    };

    loadUserData();
    // Este efecto se ejecuta cada vez que 'currentUser' cambia (login/logout)
  }, [currentUser]);

    // --- ¡NUEVO EFECTO PARA CARGAR DATOS DE LA SEMANA! ---
  useEffect(() => {
    // Solo intentamos cargar datos si hay un usuario logueado.
      if (currentUser) {
    const fetchWeekData = async () => {
      setIsLoadingWeek(true);
      try {
        const sesionesDelBackend: any[] = await ApiService.getWeekData(currentWeekNumber);
        const infoSemanaLocal = TRAINING_DATA.weeks.find(w => w.weekNumber === currentWeekNumber);

        const datosParaFrontend: TrainingWeek = {
          weekNumber: currentWeekNumber,
          title: infoSemanaLocal?.title || `Semana ${currentWeekNumber}`,
          days: sesionesDelBackend.map(sesion => ({
            id: sesion.id,
            dayName: sesion.titulo,
            notes: sesion.descripcion,
            exercises: (sesion.bloques || []).flatMap((bloque: any) => 
              Array(bloque.repeticionesBloque).fill(bloque.pasos).flat()
            ).map((paso: any) => {
              let reps = String(paso.cantidad);
              if (paso.tipoMedida === 'TIEMPO_MINUTOS') reps += ' min';
              else if (paso.tipoMedida === 'TIEMPO_SEGUNDOS') reps += ' seg';
              return { name: paso.nombreEjercicio, repetitions: reps, rest: `${paso.descansoDespuesSeg} seg`, gifUrl: paso.gifUrl };
            })
          }))
        };
          
          setWeekData(datosParaFrontend);

        } catch (error) {
          console.error("Error fetching week data:", error);
          setWeekData(null); // En caso de error, no mostramos nada.
        } finally {
          setIsLoadingWeek(false); // Quitamos la pantalla de "Cargando..."
        }
      };

      fetchWeekData();
    }
  }, [currentUser, currentWeekNumber]); // Este efecto se ejecuta cuando el usuario se loguea o cuando cambia el `currentWeekNumber`.

  useEffect(() => {
    const lastSloganLetterIndividualAnimationStartDelay =
      (APP_NAME_CONST.length * TITLE_LETTER_DELAY_MS) +
      ((SLOGAN_CONST.length > 0 ? SLOGAN_CONST.length - 1 : 0) * SLOGAN_LETTER_DELAY_MS);
    
    const totalTextRevealDuration = lastSloganLetterIndividualAnimationStartDelay + LETTER_REVEAL_DURATION_MS;
    
    const calculatedVisualEffectTime = totalTextRevealDuration + POST_ANIMATION_PAUSE_MS;

    const timeUntilAnimationComplete = Math.max(calculatedVisualEffectTime, MINIMUM_LOADING_SCREEN_DURATION_MS);

    const timer = setTimeout(() => {
      setTextAndPauseAnimationComplete(true);
    }, timeUntilAnimationComplete);

    return () => clearTimeout(timer); 
  }, []); 



    const saveProgressToApi = useCallback(async (dayKey: string, progressEntry: UserDayProgress) => {
    if (currentUser) {
      console.log("Guardado de progreso parcial localmente:", progressEntry); 
    }
  }, [currentUser]);

  const handleWeekChange = (weekNumber: number) => {
    setCurrentWeekNumber(weekNumber);
  };

  useEffect(() => {
    if (!guidedSessionDay && !showResumeDialogForDay && !showPostSessionFeedback && currentUser && !showAdminDashboard && !activityLibreModalInfo) {
      window.scrollTo(0, 0);
    }
  }, [currentWeekNumber, guidedSessionDay, showResumeDialogForDay, showPostSessionFeedback, currentUser, showAdminDashboard, activityLibreModalInfo]);

  const handleStartGuidedSession = (day: TrainingDay) => {
    if (weekData && pausedSessionDetails && 
        pausedSessionDetails.weekNumber === weekData.weekNumber &&
        pausedSessionDetails.dayName === day.dayName) {
      setShowResumeDialogForDay(day);
    } else {
      setPausedSessionDetails(null); 
      setGuidedSessionDay(day);
      document.body.style.overflow = 'hidden';
    }
  };

  const handleRestartGuidedSession = (dayToRestart: TrainingDay) => {
    if (!currentUser || !weekData) return;

    const dayKey = getDayKey(weekData.weekNumber, dayToRestart.dayName);

    // Reset progress for the day
    const resetProgressEntry: UserDayProgress = {
      userId: currentUser.id,
      dayKey,
      completedExerciseIndices: [],
      allExercisesCompleted: false,
      completedAt: undefined, 
      activityLibreDetails: undefined, 
      exerciseActualDurations: {}, 
      exerciseRoutes: {}, 
    };

    setUserProgress(prev => ({ ...prev, [dayKey]: resetProgressEntry }));
    saveProgressToApi(dayKey, resetProgressEntry); 

    setPausedSessionDetails(null); 
    setGuidedSessionDay(dayToRestart); 
    document.body.style.overflow = 'hidden';
  };


  const handleResumeSession = () => {
    if (showResumeDialogForDay) {
      setGuidedSessionDay(showResumeDialogForDay);
      setShowResumeDialogForDay(null);
      document.body.style.overflow = 'hidden';
    }
  };

  const handleStartOverSession = () => {
    if (showResumeDialogForDay && weekData && currentUser) {
      const dayKey = getDayKey(weekData.weekNumber, showResumeDialogForDay.dayName);
      const newProgressForDay: UserDayProgress = {
        userId: currentUser.id,
        dayKey,
        completedExerciseIndices: [],
        allExercisesCompleted: false,
        completedAt: undefined,
        activityLibreDetails: undefined,
        exerciseActualDurations: {}, 
        exerciseRoutes: {}, 
      };
      setUserProgress(prev => ({ ...prev, [dayKey]: newProgressForDay }));
      saveProgressToApi(dayKey, newProgressForDay);
      
      setPausedSessionDetails(null);
      setGuidedSessionDay(showResumeDialogForDay);
      setShowResumeDialogForDay(null);
      document.body.style.overflow = 'hidden';
    }
  };
  
  const handleCancelResumeDialog = () => {
    setShowResumeDialogForDay(null);
  };

    const handleEndGuidedSession = (
    reason?: 'completed' | 'closed_manually', 
    completedIndicesInRun?: number[],
    exerciseActualDurations?: ExercisePerformanceData,
    exerciseRoutes?: ExerciseRoutesData 
  ) => {
    // --- ESTA PRIMERA PARTE DE LÓGICA LOCAL NO CAMBIA ---
    if (currentUser && weekData && guidedSessionDay) {
      const dayKey = getDayKey(weekData.weekNumber, guidedSessionDay.dayName);
      const currentDayProgress = userProgress[dayKey] || { 
        userId: currentUser.id, 
        dayKey, 
        completedExerciseIndices: [], 
        allExercisesCompleted: false,
        exerciseActualDurations: {},
        exerciseRoutes: {},
      };
      let newCompletedIndices = [...currentDayProgress.completedExerciseIndices];
      let allNowCompleted = currentDayProgress.allExercisesCompleted;
      let completedTimestamp = currentDayProgress.completedAt;

      const updatedDurations = { ...(currentDayProgress.exerciseActualDurations || {}), ...(exerciseActualDurations || {})};
      const updatedRoutes = { ...(currentDayProgress.exerciseRoutes || {}), ...(exerciseRoutes || {})};

      if (reason === 'completed') {
        newCompletedIndices = Array.from({ length: guidedSessionDay.exercises.length }, (_, i) => i);
        allNowCompleted = true;
        completedTimestamp = completedTimestamp || new Date().toISOString();
      } else if (completedIndicesInRun && completedIndicesInRun.length > 0) {
        newCompletedIndices = Array.from(new Set([...newCompletedIndices, ...completedIndicesInRun]));
        if (!allNowCompleted && newCompletedIndices.length === guidedSessionDay.exercises.length) {
          allNowCompleted = true;
          completedTimestamp = completedTimestamp || new Date().toISOString();
        }
      }
      
      const updatedDayProgress: UserDayProgress = {
        ...currentDayProgress,
        completedExerciseIndices: newCompletedIndices,
        allExercisesCompleted: allNowCompleted,
        completedAt: completedTimestamp,
        exerciseActualDurations: updatedDurations,
        exerciseRoutes: updatedRoutes,
      };
      setUserProgress(prev => ({ ...prev, [dayKey]: updatedDayProgress }));
      // La llamada a saveProgressToApi ya está obsoleta y no hace nada, lo cual es correcto.
    }
    
    // La lógica de limpieza de sesión pausada tampoco cambia
    if (weekData && guidedSessionDay && pausedSessionDetails &&
        pausedSessionDetails.weekNumber === weekData.weekNumber &&
        pausedSessionDetails.dayName === guidedSessionDay.dayName) {
      setPausedSessionDetails(null);
    }
    setGuidedSessionDay(null); 

    // --- ¡AQUÍ ESTÁ EL CAMBIO CLAVE! ---
    if (reason === 'completed' && weekData && guidedSessionDay) {
      setSelectedQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);
      // Usamos 'weekData' (del estado) en lugar de 'weekForFeedback' (que venía de una constante)
      setFeedbackContext({ week: weekData, day: guidedSessionDay, exerciseActualDurations, exerciseRoutes }); 
      setShowPostSessionFeedback(true);
    } else {
      document.body.style.overflow = ''; 
      setFeedbackContext(null); 
    }
  };

  const handlePauseAndExitSession = (
    sessionState: Omit<PausedSessionState, 'weekNumber' | 'dayName'>, 
    completedIndicesInRun: number[],
    exerciseActualDurations?: ExercisePerformanceData,
    exerciseRoutes?: ExerciseRoutesData 
  ) => {
    if (currentUser && weekData && guidedSessionDay) {
      const dayKey = getDayKey(weekData.weekNumber, guidedSessionDay.dayName);
      const currentDayProgress = userProgress[dayKey] || { 
        userId: currentUser.id, 
        dayKey, 
        completedExerciseIndices: [], 
        allExercisesCompleted: false,
        exerciseActualDurations: {},
        exerciseRoutes: {},
      };
      
      const newCompletedIndices = Array.from(new Set([...currentDayProgress.completedExerciseIndices, ...completedIndicesInRun]));
      const allNowCompleted = !currentDayProgress.allExercisesCompleted && newCompletedIndices.length === guidedSessionDay.exercises.length
                                ? true
                                : currentDayProgress.allExercisesCompleted;
      const completedTimestamp = allNowCompleted ? (currentDayProgress.completedAt || new Date().toISOString()) : undefined;
      const updatedDurations = { ...(currentDayProgress.exerciseActualDurations || {}), ...(exerciseActualDurations || {})};
      const updatedRoutes = { ...(currentDayProgress.exerciseRoutes || {}), ...(exerciseRoutes || {})};

      const updatedDayProgress: UserDayProgress = {
        ...currentDayProgress,
        completedExerciseIndices: newCompletedIndices,
        allExercisesCompleted: allNowCompleted,
        completedAt: completedTimestamp,
        exerciseActualDurations: updatedDurations,
        exerciseRoutes: updatedRoutes,
      };
      setUserProgress(prev => ({ ...prev, [dayKey]: updatedDayProgress }));
      saveProgressToApi(dayKey, updatedDayProgress);

      setPausedSessionDetails({
        ...sessionState,
        weekNumber: weekData.weekNumber,
        dayName: guidedSessionDay.dayName,
      });
    }
    setGuidedSessionDay(null);
    document.body.style.overflow = '';
  };

  const handleCloseFeedbackView = async (feedback?: { emoji: string; label: string }) => {
    if (feedback && currentUser && feedbackContext) { 
      
      // --- ¡LÓGICA DE BÚSQUEDA CORREGIDA! ---
      // Buscamos el objeto del día DENTRO de la información de la semana que está en el contexto.
      // Ya no necesitamos buscar en la constante global TRAINING_DATA.
      const dayObject = feedbackContext.week.days.find((d: TrainingDay) => d.dayName === feedbackContext.day.dayName);

      // La comprobación de seguridad sigue siendo importante
      if (!dayObject || dayObject.id === undefined) {
        console.error("Error crítico: No se pudo encontrar el ID de la sesión en el contexto para enviar el feedback.");
        setShowPostSessionFeedback(false);
        setFeedbackContext(null);
        document.body.style.overflow = '';
        return;
      }
      
      // El payload ahora usa el 'dayObject.id' que hemos encontrado
      const feedbackPayload = {
        sesionId: dayObject.id,
        feedbackEmoji: feedback.emoji,
        feedbackLabel: feedback.label,
        feedbackTextoOpcional: "", // Puedes añadir este campo más adelante
        tiemposJson: JSON.stringify(feedbackContext.exerciseActualDurations || {}),
        rutaGpsJson: JSON.stringify(feedbackContext.exerciseRoutes || {}),
      };

      // La llamada a la API y la lógica de notificación no cambian
      try {
        await ApiService.submitSessionFeedback(feedbackPayload);
        console.log("Feedback enviado con éxito al backend real.");
        if (currentUser.rol !== 'ENTRENADOR') { 
            // Podríamos implementar una notificación real aquí en el futuro
        }
      } catch (error) {
        console.error("Error al enviar el feedback al backend:", error);
      }
    }
    
    // La lógica de limpieza final no cambia
    setShowPostSessionFeedback(false);
    setFeedbackContext(null); 
    document.body.style.overflow = '';
  };

  const handleOpenActivityLibreModal = (day: TrainingDay) => {
    if (weekData) {
      setActivityLibreModalInfo({ weekNum: weekData.weekNumber, day });
      document.body.style.overflow = 'hidden';
    }
  };

  const handleCloseActivityLibreModal = () => {
    setActivityLibreModalInfo(null);
    document.body.style.overflow = '';
  };

  const handleOpenAdminDashboard = () => {
    setShowAdminDashboard(true);
    document.body.style.overflow = 'hidden';
  };

  const handleActivityLibreSubmit = async (details: ActivityLibreDetails) => {
    // La comprobación ahora usa 'weekData' del estado
    if (currentUser && activityLibreModalInfo && weekData) {
      const { day } = activityLibreModalInfo;
      const dayKey = getDayKey(weekData.weekNumber, day.dayName);
      const completedTimestamp = new Date().toISOString();
      
      const updatedDayProgress: UserDayProgress = {
        userId: currentUser.id,
        dayKey,
        completedExerciseIndices: [], 
        allExercisesCompleted: true,
        completedAt: completedTimestamp,
        activityLibreDetails: details,
        exerciseActualDurations: {}, 
        exerciseRoutes: {}, 
      };

      setUserProgress(prev => ({ ...prev, [dayKey]: updatedDayProgress }));
      
      setActivityLibreModalInfo(null); 

      // --- ¡AQUÍ ESTÁ EL CAMBIO CLAVE! ---
      setSelectedQuote(motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);
      // Usamos 'weekData' para asegurarnos de que el ID de la sesión está disponible
      setFeedbackContext({ week: weekData, day, activityLibreDetails: details, exerciseRoutes: {} });
      setShowPostSessionFeedback(true);
    } else {
        // La función handleCloseActivityLibreModal() no existe, así que la eliminamos por si acaso.
        setActivityLibreModalInfo(null);
        document.body.style.overflow = '';
    }
  };
  
  if (!textAndPauseAnimationComplete || authLoading) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center z-[200] p-4 text-center">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-6">
          <img 
            src={NEW_LOGO_URL} 
            alt="Logo One Peak" 
            className="w-full h-full object-contain scale-125"
          />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-700 mb-2">
          {APP_NAME_CONST.split('').map((char, index) => (
            <span
              key={`title-${index}`}
              style={{
                animation: `letterReveal ${LETTER_REVEAL_DURATION_MS / 1000}s forwards`,
                animationDelay: `${index * (TITLE_LETTER_DELAY_MS / 1000)}s`,
                opacity: 0,
                display: 'inline-block'
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        <p className="text-lg sm:text-xl">
          {SLOGAN_CONST.split('').map((char, index) => (
            <span
              key={`slogan-${index}`}
              style={{
                animation: `letterReveal ${LETTER_REVEAL_DURATION_MS / 1000}s forwards`,
                animationDelay: `${(APP_NAME_CONST.length * (TITLE_LETTER_DELAY_MS / 1000)) + (index * (SLOGAN_LETTER_DELAY_MS / 1000))}s`,
                opacity: 0,
                display: 'inline-block',
                color: SLOGAN_GOLD_COLOR,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </p>
        <div className="mt-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView />;
  }
  
  if (showAdminDashboard && currentUser.rol === 'ENTRENADOR') {
    return <AdminDashboardView onClose={() => { setShowAdminDashboard(false); document.body.style.overflow = ''; }} />;
  }
  
  if (showPostSessionFeedback && feedbackContext) {
    return (
      <PostSessionFeedbackView
        quote={selectedQuote}
        onClose={handleCloseFeedbackView}
        currentWeekNumber={feedbackContext.week.weekNumber}
        currentDayName={feedbackContext.day.dayName}
        activityLibreDetails={feedbackContext.activityLibreDetails}
      />
    );
  }

  if (activityLibreModalInfo) {
    return (
      <ActivityLibreCompletionModal 
        dayName={activityLibreModalInfo.day.dayName}
        onClose={handleCloseActivityLibreModal}
        onSubmit={handleActivityLibreSubmit}
      />
    );
  }

  if (showResumeDialogForDay) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[110] p-4">
        <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm w-full">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Sesión Pausada</h3>
          <p className="text-gray-600 mb-6">
            Tienes una sesión pausada para {showResumeDialogForDay.dayName}. ¿Deseas continuarla o empezar de nuevo?
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-3">
            <button onClick={handleResumeSession} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors w-full sm:w-auto">Continuar</button>
            <button onClick={handleStartOverSession} className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors w-full sm:w-auto">Empezar de Nuevo</button>
            <button onClick={handleCancelResumeDialog} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors w-full sm:w-auto">Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  if (guidedSessionDay && weekData) {
    const initialSessionState = (pausedSessionDetails && 
      pausedSessionDetails.weekNumber === weekData.weekNumber &&
      pausedSessionDetails.dayName === guidedSessionDay.dayName) 
      ? pausedSessionDetails 
      : null;

    return (
      <GuidedSessionView 
        day={guidedSessionDay} 
        onClose={handleEndGuidedSession} 
        onPauseAndExit={handlePauseAndExitSession}
        initialState={initialSessionState}
        postWorkoutStretchUrl={TRAINING_DATA.postWorkoutStretch.url}
      />
    );
  }
  
  if (isLoadingWeek || !weekData) {
    // Puedes poner aquí un spinner o un componente de carga más elaborado.
    return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );
  }

  if (!weekData) {
    return <div className="p-4 text-center text-red-500">Error: Semana no encontrada.</div>;
  }
  
// LÍNEA CORREGIDA
const userTitle = `${currentUser.nombreCompleto} (${currentUser.rol === 'ENTRENADOR' ? 'Admin' : currentUser.team})`;
console.log("Usuario actual:", currentUser); // <--- AÑADE ESTA LÍNEA

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 text-gray-800">
      <header className="bg-blue-600 text-white p-5 shadow-md sticky top-0 z-50 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-no-repeat bg-center pointer-events-none" 
          style={{ backgroundImage: "url('https://i.ibb.co/5WN2Q6F2/escudo-club.png')", backgroundSize: 'auto 70%', opacity: 0.35 }}
          aria-hidden="true"
        ></div>
        <div className="container mx-auto flex items-center justify-between relative z-10">
            <div className="flex items-center">
                <div 
                  className="rounded-full w-10 h-10 flex items-center justify-center mr-3 shrink-0 overflow-hidden" 
                  title={userTitle}
                  aria-label={`Avatar de ${currentUser.nombreCompleto}`}
                >
                  <img src={NEW_LOGO_URL} alt="Logo del Club" className="w-full h-full object-contain scale-125" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">RUTINA DE ENTRENAMIENTO</h1>
                    <p className="text-xs md:text-sm opacity-90">Rutina de julio y primera semana de agosto</p>
                </div>
            </div>
            <div className="flex items-center space-x-2">
              {currentUser && currentUser.rol === 'ENTRENADOR' && (
                <button
                  onClick={handleOpenAdminDashboard}
                  className="relative flex items-center text-sm bg-purple-500 hover:bg-purple-600 px-3 py-2 rounded-lg transition-colors"
                  title="Panel de Administrador"
                  aria-label="Panel de Administrador"
                >
                  <UserGroupIcon className="w-5 h-5 mr-1.5" />
                  Admin
                  {newFeedbackNotification && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-purple-500 animate-pulse"></span>
                  )}
                </button>
              )}
              <button 
                onClick={logout} 
                className="flex items-center text-sm bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition-colors"
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
              >
                <PowerIcon className="w-5 h-5 mr-1.5"/>
                Salir
              </button>
            </div>
        </div>
      </header>

      <main className="container mx-auto p-3 md:p-6">
        <section className="mb-6 p-4 bg-white shadow-lg rounded-xl">
          <h2 className="text-lg font-semibold text-blue-700 mb-2">Objetivo del Programa:</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {TRAINING_DATA.objective}
          </p>
        </section>

        <section className="mb-6 p-4 bg-white shadow-lg rounded-xl">
          <a
            href={TRAINING_DATA.postWorkoutStretch.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-150 group"
          >
            <LinkIcon className="w-5 h-5 mr-2 group-hover:animate-pulse" />
            <span className="font-medium text-sm md:text-base">{TRAINING_DATA.postWorkoutStretch.label}</span>
          </a>
        </section>
        
        <WeekSelector
          currentWeekNumber={weekData.weekNumber} // Usa el dato de la API
          totalWeeks={TRAINING_DATA.weeks.length}
          onWeekChange={handleWeekChange}
          weekTitle={weekData.title} // Usa el dato de la API
        />
        
        <WeekView 
            week={weekData} 
            onStartGuidedSession={handleStartGuidedSession}
            onRestartGuidedSession={handleRestartGuidedSession} 
            onOpenActivityLibreModal={handleOpenActivityLibreModal}
            pausedSessionDetails={pausedSessionDetails}
            userProgress={userProgress}
            getDayKey={getDayKey}
        />
      </main>

      <footer className="text-center p-6 text-sm text-gray-500 mt-8">
        <p>&copy; {new Date().getFullYear()} {TRAINING_DATA.trainerName}. Plan de Entrenamiento.</p>
        <p>Desarrollado con 💪.</p>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
