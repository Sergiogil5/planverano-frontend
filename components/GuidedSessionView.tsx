
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrainingDay, Exercise, PausedSessionState, GuidedSessionViewProps as CustomGuidedSessionViewProps, ExercisePerformanceData, Coordinate, ExerciseRoutesData } from '../types'; // Renamed to avoid conflict
import XCircleIcon from './icons/XCircleIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import ArrowRightStartOnRectangleIcon from './icons/ArrowRightStartOnRectangleIcon';
import ClockIcon from './icons/ClockIcon';
import LinkIcon from './icons/LinkIcon'; // For Estiramientos link

// Helper functions (moved outside component for stability or memoization)
const parseTimeToSeconds = (timeStr: string): number => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const sanitizedTimeStr = timeStr.toLowerCase().replace(/\s+/g, '');
  if (sanitizedTimeStr.includes(':')) {
    const parts = sanitizedTimeStr.replace('min', '').split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) return minutes * 60 + seconds;
    }
  } else if (sanitizedTimeStr.includes('min')) {
    const minutes = parseInt(sanitizedTimeStr, 10);
    if (!isNaN(minutes)) return minutes * 60;
  } else if (sanitizedTimeStr.includes('seg')) {
    const seconds = parseInt(sanitizedTimeStr, 10);
    if (!isNaN(seconds)) return seconds;
  }
  return 0;
};

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatSpokenTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return "";

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) { // Only seconds
        return `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
    }

    // Minutes are present
    const minuteStr = `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

    if (seconds === 0) { // Only minutes, e.g., "2 minutos"
        return minuteStr;
    }

    if (seconds === 30) { // "X minutos y medio"
        return `${minuteStr} y medio`;
    }

    // "X minutos y Y segundos"
    const secondStr = `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
    return `${minuteStr} y ${secondStr}`;
};

const speak = (text: string, forceCancel: boolean = true) => {
  if ('speechSynthesis' in window && text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES'; // Set language to Spanish

    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('es'));
    if (voices.length > 0) {
        const defaultSpanishVoice = voices.find(v => v.lang === 'es-ES' && v.default);
        utterance.voice = defaultSpanishVoice || voices.find(v => v.lang === 'es-ES') || voices[0];
    }
    
    if (forceCancel || !window.speechSynthesis.speaking) { 
        window.speechSynthesis.cancel(); 
    }
    window.speechSynthesis.speak(utterance);
  } else if (!('speechSynthesis' in window)) {
    console.warn("Speech synthesis not supported by this browser.");
  }
};

const EXERCISE_GIF_MAP: Record<string, { postId: string; aspectRatio: string; keywords: string[]; tenorSearchTerm: string }> = {
  carrera: { postId: '13118253062065078318', aspectRatio: '1.77778', keywords: ['carrera suave', 'carrera continua', 'progresión de menos a más', 'sprint'], tenorSearchTerm: 'carrera' },
  saltos_comba: { postId: '2914444104165610464', aspectRatio: '1.77778', keywords: ['saltos a la comba'], tenorSearchTerm: 'salto-comba' },
  sentadillas: { postId: '5998499603474216766', aspectRatio: '1.77778', keywords: ['sentadillas'], tenorSearchTerm: 'sentadilla' },
  zancadas: { postId: '3003118593572451999', aspectRatio: '1.77778', keywords: ['zancadas'], tenorSearchTerm: 'zancada' },
  flexiones: { postId: '1171585521907987152', aspectRatio: '1.77778', keywords: ['flexiones'], tenorSearchTerm: 'flexiones-basicas' },
  skipping_alto: { postId: '5387627474013946269', aspectRatio: '1.77778', keywords: ['skipping alto'], tenorSearchTerm: 'skipping' },
  burpees: { postId: '9811966490760373898', aspectRatio: '1.77778', keywords: ['burpees'], tenorSearchTerm: 'burpee' },
  abdominales_pies_suelo: { postId: '4944685149997192053', aspectRatio: '1.77778', keywords: ['abdominales pies suelo'], tenorSearchTerm: 'abdominales' },
  abdominales_elevacion_piernas: { postId: '3519843968412289278', aspectRatio: '1.77778', keywords: ['abdominales (elevación de piernas)'], tenorSearchTerm: 'abdominales' },
  twist_ruso: { postId: '8725087732844623092', aspectRatio: '1.77778', keywords: ['twist ruso'], tenorSearchTerm: 'twist-ruso' },
  escaladores: { postId: '4589251845944064927', aspectRatio: '1.77778', keywords: ['escaladores'], tenorSearchTerm: 'escalada' },
  abdominales_oblicuos: { postId: '17372017450110417161', aspectRatio: '1.77778', keywords: ['abdominales oblicuos'], tenorSearchTerm: 'abdominales' },
};

const RUNNING_EXERCISES = ['carrera suave', 'carrera continua']; // Lowercase for easier matching


const GuidedSessionView: React.FC<CustomGuidedSessionViewProps> = ({ day, onClose, onPauseAndExit, initialState, postWorkoutStretchUrl }) => {
  const [currentExerciseInternalIndex, setCurrentExerciseInternalIndex] = useState(0);
  const [sessionPhase, setSessionPhase] = useState<'EXERCISE' | 'REST'>('EXERCISE');
  const [timeLeftInSeconds, setTimeLeftInSeconds] = useState(0);
  const [initialDurationInSeconds, setInitialDurationInSeconds] = useState(0);
  const [timerIsActive, setTimerIsActive] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false); // New state for confirmation modal
  
  const completedIndicesInRunRef = useRef<Set<number>>(new Set());
  const exerciseActualDurationsRef = useRef<ExercisePerformanceData>({});
  const currentExerciseStartTimeRef = useRef<number | null>(null); 
  const accumulatedTimeForCurrentExerciseRef = useRef<number>(0); 

  const locationWatchIdRef = useRef<number | null>(null);
  const currentRoutePointsRef = useRef<Coordinate[]>([]);
  const allCollectedRoutesRef = useRef<ExerciseRoutesData>({});


  const exercises = day.exercises;
  const totalExercises = exercises.length;

  const stopLocationTracking = useCallback((exerciseIndexToStore: number) => {
    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
      setLocationStatus("Seguimiento de ubicación detenido.");
    }
    if (currentRoutePointsRef.current.length > 0) {
      allCollectedRoutesRef.current[exerciseIndexToStore] = [...currentRoutePointsRef.current];
      currentRoutePointsRef.current = []; // Clear for next potential tracking
    }
  }, []);

  const startLocationTracking = useCallback((exerciseIndex: number) => {
    const currentEx = exercises[exerciseIndex];
    if (!currentEx || !RUNNING_EXERCISES.includes(currentEx.name.toLowerCase())) {
      stopLocationTracking(exerciseIndex); // Ensure it's stopped if exercise is not eligible
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("Geolocalización no soportada por este navegador.");
      return;
    }

    setLocationStatus("Solicitando permiso de ubicación...");
    navigator.geolocation.getCurrentPosition( 
      () => { 
        setLocationStatus("Seguimiento de ubicación activo.");
        currentRoutePointsRef.current = []; 
        locationWatchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const timestamp = position.timestamp;
            currentRoutePointsRef.current.push({ lat: latitude, lng: longitude, timestamp });
            setLocationStatus(`Ubicación actualizada. Precisión: ${accuracy.toFixed(0)}m.`);
          },
          (error) => {
            console.error("Error watching position:", error.message, error.code);
            let message = "Error de seguimiento: ";
            if (error.code === error.PERMISSION_DENIED) message += "Permiso denegado.";
            else if (error.code === error.POSITION_UNAVAILABLE) message += "Posición no disponible.";
            else if (error.code === error.TIMEOUT) message += "Tiempo de espera agotado.";
            else message += `Error desconocido (${error.message}).`;
            setLocationStatus(message);
            stopLocationTracking(exerciseIndex);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      },
      (error) => { 
        console.error("Error getting initial position/permission:", error.message, error.code);
        let message = "Error al iniciar seguimiento: ";
        if (error.code === error.PERMISSION_DENIED) message += "Permiso de ubicación denegado.";
        else if (error.code === error.POSITION_UNAVAILABLE) message += "Posición no disponible.";
        else if (error.code === error.TIMEOUT) message += "Tiempo de espera agotado.";
        else message += `No se pudo obtener la ubicación (${error.message}).`;
        setLocationStatus(message);
      }
    );
  }, [exercises, stopLocationTracking]);
  
  const recordCurrentExerciseTime = useCallback(() => {
    if (currentExerciseStartTimeRef.current !== null && sessionPhase === 'EXERCISE' && timerIsActive) { 
      const timeSpentMillis = Date.now() - currentExerciseStartTimeRef.current;
      accumulatedTimeForCurrentExerciseRef.current += timeSpentMillis / 1000;
    }
    currentExerciseStartTimeRef.current = null; 
  }, [sessionPhase, timerIsActive]);
  
  const commitAccumulatedTimeToPerformanceData = useCallback(() => {
    if (sessionPhase === 'EXERCISE' && accumulatedTimeForCurrentExerciseRef.current > 0 && currentExerciseInternalIndex < exercises.length) {
       exerciseActualDurationsRef.current[currentExerciseInternalIndex] = 
         (exerciseActualDurationsRef.current[currentExerciseInternalIndex] || 0) + accumulatedTimeForCurrentExerciseRef.current;
    }
    accumulatedTimeForCurrentExerciseRef.current = 0; 
  }, [currentExerciseInternalIndex, exercises, sessionPhase]);


  const applyState = useCallback((
    exIdx: number, 
    phase: 'EXERCISE' | 'REST', 
    time: number, 
    initialDuration: number,
    startTimerIfTimed: boolean = true 
    ) => {
    
    recordCurrentExerciseTime();
    if (phase === 'REST' || (phase === 'EXERCISE' && exIdx !== currentExerciseInternalIndex)) {
        commitAccumulatedTimeToPerformanceData();
        stopLocationTracking(currentExerciseInternalIndex); 
    }
    
    setCurrentExerciseInternalIndex(exIdx);
    setSessionPhase(phase);
    setInitialDurationInSeconds(initialDuration);
    setTimeLeftInSeconds(time);
    
    const isPhaseTimed = initialDuration > 0;
    setTimerIsActive(startTimerIfTimed && isPhaseTimed && time > 0);

    if (phase === 'EXERCISE') {
      if (startTimerIfTimed && isPhaseTimed && time > 0) { 
        currentExerciseStartTimeRef.current = Date.now();
      }
      startLocationTracking(exIdx); 
    } else {
      currentExerciseStartTimeRef.current = null; 
      stopLocationTracking(exIdx); 
    }

    document.getElementById('guided-session-content')?.scrollTo(0, 0);
  }, [recordCurrentExerciseTime, commitAccumulatedTimeToPerformanceData, currentExerciseInternalIndex, stopLocationTracking, startLocationTracking]);

  const markCurrentExerciseAsCompletedInRun = useCallback(() => {
    if (sessionPhase === 'EXERCISE' && currentExerciseInternalIndex < totalExercises) {
      completedIndicesInRunRef.current.add(currentExerciseInternalIndex);
    }
  }, [sessionPhase, currentExerciseInternalIndex, totalExercises]);

  const initializeExerciseState = useCallback((exerciseIdx: number, resumeTimeLeft?: number, resumeInitialDuration?: number, resumePhase?: 'EXERCISE' | 'REST') => {
    if (exerciseIdx < 0 || exerciseIdx >= exercises.length) return;
    
    if (resumePhase === 'EXERCISE' && typeof resumeTimeLeft === 'number' && typeof resumeInitialDuration === 'number') {
      applyState(exerciseIdx, 'EXERCISE', resumeTimeLeft, resumeInitialDuration, true);
      return; // Salimos para no ejecutar la lógica de abajo
    }
      const exercise = exercises[exerciseIdx];
      const duration = parseTimeToSeconds(exercise.repetitions); 
      if (duration > 0) {
            // CASO A: El ejercicio es POR TIEMPO
            // Apagamos el cronómetro fantasma
            currentExerciseStartTimeRef.current = null;
            // Llamamos a applyState para que configure la cuenta atrás
            applyState(exerciseIdx, 'EXERCISE', duration, duration, true);
          } else {
            // CASO B: El ejercicio es POR REPETICIONES
            // No hay cuenta atrás, pero...
            // ¡Activamos el cronómetro fantasma guardando la hora de inicio!
            currentExerciseStartTimeRef.current = Date.now();
            // Llamamos a applyState para que configure un ejercicio sin tiempo
            applyState(exerciseIdx, 'EXERCISE', 0, 0, false);     
          }
  }, [exercises, applyState]);

  const initializeRestState = useCallback((exerciseIdxForPreceding: number, resumeTimeLeft?: number, resumeInitialDuration?: number, resumePhase?: 'EXERCISE' | 'REST') => {
    if (exerciseIdxForPreceding < 0 || exerciseIdxForPreceding >= exercises.length) return false;
    const exercise = exercises[exerciseIdxForPreceding];
    const restDuration = parseTimeToSeconds(exercise.rest);

    if (resumePhase === 'REST' && typeof resumeTimeLeft === 'number' && typeof resumeInitialDuration === 'number') {
        applyState(exerciseIdxForPreceding, 'REST', resumeTimeLeft, resumeInitialDuration, true);
        return true;
    } else if (restDuration > 0) {
        applyState(exerciseIdxForPreceding, 'REST', restDuration, restDuration, true);
        return true;
    }
    return false;
  }, [exercises, applyState]);


  useEffect(() => {
    if ('speechSynthesis' in window && window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => { /* Voices loaded */ };
    }
    completedIndicesInRunRef.current.clear(); 
    exerciseActualDurationsRef.current = {};
    allCollectedRoutesRef.current = {};
    currentRoutePointsRef.current = [];
    currentExerciseStartTimeRef.current = null;
    accumulatedTimeForCurrentExerciseRef.current = 0;

    if (initialState) {
      if (initialState.phase === 'EXERCISE') {
        initializeExerciseState(initialState.exerciseIndex, initialState.timeLeftInSeconds, initialState.initialDurationInSeconds, initialState.phase);
      } else { 
        initializeRestState(initialState.exerciseIndex, initialState.timeLeftInSeconds, initialState.initialDurationInSeconds, initialState.phase);
      }
    } else if (exercises && exercises.length > 0) {
      initializeExerciseState(0);
    }
    return () => {
      stopLocationTracking(currentExerciseInternalIndex); 
      window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState, exercises]); // Keep `exercises` if it can change, or `day.id` if day can change


  useEffect(() => {
    let intervalId: number | null = null;
    if (timerIsActive && timeLeftInSeconds > 0) { 
      intervalId = window.setInterval(() => {
        setTimeLeftInSeconds(prev => {
          const newTimeLeft = prev - 1;
          const currentEx = exercises[currentExerciseInternalIndex];

          if (currentEx) {
            const currentExNameLower = currentEx.name.toLowerCase();
            if (sessionPhase === 'EXERCISE' && parseTimeToSeconds(currentEx.repetitions) > 0) {
                if (currentExNameLower === 'carrera continua' || currentExNameLower === 'saltos a la comba' || currentExNameLower === 'carrera suave') {
                    if (newTimeLeft === 60) speak("Quedan 60 segundos", true);
                    else if (newTimeLeft === 30) speak("30 segundos, ya queda poco", true);
                    else if (newTimeLeft === 10) speak("10 segundos, ya terminamos. ¡Ánimo!", true);
                }
            } else if (sessionPhase === 'REST' && parseTimeToSeconds(currentEx.rest) > 0) { 
              if (newTimeLeft >= 1 && newTimeLeft <= 10) {
                speak(String(newTimeLeft), newTimeLeft === 10); 
              }
            }
          }
          return newTimeLeft;
        });
      }, 1000);
    } else if (timerIsActive && timeLeftInSeconds === 0) { 
      setTimerIsActive(false); 
      
      recordCurrentExerciseTime(); 
      commitAccumulatedTimeToPerformanceData(); 
      if (sessionPhase === 'EXERCISE') stopLocationTracking(currentExerciseInternalIndex);

      if (sessionPhase === 'EXERCISE') {
        markCurrentExerciseAsCompletedInRun();
        const restStarted = initializeRestState(currentExerciseInternalIndex);
        if (!restStarted) {
          if (currentExerciseInternalIndex < totalExercises - 1) {
            initializeExerciseState(currentExerciseInternalIndex + 1);
          } else {
            onClose('completed', Array.from(completedIndicesInRunRef.current), { ...exerciseActualDurationsRef.current }, { ...allCollectedRoutesRef.current }); 
          }
        }
      } else { 
        if (currentExerciseInternalIndex < totalExercises - 1) {
          initializeExerciseState(currentExerciseInternalIndex + 1);
        } else {
          onClose('completed', Array.from(completedIndicesInRunRef.current), { ...exerciseActualDurationsRef.current }, { ...allCollectedRoutesRef.current }); 
        }
      }
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [timerIsActive, timeLeftInSeconds, sessionPhase, currentExerciseInternalIndex, totalExercises, initializeExerciseState, initializeRestState, onClose, exercises, markCurrentExerciseAsCompletedInRun, recordCurrentExerciseTime, commitAccumulatedTimeToPerformanceData, stopLocationTracking]);

  // This useEffect is for announcing the current exercise/rest phase details.
  useEffect(() => {
    if (!exercises || currentExerciseInternalIndex < 0 || currentExerciseInternalIndex >= exercises.length) {
      return;
    }
    const currentEx = exercises[currentExerciseInternalIndex];
    if (!currentEx) return;

    let speechText = "";
    // Determine the duration of the current phase (exercise or rest)
    // This uses the `initialDurationInSeconds` which is set when a phase starts.
    const currentPhaseDurationSeconds = initialDurationInSeconds;


    if (sessionPhase === 'EXERCISE') {
      let exerciseNameToSpeak = currentEx.name;
      const sprintMatch = exerciseNameToSpeak.match(/^Sprint\s+(\d+)\s*m$/i);
      if (sprintMatch && sprintMatch[1]) {
        exerciseNameToSpeak = `Sprint ${sprintMatch[1]} metros`;
      } else if (exerciseNameToSpeak.toLowerCase().includes("progresión de menos a más") && exerciseNameToSpeak.includes(" m")) {
         exerciseNameToSpeak = exerciseNameToSpeak.replace(/(\d+)\s*m/i, '$1 metros');
      }
      
      speechText = exerciseNameToSpeak;
      
      if (currentPhaseDurationSeconds > 0) { // Exercise is timed
        const spokenTime = formatSpokenTime(currentPhaseDurationSeconds);
        if (spokenTime) speechText += `, ${spokenTime}`;
      } else { // Exercise is repetition-based
        const reps = currentEx.repetitions;
        if (reps.match(/^\d+\s*x\s*\d+\s*$/i)) { 
          speechText += `, ${reps.toLowerCase().replace(/\s*x\s*/, ' series de ')} repeticiones`;
        } else {
          const numReps = parseInt(reps, 10);
          if (!isNaN(numReps) && String(numReps) === reps.trim()) { 
            speechText += `, ${numReps} ${numReps === 1 ? 'repetición' : 'repeticiones'}`;
          }
        }
      }
    } else if (sessionPhase === 'REST') {
      if (currentPhaseDurationSeconds > 0) { // Rest is timed
        const spokenRestTime = formatSpokenTime(currentPhaseDurationSeconds);
        speechText = `Descanso de ${spokenRestTime}`;
      } else {
        speechText = "Descanso"; // Should not happen if rest has no duration, but as a fallback
      }
    }

    if (speechText) { 
      speak(speechText, true);
    }
    // Only re-announce if the exercise index or phase changes.
    // `initialDurationInSeconds` is included because it defines the duration of the current phase spoken.
    // `exercises` is included in case the list of exercises itself could change (though typically static for a given session).
  }, [currentExerciseInternalIndex, sessionPhase, exercises, initialDurationInSeconds]); 

  const currentExercise: Exercise | undefined = exercises[currentExerciseInternalIndex];
  
  const currentExerciseNameLower = currentExercise?.name.toLowerCase() || '';
  let activeGifInfo: { type: string; postId: string; aspectRatio: string; tenorSearchTerm: string } | null = null;

  if (currentExerciseNameLower) {
    for (const [type, data] of Object.entries(EXERCISE_GIF_MAP)) {
      if (data.keywords.some(keyword => currentExerciseNameLower.includes(keyword.toLowerCase()))) {
        activeGifInfo = { type, postId: data.postId, aspectRatio: data.aspectRatio, tenorSearchTerm: data.tenorSearchTerm };
        break;
      }
    }
  }

  useEffect(() => {
    if (activeGifInfo && sessionPhase === 'EXERCISE') {
      const gifContainerId = `${activeGifInfo.type}-gif-container-${currentExerciseInternalIndex}`;
      const currentTenorContainer = document.getElementById(gifContainerId);

      if (currentTenorContainer) {
        const tenorEmbedDiv = currentTenorContainer.querySelector(`.tenor-gif-embed[data-postid="${activeGifInfo.postId}"]`);
        const isProcessed = tenorEmbedDiv && tenorEmbedDiv.querySelector('iframe');

        if (tenorEmbedDiv && !isProcessed) {
          const existingScript = document.getElementById('tenor-embed-script-dynamic');
          if (existingScript) {
            existingScript.remove();
          }

          const newScript = document.createElement('script');
          newScript.id = 'tenor-embed-script-dynamic';
          newScript.src = 'https://tenor.com/embed.js';
          newScript.type = 'text/javascript';
          newScript.async = true;
          document.body.appendChild(newScript);
        }
      }
    }
  }, [activeGifInfo, sessionPhase, currentExerciseInternalIndex]);


  if (!currentExercise) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
        <div className="bg-white p-6 rounded-lg shadow-xl text-center">
          <p className="text-lg text-gray-700 mb-4">No hay ejercicios para esta sesión o error al cargar.</p>
          <button onClick={() => onClose('closed_manually', [], {}, {})} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Cerrar
          </button>
        </div>
      </div>
    );
  }
  
      // En GuidedSessionView.tsx

  const handleNextClick = () => {
    // 1. Detenemos cualquier actividad visual o sonora
    setTimerIsActive(false); 
    window.speechSynthesis.cancel();
    stopLocationTracking(currentExerciseInternalIndex);

    // 2. --- ¡LÓGICA DE GUARDADO DE TIEMPO CORREGIDA! ---
    // Solo actuamos si el paso que termina es un EJERCICIO
    if (sessionPhase === 'EXERCISE') {
      const exercise = exercises[currentExerciseInternalIndex];
      const initialDuration = parseTimeToSeconds(exercise.repetitions);
      let timeSpent = 0;

      // 2a. Si el ejercicio era por REPETICIONES (tenía un 'startTime' guardado)
      if (initialDuration === 0 && currentExerciseStartTimeRef.current) {
        timeSpent = (Date.now() - currentExerciseStartTimeRef.current) / 1000;
      } 
      // 2b. Si el ejercicio era por TIEMPO (no tenía 'startTime')
      else if (initialDuration > 0) {
        // Guardamos el tiempo que realmente ha pasado, no el total
        timeSpent = initialDuration - timeLeftInSeconds;
      }

      // 2c. Guardamos el tiempo en nuestro registro, sea cual sea el caso
      exerciseActualDurationsRef.current[currentExerciseInternalIndex] = timeSpent;
    }
    // --- FIN DE LA LÓGICA DE GUARDADO ---

    // 3. Limpiamos el 'startTime' para el siguiente paso
    currentExerciseStartTimeRef.current = null;
    
    // 4. Lógica para avanzar al siguiente paso (esta parte ya estaba bien)
    const isLastExercise = currentExerciseInternalIndex >= totalExercises - 1;
    const currentEx = exercises[currentExerciseInternalIndex];
    const restDuration = parseTimeToSeconds(currentEx.rest);

    if (sessionPhase === 'EXERCISE' && restDuration > 0) {
      initializeRestState(currentExerciseInternalIndex);
    } else {
      if (isLastExercise) {
        onClose('completed', [], { ...exerciseActualDurationsRef.current }, { ...allCollectedRoutesRef.current });
      } else {
        initializeExerciseState(currentExerciseInternalIndex + 1);
      }
    }
  };

  const handlePreviousClick = () => {
    setTimerIsActive(false); 
    window.speechSynthesis.cancel();
    recordCurrentExerciseTime(); 
    commitAccumulatedTimeToPerformanceData();
    if(sessionPhase === 'EXERCISE') stopLocationTracking(currentExerciseInternalIndex);
    else if(sessionPhase === 'REST') stopLocationTracking(currentExerciseInternalIndex); 

    if (sessionPhase === 'REST') {
      initializeExerciseState(currentExerciseInternalIndex);
    } else {
      if (currentExerciseInternalIndex > 0) {
        initializeExerciseState(currentExerciseInternalIndex - 1);
      }
    }
  };
  
  const toggleTimer = () => {
    if (initialDurationInSeconds > 0) { 
        if (timeLeftInSeconds > 0) {
            setTimerIsActive(prevIsActive => {
                if (prevIsActive) { 
                    recordCurrentExerciseTime(); 
                } else { 
                    if (sessionPhase === 'EXERCISE') {
                       currentExerciseStartTimeRef.current = Date.now();
                    }
                }
                return !prevIsActive;
            });
            if (timerIsActive) { 
                window.speechSynthesis.cancel(); 
            }
        } else { 
            recordCurrentExerciseTime(); 
            commitAccumulatedTimeToPerformanceData(); 
            if(sessionPhase === 'EXERCISE') stopLocationTracking(currentExerciseInternalIndex); 
            
            setTimeLeftInSeconds(initialDurationInSeconds);
            setTimerIsActive(true);

            if (sessionPhase === 'EXERCISE') {
                accumulatedTimeForCurrentExerciseRef.current = 0; 
                currentExerciseStartTimeRef.current = Date.now();
                startLocationTracking(currentExerciseInternalIndex); 
            }
        }
    }
};

  const resetTimer = () => {
    if (initialDurationInSeconds > 0) {
        recordCurrentExerciseTime(); 
        commitAccumulatedTimeToPerformanceData(); 
        
        setTimeLeftInSeconds(initialDurationInSeconds);
        setTimerIsActive(true);
        
        if (sessionPhase === 'EXERCISE') {
            currentExerciseStartTimeRef.current = Date.now();
            accumulatedTimeForCurrentExerciseRef.current = 0; 
            if (!locationWatchIdRef.current && RUNNING_EXERCISES.includes(exercises[currentExerciseInternalIndex]?.name.toLowerCase())) {
              startLocationTracking(currentExerciseInternalIndex);
            }
        }
    }
  };

  const handlePauseAndExitClick = () => {
    window.speechSynthesis.cancel(); 
    setTimerIsActive(false);
    recordCurrentExerciseTime();
    commitAccumulatedTimeToPerformanceData();
    stopLocationTracking(currentExerciseInternalIndex); 
    onPauseAndExit({
      exerciseIndex: currentExerciseInternalIndex,
      phase: sessionPhase,
      timeLeftInSeconds: timeLeftInSeconds,
      initialDurationInSeconds: initialDurationInSeconds,
    }, Array.from(completedIndicesInRunRef.current), { ...exerciseActualDurationsRef.current }, { ...allCollectedRoutesRef.current });
  };

  const handleOpenCloseConfirmModal = () => {
    window.speechSynthesis.cancel();
    setTimerIsActive(false); 
    recordCurrentExerciseTime(); 
    setShowCloseConfirmModal(true);
  };

  const confirmAndCloseSession = () => {
    commitAccumulatedTimeToPerformanceData(); 
    stopLocationTracking(currentExerciseInternalIndex);
    onClose('closed_manually', [], {}, {}); 
    setShowCloseConfirmModal(false);
  };

  const cancelCloseSession = () => {
    setShowCloseConfirmModal(false);
  };


  const isCurrentExerciseVisiblyTimed = parseTimeToSeconds(currentExercise.repetitions) > 0;
  let nextButtonText: string;
  let isFinalAction = false;

  if (sessionPhase === 'EXERCISE') {
    const isLastExercise = currentExerciseInternalIndex === totalExercises - 1;
    if (isLastExercise) {
      const restAfterLast = parseTimeToSeconds(currentExercise.rest);
      if (restAfterLast > 0) nextButtonText = "Descansar";
      else { nextButtonText = "Finalizar Sesión"; isFinalAction = true; }
    } else {
      const upcomingRest = parseTimeToSeconds(currentExercise.rest);
      if (upcomingRest > 0) nextButtonText = "Descansar";
      else nextButtonText = "Siguiente Ejercicio";
    }
  } else {
    const isRestAfterLastExercise = currentExerciseInternalIndex === totalExercises - 1;
    if (isRestAfterLastExercise) { nextButtonText = "Finalizar Sesión"; isFinalAction = true; }
    else nextButtonText = "Siguiente Ejercicio";
  }
  
  const isCurrentExerciseTrackable = RUNNING_EXERCISES.includes(currentExerciseNameLower);
  const cssString = `
  .custom-scrollbar::-webkit-scrollbar { width: 8px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #374151; /* gray-700 */ border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; /* gray-600 */ border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; /* gray-500 */ }
  .bg-gray-750 { background-color: rgba(55, 65, 81, 0.5); /* Equivalent to Tailwind's gray-700 with 50% opacity */ } 
  .tabular-nums { font-variant-numeric: tabular-nums; }
`;

  return (
    <>
      <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-[100] p-3 md:p-6 text-white" role="dialog" aria-modal="true" aria-labelledby="guided-session-title">
        <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col">
          <header className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
            <div>
              <h2 id="guided-session-title" className="text-xl sm:text-2xl font-bold text-blue-400">{day.dayName}</h2>
              <p className="text-xs sm:text-sm text-gray-400">
                {sessionPhase === 'EXERCISE' 
                  ? `Ejercicio ${currentExerciseInternalIndex + 1} de ${totalExercises}` 
                  : 'Descanso'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePauseAndExitClick}
                className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                aria-label="Pausar y salir"
              >
                <ArrowRightStartOnRectangleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" />
              </button>
              <button
                onClick={handleOpenCloseConfirmModal} 
                className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                aria-label="Cerrar sesión guiada"
              >
                <XCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-red-500" />
              </button>
            </div>
          </header>

          <main id="guided-session-content" className="flex-grow overflow-y-auto mb-4 custom-scrollbar pr-2 text-center">
            {sessionPhase === 'EXERCISE' && (
              <>
                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                  <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2 break-words leading-tight">{currentExercise.name}</h3>
                </div>
                
                {isCurrentExerciseVisiblyTimed ? ( 
                  <div className="my-4">
                    <div className="text-6xl sm:text-7xl md:text-8xl font-mono font-bold text-green-400 mb-4 tabular-nums">
                      {formatTime(timeLeftInSeconds)}
                    </div>
                  </div>
                ) : ( 
                  <div className="my-4">
                    <div className="text-5xl sm:text-6xl md:text-7xl font-bold text-green-400 mb-2 break-words">
                      {currentExercise.repetitions}
                    </div>
                    <p className="text-sm text-gray-400">(Repeticiones)</p>
                  </div>
                )}

                {activeGifInfo && sessionPhase === 'EXERCISE' && (
                  <div
                    id={`${activeGifInfo.type}-gif-container-${currentExerciseInternalIndex}`}
                    className="mt-4 mx-auto w-full max-w-sm sm:max-w-md rounded-lg shadow-md overflow-hidden" 
                    aria-label={`${currentExercise.name} exercise demonstration`}
                  >
                    <div 
                      className="tenor-gif-embed" 
                      data-postid={activeGifInfo.postId}
                      data-share-method="host" 
                      data-aspect-ratio={activeGifInfo.aspectRatio}
                      data-width="100%"
                    >
                      <a href={`https://tenor.com/view/${activeGifInfo.tenorSearchTerm}-gif-${activeGifInfo.postId}`}>{currentExercise.name} GIF</a>
                      {' from '}
                      <a href={`https://tenor.com/search/${activeGifInfo.tenorSearchTerm}-gifs`}>{activeGifInfo.tenorSearchTerm} GIFs</a>
                    </div>
                  </div>
                )}

                {timeLeftInSeconds === 0 && initialDurationInSeconds > 0 && sessionPhase === 'EXERCISE' && isCurrentExerciseVisiblyTimed && (
                   <p className="text-green-400 mt-3 text-lg font-semibold">¡Ejercicio completado!</p>
                )}
                {currentExercise.name.toLowerCase() === "estiramientos" && postWorkoutStretchUrl && (
                  <div className="mt-4">
                    <a
                      href={postWorkoutStretchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-3 my-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-teal-500 hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-400 transition-colors"
                    >
                      <LinkIcon className="w-5 h-5 mr-2" />
                      Ver Video de Estiramientos
                    </a>
                  </div>
                )}
                 {isCurrentExerciseTrackable && locationStatus && (
                  <p className="text-xs text-cyan-400 mt-2 italic">{locationStatus}</p>
                )}
              </>
            )}

            {sessionPhase === 'REST' && (
              <>
                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                  <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2 break-words leading-tight">Descanso</h3>
                </div>
                <div className="my-4">
                  {initialDurationInSeconds > 0 ? ( 
                      <div className="text-6xl sm:text-7xl md:text-8xl font-mono font-bold text-green-400 mb-4 tabular-nums">
                      {formatTime(timeLeftInSeconds)}
                      </div>
                  ) : (
                      <p className="text-xl text-gray-300 my-8">Descanso breve. Continúa cuando estés listo.</p> 
                  )}
                </div>
                {timeLeftInSeconds === 0 && initialDurationInSeconds > 0 && sessionPhase === 'REST' && (
                   <p className="text-green-400 mt-3 text-lg font-semibold">¡Descanso completado!</p>
                )}
              </>
            )}
            
            { initialDurationInSeconds > 0 && (
              <div className="flex justify-center items-center space-x-3 sm:space-x-4 mt-3">
                <button
                  onClick={toggleTimer}
                  className="p-3 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors"
                  aria-label={timerIsActive ? "Pausar temporizador" : "Reanudar temporizador"}
                >
                  {timerIsActive ? <PauseIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" /> : <PlayIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />}
                </button>
                <button
                  onClick={resetTimer}
                  className="p-3 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors"
                  aria-label="Reiniciar temporizador"
                >
                  <ArrowPathIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </button>
              </div>
            )}

            {sessionPhase === 'EXERCISE' && !isCurrentExerciseVisiblyTimed && currentExercise.rest && currentExercise.rest !== '-' && (
              <div className="mt-4 bg-gray-700 p-3 rounded-lg flex items-center justify-center text-base md:text-lg">
                  <ClockIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 mr-2 shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-300">Siguiente Descanso: </span>
                    <span className="text-white">{currentExercise.rest}</span>
                  </div>
              </div>
            )}
          </main>

          <footer className="mt-auto pt-4 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <button
                onClick={handlePreviousClick}
                disabled={currentExerciseInternalIndex === 0 && sessionPhase === 'EXERCISE'}
                className="flex items-center px-3 py-2 sm:px-4 sm:py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeftIcon className="w-5 h-5 mr-1 sm:mr-2" />
                Anterior
              </button>
              <button
                onClick={handleNextClick}
                className={`flex items-center px-3 py-2 sm:px-4 sm:py-3 font-semibold rounded-lg transition-colors ${
                  isFinalAction 
                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                aria-label={nextButtonText}
              >
                {nextButtonText}
                {!isFinalAction && <ChevronRightIcon className="w-5 h-5 ml-1 sm:ml-2" />}
              </button>
            </div>
          </footer>
        </div>
        <style dangerouslySetInnerHTML={{ __html: cssString }} />
      </div>

      {showCloseConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[200] p-4" 
          role="alertdialog" 
          aria-modal="true" 
          aria-labelledby="close-session-dialog-title"
        >
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white max-w-sm w-full">
            <h3 id="close-session-dialog-title" className="text-lg font-semibold text-yellow-400 mb-4">Confirmar Salida</h3>
            <p className="text-gray-300 mb-6">¿Seguro que quieres salir de la Sesión Guiada? Se perderá todo el progreso.</p>
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                onClick={cancelCloseSession}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAndCloseSession}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors w-full sm:w-auto"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuidedSessionView;
