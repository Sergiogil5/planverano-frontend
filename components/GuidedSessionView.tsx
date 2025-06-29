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

// --- Funciones de Ayuda y Constantes (Sin cambios) ---
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
    if (seconds === 30) return `${minuteStr} y medio`;
    const secondStr = `${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
    return `${minuteStr} y ${secondStr}`;
};

const speak = (text: string, forceCancel: boolean = true) => {
  if ('speechSynthesis' in window && text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
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

const RUNNING_EXERCISES = ['carrera suave', 'carrera continua'];

// ====================================================================================
// ==   EL COMPONENTE COMPLETO Y CORREGIDO EMPIEZA AQUÍ                              ==
// ====================================================================================

const GuidedSessionView: React.FC<CustomGuidedSessionViewProps> = ({ day, onClose, onPauseAndExit, initialState, postWorkoutStretchUrl }) => {
    // --- ESTADO Y REFS ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState<'EXERCISE' | 'REST'>('EXERCISE');
    const [timeLeft, setTimeLeft] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);
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

    // --- LÓGICA CENTRALIZADA ---

    const stopTimer = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsTimerActive(false);
    }, []);

    const stopLocationTracking = useCallback((exerciseIndexToStore: number) => {
      if (locationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
        setLocationStatus("Seguimiento de ubicación detenido.");
      }
      if (currentRoutePointsRef.current.length > 0) {
        allCollectedRoutesRef.current[exerciseIndexToStore] = [...currentRoutePointsRef.current];
        currentRoutePointsRef.current = [];
      }
    }, []);

    const startLocationTracking = useCallback((exerciseIndex: number) => {
        const currentEx = exercises[exerciseIndex];
        if (!currentEx || !RUNNING_EXERCISES.includes(currentEx.name.toLowerCase())) {
          stopLocationTracking(exerciseIndex);
          return;
        }
        if (!navigator.geolocation) {
          setLocationStatus("Geolocalización no soportada.");
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
                currentRoutePointsRef.current.push({ lat: latitude, lng: longitude, timestamp: position.timestamp });
                setLocationStatus(`Ubicación actualizada. Precisión: ${accuracy.toFixed(0)}m.`);
              },
              (error) => {
                let message = "Error de seguimiento: " + (error.code === error.PERMISSION_DENIED ? "Permiso denegado." : "Posición no disponible.");
                setLocationStatus(message);
                stopLocationTracking(exerciseIndex);
              },
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
          },
          (error) => {
            let message = "Error al iniciar seguimiento: " + (error.code === error.PERMISSION_DENIED ? "Permiso denegado." : "No se pudo obtener la ubicación.");
            setLocationStatus(message);
          }
        );
    }, [exercises, stopLocationTracking]);

    const commitCurrentExerciseTime = useCallback(() => {
        if (phase === 'EXERCISE') {
            const exercise = exercises[currentIndex];
            if (!exercise) return;
            
            let timeSpent = 0;
            const initialDuration = parseTimeToSeconds(exercise.repetitions);

            if (initialDuration === 0 && exerciseStartTimeRef.current) {
                timeSpent = (Date.now() - exerciseStartTimeRef.current) / 1000;
            } else if (initialDuration > 0) {
                timeSpent = initialDuration - timeLeft;
            }
            
            if (timeSpent > 0.1) {
                exerciseDurationsRef.current[currentIndex] = timeSpent;
            }
            completedIndicesInRunRef.current.add(currentIndex);
        }
        exerciseStartTimeRef.current = null;
        stopLocationTracking(currentIndex);
    }, [phase, currentIndex, exercises, timeLeft, stopLocationTracking]);
    
    const setupStep = useCallback((index: number, newPhase: 'EXERCISE' | 'REST') => {
        setPhase(newPhase);
        setCurrentIndex(index);
        
        let duration = 0;
        if (newPhase === 'EXERCISE') {
            duration = parseTimeToSeconds(exercises[index].repetitions);
            startLocationTracking(index);
        } else { // 'REST'
            duration = parseTimeToSeconds(exercises[index].rest);
            stopLocationTracking(index);
        }
        
        if (duration > 0) {
            setTimeLeft(duration);
            setIsTimerActive(true);
        } else {
            setTimeLeft(0);
            setIsTimerActive(false);
            if (newPhase === 'EXERCISE') {
                exerciseStartTimeRef.current = Date.now();
            }
        }
    }, [exercises, startLocationTracking, stopLocationTracking]);

    const advanceToNextStep = useCallback(() => {
        commitCurrentExerciseTime();
        stopTimer();
        
        const isLastExercise = currentIndex >= exercises.length - 1;
        const currentEx = exercises[currentIndex];
        
        if (phase === 'EXERCISE' && parseTimeToSeconds(currentEx.rest) > 0) {
            setupStep(currentIndex, 'REST');
        } else {
            if (isLastExercise) {
                onClose('completed', Array.from(completedIndicesInRunRef.current), { ...exerciseDurationsRef.current }, { ...allCollectedRoutesRef.current });
            } else {
                setupStep(currentIndex + 1, 'EXERCISE');
            }
        }
    }, [commitCurrentExerciseTime, stopTimer, currentIndex, exercises, phase, onClose, setupStep]);

    // --- EFECTOS ---

    useEffect(() => {
        if (isTimerActive && timeLeft > 0) {
            intervalRef.current = window.setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
        } else if (isTimerActive && timeLeft === 0) {
            advanceToNextStep();
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isTimerActive, timeLeft, advanceToNextStep]);
    
    useEffect(() => {
        if (initialState) {
            const { exerciseIndex, phase: resumePhase, timeLeftInSeconds, accumulatedDurations, accumulatedRoutes } = initialState;
            setCurrentIndex(exerciseIndex);
            setPhase(resumePhase);
            if (accumulatedDurations) exerciseDurationsRef.current = accumulatedDurations;
            if (accumulatedRoutes) allCollectedRoutesRef.current = accumulatedRoutes;
            
            if (timeLeftInSeconds > 0) {
                setTimeLeft(timeLeftInSeconds);
                setIsTimerActive(true);
            } else if (resumePhase === 'EXERCISE') {
                exerciseStartTimeRef.current = Date.now();
            }
        } else {
            setupStep(0, 'EXERCISE');
        }
        return () => {
            stopTimer();
            stopLocationTracking(currentIndex);
            window.speechSynthesis.cancel();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialState]);

    useEffect(() => {
        const currentEx = exercises[currentIndex];
        if (!currentEx) return;

        let speechText = "";
        const durationForSpeech = parseTimeToSeconds(phase === 'EXERCISE' ? currentEx.repetitions : currentEx.rest);

        if (phase === 'EXERCISE') {
            speechText = currentEx.name;
            if (durationForSpeech > 0) {
                speechText += `, ${formatSpokenTime(durationForSpeech)}`;
            } else {
                speechText += `, ${currentEx.repetitions} repeticiones`;
            }
        } else { // REST
            speechText = `Descanso de ${formatSpokenTime(durationForSpeech)}`;
        }
        speak(speechText, true);
    }, [currentIndex, phase, exercises]);

    const currentExercise = exercises[currentIndex];
    const activeGifInfo = useMemo(() => {
        if (!currentExercise) return null;
        const nameLower = currentExercise.name.toLowerCase();
        for (const [type, data] of Object.entries(EXERCISE_GIF_MAP)) {
            if (data.keywords.some(keyword => nameLower.includes(keyword.toLowerCase()))) {
                return { type, ...data };
            }
        }
        return null;
    }, [currentExercise]);
    
    useEffect(() => {
        if (activeGifInfo && phase === 'EXERCISE') {
            const containerId = `${activeGifInfo.type}-gif-container-${currentIndex}`;
            const container = document.getElementById(containerId);
            if (container && !container.querySelector('iframe')) {
                const scriptId = 'tenor-embed-script-dynamic';
                document.getElementById(scriptId)?.remove();
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://tenor.com/embed.js';
                script.async = true;
                document.body.appendChild(script);
            }
        }
    }, [activeGifInfo, phase, currentIndex]);


    // --- MANEJADORES DE EVENTOS DE LA UI ---
    
    const handleNextClick = () => advanceToNextStep();

    const handlePreviousClick = () => {
        commitCurrentExerciseTime();
        stopTimer();
        if (phase === 'REST') {
            setupStep(currentIndex, 'EXERCISE');
        } else if (currentIndex > 0) {
            setupStep(currentIndex - 1, 'EXERCISE');
        }
    };
    
    const toggleTimer = () => setIsTimerActive(prev => !prev);

    const resetTimer = () => {
        const duration = parseTimeToSeconds(phase === 'EXERCISE' ? exercises[currentIndex].repetitions : exercises[currentIndex].rest);
        if (duration > 0) {
            setTimeLeft(duration);
            setIsTimerActive(true);
        }
    };

    const handlePauseAndExitClick = () => {
        commitCurrentExerciseTime();
        stopTimer();
        onPauseAndExit({
            exerciseIndex: currentIndex,
            phase: phase,
            timeLeftInSeconds: timeLeft,
            initialDurationInSeconds: 0,
            accumulatedDurations: { ...exerciseDurationsRef.current },
            accumulatedRoutes: { ...allCollectedRoutesRef.current }
        }, Array.from(completedIndicesInRunRef.current), { ...exerciseDurationsRef.current }, { ...allCollectedRoutesRef.current });
    };

    const handleOpenCloseConfirmModal = () => {
        stopTimer();
        setShowCloseConfirmModal(true);
    };

    const confirmAndCloseSession = () => {
        stopLocationTracking(currentIndex);
        onClose('closed_manually', [], {}, {});
        setShowCloseConfirmModal(false);
    };

    const cancelCloseSession = () => setShowCloseConfirmModal(false);

    // --- LÓGICA DE DISPLAY ---
    if (!currentExercise) return null;

    const totalExercises = exercises.length;
    let nextButtonText: string;
    let isFinalAction = false;
    const isCurrentExerciseTimed = parseTimeToSeconds(currentExercise.repetitions) > 0;
    
    if (phase === 'EXERCISE') {
      const isLast = currentIndex === totalExercises - 1;
      const hasRest = parseTimeToSeconds(currentExercise.rest) > 0;
      if (isLast && !hasRest) {
        nextButtonText = "Finalizar Sesión";
        isFinalAction = true;
      } else {
        nextButtonText = hasRest ? "Descansar" : "Siguiente Ejercicio";
      }
    } else { // REST
      isFinalAction = currentIndex === totalExercises - 1;
      nextButtonText = isFinalAction ? "Finalizar Sesión" : "Siguiente Ejercicio";
    }

    const cssString = `
      .custom-scrollbar::-webkit-scrollbar { width: 8px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: #374151; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
      .bg-gray-750 { background-color: rgba(55, 65, 81, 0.5); } 
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
                                {phase === 'EXERCISE' ? `Ejercicio ${currentIndex + 1} de ${totalExercises}` : 'Descanso'}
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={handlePauseAndExitClick} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Pausar y salir">
                                <ArrowRightStartOnRectangleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" />
                            </button>
                            <button onClick={handleOpenCloseConfirmModal} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Cerrar sesión guiada">
                                <XCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-red-500" />
                            </button>
                        </div>
                    </header>

                    <main id="guided-session-content" className="flex-grow overflow-y-auto mb-4 custom-scrollbar pr-2 text-center">
                        {phase === 'EXERCISE' ? (
                            <>
                                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                                    <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2 break-words leading-tight">{currentExercise.name}</h3>
                                </div>
                                {isCurrentExerciseTimed ? (
                                    <div className="my-4">
                                        <div className="text-6xl sm:text-7xl md:text-8xl font-mono font-bold text-green-400 mb-4 tabular-nums">
                                            {formatTime(timeLeft)}
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
                                {activeGifInfo && (
                                    <div id={`${activeGifInfo.type}-gif-container-${currentIndex}`} className="mt-4 mx-auto w-full max-w-sm sm:max-w-md rounded-lg shadow-md overflow-hidden">
                                        <div className="tenor-gif-embed" data-postid={activeGifInfo.postId} data-share-method="host" data-aspect-ratio={activeGifInfo.aspectRatio} data-width="100%">
                                            <a href={`https://tenor.com/view/${activeGifInfo.tenorSearchTerm}-gif-${activeGifInfo.postId}`}>{currentExercise.name} GIF</a>
                                        </div>
                                    </div>
                                )}
                                {locationStatus && RUNNING_EXERCISES.includes(currentExercise.name.toLowerCase()) && (
                                    <p className="text-xs text-cyan-400 mt-2 italic">{locationStatus}</p>
                                )}
                            </>
                        ) : ( // phase === 'REST'
                            <>
                                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                                    <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2 break-words leading-tight">Descanso</h3>
                                </div>
                                <div className="my-4">
                                    <div className="text-6xl sm:text-7xl md:text-8xl font-mono font-bold text-green-400 mb-4 tabular-nums">
                                        {formatTime(timeLeft)}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {(isCurrentExerciseTimed || phase === 'REST') && parseTimeToSeconds(phase === 'EXERCISE' ? currentExercise.repetitions : currentExercise.rest) > 0 && (
                            <div className="flex justify-center items-center space-x-3 sm:space-x-4 mt-3">
                                <button onClick={toggleTimer} className="p-3 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors" aria-label={isTimerActive ? "Pausar" : "Reanudar"}>
                                    {isTimerActive ? <PauseIcon className="w-6 h-6 sm:w-7 sm:h-7" /> : <PlayIcon className="w-6 h-6 sm:w-7 sm:h-7" />}
                                </button>
                                <button onClick={resetTimer} className="p-3 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors" aria-label="Reiniciar">
                                    <ArrowPathIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                                </button>
                            </div>
                        )}
                    </main>

                    <footer className="mt-auto pt-4 border-t border-gray-700">
                        <div className="flex justify-between items-center">
                            <button onClick={handlePreviousClick} disabled={currentIndex === 0 && phase === 'EXERCISE'} className="flex items-center px-3 py-2 sm:px-4 sm:py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeftIcon className="w-5 h-5 mr-1 sm:mr-2" />
                                Anterior
                            </button>
                            <button onClick={handleNextClick} className={`flex items-center px-3 py-2 sm:px-4 sm:py-3 font-semibold rounded-lg transition-colors ${ isFinalAction ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}>
                                {nextButtonText}
                                {!isFinalAction && <ChevronRightIcon className="w-5 h-5 ml-1 sm:ml-2" />}
                            </button>
                        </div>
                    </footer>
                </div>
                <style dangerouslySetInnerHTML={{ __html: cssString }} />
            </div>

            {showCloseConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[200] p-4">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white max-w-sm w-full">
                        <h3 id="close-session-dialog-title" className="text-lg font-semibold text-yellow-400 mb-4">Confirmar Salida</h3>
                        <p className="text-gray-300 mb-6">¿Seguro que quieres salir? El progreso de la sesión no guardado se perderá.</p>
                        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                            <button onClick={cancelCloseSession} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 w-full sm:w-auto">Cancelar</button>
                            <button onClick={confirmAndCloseSession} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 w-full sm:w-auto">Salir</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GuidedSessionView;