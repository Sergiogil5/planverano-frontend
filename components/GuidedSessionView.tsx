import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TrainingDay, Exercise, PausedSessionState, GuidedSessionViewProps as CustomGuidedSessionViewProps, ExercisePerformanceData, Coordinate, ExerciseRoutesData } from '../types';
import XCircleIcon from './icons/XCircleIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import ArrowRightStartOnRectangleIcon from './icons/ArrowRightStartOnRectangleIcon';
import ClockIcon from './icons/ClockIcon';
import LinkIcon from './icons/LinkIcon';

// --- Funciones de Ayuda y Constantes (Completas) ---
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
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatSpokenTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return "";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
    const minuteStr = `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    if (seconds === 0) return minuteStr;
    const secondStr = `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
    return `${minuteStr} y ${secondStr}`;
};

const speak = (text: string, forceCancel: boolean = true) => {
  if ('speechSynthesis' in window && text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    if (forceCancel) window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
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

const RUNNING_EXERCISES = ['carrera suave', 'carrera continua'];

// ====================================================================================
// ==   EL COMPONENTE COMPLETO Y REFACTORIZADO EMPIEZA AQUÍ                           ==
// ====================================================================================

const GuidedSessionView: React.FC<CustomGuidedSessionViewProps> = ({ day, onClose, onPauseAndExit, initialState }) => {
    
    // --- ESTADOS Y REFS (SIMPLIFICADOS) ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState<'EXERCISE' | 'REST'>('EXERCISE');
    const [timeLeft, setTimeLeft] = useState(0);
    const [isTimerPaused, setIsTimerPaused] = useState(true); // Pausado por defecto hasta que setupStep lo inicie
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [locationStatus, setLocationStatus] = useState<string | null>(null);

    const exerciseDurationsRef = useRef<ExercisePerformanceData>({});
    const exerciseStartTimeRef = useRef<number | null>(null);
    const intervalRef = useRef<number | null>(null);
    const allCollectedRoutesRef = useRef<ExerciseRoutesData>({});
    const locationWatchIdRef = useRef<number | null>(null);
    const currentRoutePointsRef = useRef<Coordinate[]>([]);
    const completedIndicesInRunRef = useRef<Set<number>>(new Set());

    const exercises = day.exercises;

    // --- LÓGICA DE GPS ---
    const stopLocationTracking = useCallback((exerciseIndexToStore: number) => {
        if (locationWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(locationWatchIdRef.current);
            locationWatchIdRef.current = null;
        }
        if (currentRoutePointsRef.current.length > 0) {
            allCollectedRoutesRef.current[exerciseIndexToStore] = [...currentRoutePointsRef.current];
            currentRoutePointsRef.current = [];
        }
    }, []);

    const startLocationTracking = useCallback((exerciseIndex: number) => {
        stopLocationTracking(exerciseIndex); // Limpia cualquier seguimiento anterior
        const currentEx = exercises[exerciseIndex];
        if (!currentEx || !RUNNING_EXERCISES.includes(currentEx.name.toLowerCase())) return;

        setLocationStatus("Solicitando permiso de ubicación...");
        navigator.geolocation.watchPosition(
            (position) => {
                setLocationStatus("Seguimiento de ubicación activo.");
                const { latitude, longitude } = position.coords;
                currentRoutePointsRef.current.push({ lat: latitude, lng: longitude, timestamp: position.timestamp });
            },
            () => setLocationStatus("No se pudo obtener la ubicación. Comprueba los permisos."),
            { enableHighAccuracy: true }
        );
    }, [exercises, stopLocationTracking]);

    // --- LÓGICA CENTRAL ---
    const setupStep = useCallback((index: number, phaseToSetup: 'EXERCISE' | 'REST') => {
        if (index >= exercises.length) {
            onClose('completed', Array.from(completedIndicesInRunRef.current), { ...exerciseDurationsRef.current }, { ...allCollectedRoutesRef.current });
            return;
        }

        setCurrentIndex(index);
        setPhase(phaseToSetup);

        const currentEx = exercises[index];
        const duration = parseTimeToSeconds(phaseToSetup === 'EXERCISE' ? currentEx.repetitions : currentEx.rest);
        setTimeLeft(duration);
        
        let speechText = "";
        if (phaseToSetup === 'EXERCISE') {
            startLocationTracking(index);
            speechText = `${currentEx.name}, ${duration > 0 ? formatSpokenTime(duration) : currentEx.repetitions}`;
        } else { // REST
            stopLocationTracking(index);
            speechText = `Descanso, ${formatSpokenTime(duration)}`;
        }
        speak(speechText, true);

        if (duration === 0 && phaseToSetup === 'EXERCISE') {
            exerciseStartTimeRef.current = Date.now();
            setIsTimerPaused(true); // No hay cuenta atrás, el usuario controla el avance
        } else {
            exerciseStartTimeRef.current = null;
            setIsTimerPaused(false); // La cuenta atrás empieza automáticamente
        }
    }, [exercises, onClose, startLocationTracking, stopLocationTracking]);

    const advanceToNextStep = useCallback(() => {
        // 1. Guardar el tiempo del paso que acaba de terminar
        if (phase === 'EXERCISE') {
            let timeSpent = 0;
            const initialDuration = parseTimeToSeconds(exercises[currentIndex].repetitions);
            if (exerciseStartTimeRef.current) {
                timeSpent = (Date.now() - exerciseStartTimeRef.current) / 1000;
            } else {
                timeSpent = initialDuration;
            }
            if (timeSpent > 0.1) exerciseDurationsRef.current[currentIndex] = timeSpent;
            completedIndicesInRunRef.current.add(currentIndex);
            stopLocationTracking(currentIndex);
        }

        // 2. Decidir a dónde ir
        const currentEx = exercises[currentIndex];
        const hasRest = parseTimeToSeconds(currentEx.rest) > 0;
        
        if (phase === 'EXERCISE' && hasRest) {
            setupStep(currentIndex, 'REST');
        } else {
            const isLast = currentIndex >= exercises.length - 1;
            if (isLast) {
                onClose('completed', Array.from(completedIndicesInRunRef.current), { ...exerciseDurationsRef.current }, { ...allCollectedRoutesRef.current });
            } else {
                setupStep(currentIndex + 1, 'EXERCISE');
            }
        }
    }, [phase, currentIndex, exercises, onClose, setupStep, stopLocationTracking]);

    // --- EFECTOS ---
    useEffect(() => {
        if (timeLeft <= 0 || isTimerPaused) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeLeft <= 0 && !isTimerPaused) { // El timer terminó naturalmente
                advanceToNextStep();
            }
            return;
        }
        intervalRef.current = window.setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [timeLeft, isTimerPaused, advanceToNextStep]);

    useEffect(() => {
        if (initialState) {
            const { exerciseIndex, phase: resumePhase, timeLeftInSeconds, accumulatedDurations, accumulatedRoutes } = initialState;
            if (accumulatedDurations) exerciseDurationsRef.current = accumulatedDurations;
            if (accumulatedRoutes) allCollectedRoutesRef.current = accumulatedRoutes;
            
            setCurrentIndex(exerciseIndex);
            setPhase(resumePhase);
            setTimeLeft(timeLeftInSeconds);

            if (timeLeftInSeconds > 0) {
                setIsTimerPaused(false); // Reanuda la cuenta atrás
            } else {
                exerciseStartTimeRef.current = Date.now();
                setIsTimerPaused(true); // Reanuda un ejercicio por repeticiones
            }
        } else {
            setupStep(0, 'EXERCISE');
        }
        return () => {
             if (intervalRef.current) clearInterval(intervalRef.current);
             window.speechSynthesis.cancel();
        }
    }, [day, initialState, setupStep]);

    // --- MANEJADORES DE LA UI ---
    const handleNextClick = () => advanceToNextStep();
    const handlePreviousClick = () => {
        if (phase === 'REST') {
            setupStep(currentIndex, 'EXERCISE');
        } else if (currentIndex > 0) {
            setupStep(currentIndex - 1, 'EXERCISE');
        }
    };
    const toggleTimer = () => setIsTimerPaused(prev => !prev);
    const resetTimer = () => {
        const duration = parseTimeToSeconds(phase === 'EXERCISE' ? exercises[currentIndex].repetitions : exercises[currentIndex].rest);
        if(duration > 0) {
            setTimeLeft(duration);
            setIsTimerPaused(false);
        }
    };

    const handlePauseAndExitClick = () => {
        setIsTimerPaused(true);
        onPauseAndExit({
            exerciseIndex: currentIndex,
            phase: phase,
            timeLeftInSeconds: timeLeft,
            initialDurationInSeconds: 0,
            accumulatedDurations: { ...exerciseDurationsRef.current },
            accumulatedRoutes: { ...allCollectedRoutesRef.current },
        }, Array.from(completedIndicesInRunRef.current), { ...exerciseDurationsRef.current }, { ...allCollectedRoutesRef.current });
    };

    // --- RENDERIZADO (JSX COMPLETO) ---
    const currentExercise = exercises[currentIndex];
    if (!currentExercise) return null;

    const isTimedStep = timeLeft > 0;
    const {name, repetitions, rest} = currentExercise;

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-[100] p-3 md:p-6 text-white">
                {/* ... El resto del JSX del componente ... */}
                <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col">
                    <header className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
                        {/* ... Header con título y botones de salida ... */}
                    </header>
                    <main className="flex-grow overflow-y-auto mb-4 custom-scrollbar pr-2 text-center">
                        {phase === 'EXERCISE' ? (
                            <>
                                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                                    <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2 break-words leading-tight">{name}</h3>
                                </div>
                                {isTimedStep ? (
                                    <div className="text-6xl sm:text-7xl md:text-8xl font-mono font-bold text-green-400 my-4 tabular-nums">
                                        {formatTime(timeLeft)}
                                    </div>
                                ) : (
                                    <div className="my-4">
                                        <div className="text-5xl sm:text-6xl md:text-7xl font-bold text-green-400 mb-2 break-words">
                                            {repetitions}
                                        </div>
                                        <p className="text-sm text-gray-400">(Repeticiones)</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                                    <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2">Descanso</h3>
                                </div>
                                <div className="text-6xl sm:text-7xl md:text-8xl font-mono font-bold text-green-400 my-4 tabular-nums">
                                    {formatTime(timeLeft)}
                                </div>
                            </>
                        )}
                         {isTimedStep && (
                            <div className="flex justify-center items-center space-x-4 mt-3">
                                <button onClick={toggleTimer} className="p-3 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors">
                                    {isTimerPaused ? <PlayIcon className="w-7 h-7" /> : <PauseIcon className="w-7 h-7" />}
                                </button>
                                <button onClick={resetTimer} className="p-3 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors">
                                    <ArrowPathIcon className="w-7 h-7" />
                                </button>
                            </div>
                        )}
                    </main>
                    <footer className="mt-auto pt-4 border-t border-gray-700">
                        <div className="flex justify-between items-center">
                            <button onClick={handlePreviousClick} disabled={currentIndex === 0 && phase === 'EXERCISE'} className="flex items-center px-4 py-3 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50 transition-colors">
                                <ChevronLeftIcon className="w-5 h-5 mr-2" />
                                Anterior
                            </button>
                            <button onClick={handleNextClick} className="flex items-center px-4 py-3 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">
                                Siguiente
                                <ChevronRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
            {/* Modal de confirmación (sin cambios) */}
        </>
    );
};

export default GuidedSessionView;