// src/components/GuidedSessionView.tsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TrainingDay, Exercise, PausedSessionState, GuidedSessionViewProps as OriginalGuidedSessionViewProps, ExercisePerformanceData, Coordinate, ExerciseRoutesData } from '../types';
import XCircleIcon from './icons/XCircleIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import ArrowRightStartOnRectangleIcon from './icons/ArrowRightStartOnRectangleIcon';
import ClockIcon from './icons/ClockIcon';
import LinkIcon from './icons/LinkIcon';

// --- INTERFAZ DE PROPS COMPLETA Y CORRECTA ---
// Extendemos la interfaz original que viene de types.ts y le añadimos la nueva prop.
interface CustomGuidedSessionViewProps extends OriginalGuidedSessionViewProps {
    postWorkoutStretchUrl: string;
}

// --- Funciones de Ayuda y Constantes (Completas) ---

// Tu código de antes
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

const GuidedSessionView: React.FC<CustomGuidedSessionViewProps> = ({ day, onClose, onPauseAndExit, postWorkoutStretchUrl, initialState }) => {
    
    // --- ESTADOS Y REFS (SIMPLIFICADOS PERO COMPLETOS) ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState<'EXERCISE' | 'REST'>('EXERCISE');
    const [timeLeft, setTimeLeft] = useState(0);
    const [isTimerPaused, setIsTimerPaused] = useState(true);
    const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
    const [locationStatus, setLocationStatus] = useState<string | null>(null);

    const exerciseDurationsRef = useRef<ExercisePerformanceData>({});
    const exerciseStartTimeRef = useRef<number | null>(null);
    const intervalRef = useRef<number | null>(null);
    const completedIndicesInRunRef = useRef<Set<number>>(new Set());
    const allCollectedRoutesRef = useRef<ExerciseRoutesData>({});
    const locationWatchIdRef = useRef<number | null>(null);
    const currentRoutePointsRef = useRef<Coordinate[]>([]);

    const exercises = day.exercises;

    // --- LÓGICA DE GPS ---
    const stopLocationTracking = useCallback(() => {
        if (locationWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(locationWatchIdRef.current);
            locationWatchIdRef.current = null;
        }
        if (currentRoutePointsRef.current.length > 0) {
            allCollectedRoutesRef.current[currentIndex] = [...currentRoutePointsRef.current];
            currentRoutePointsRef.current = [];
        }
    }, [currentIndex]);

    const startLocationTracking = useCallback(() => {
        const currentEx = exercises[currentIndex];
        if (!currentEx || !RUNNING_EXERCISES.includes(currentEx.name.toLowerCase())) {
            stopLocationTracking();
            return;
        }

        setLocationStatus("Solicitando permiso...");
        navigator.geolocation.watchPosition(
            (position) => {
                setLocationStatus("Seguimiento activo.");
                const { latitude, longitude } = position.coords;
                currentRoutePointsRef.current.push({ lat: latitude, lng: longitude, timestamp: position.timestamp });
            },
            () => setLocationStatus("No se pudo obtener la ubicación."),
            { enableHighAccuracy: true }
        );
    }, [currentIndex, exercises, stopLocationTracking]);

    // --- LÓGICA CENTRAL REFACTORIZADA ---

    const stopTimer = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsTimerPaused(true);
    }, []);

    const commitCurrentStepTime = useCallback(() => {
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
        stopLocationTracking();
    }, [phase, currentIndex, exercises, timeLeft, stopLocationTracking]);
    
    const setupStep = useCallback((index: number, phaseToSetup: 'EXERCISE' | 'REST', startPaused = false) => {
        const totalExercises = exercises.length;
        if (index >= totalExercises) {
            onClose('completed', Array.from(completedIndicesInRunRef.current), { ...exerciseDurationsRef.current }, { ...allCollectedRoutesRef.current });
            return;
        }

        setCurrentIndex(index);
        setPhase(phaseToSetup);
        
        const currentEx = exercises[index];
        const duration = parseTimeToSeconds(phaseToSetup === 'EXERCISE' ? currentEx.repetitions : currentEx.rest);
        setTimeLeft(duration);
        
        if (duration > 0) {
            setIsTimerPaused(startPaused);
        } else {
            setIsTimerPaused(true);
            if (phaseToSetup === 'EXERCISE') {
                exerciseStartTimeRef.current = Date.now();
            }
        }
    }, [exercises, onClose]);

    const advanceToNextStep = useCallback(() => {
        commitCurrentStepTime();
        stopTimer();
        
        const currentEx = exercises[currentIndex];
        const hasRest = parseTimeToSeconds(currentEx.rest) > 0;
        
        if (phase === 'EXERCISE' && hasRest) {
            setupStep(currentIndex, 'REST');
        } else {
            setupStep(currentIndex + 1, 'EXERCISE');
        }
    }, [commitCurrentStepTime, stopTimer, currentIndex, exercises, phase, setupStep]);

    // --- EFECTOS ---

    useEffect(() => {
        if (!isTimerPaused && timeLeft > 0) {
            intervalRef.current = window.setInterval(() => {
                setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
            }, 1000);
        } else if (!isTimerPaused && timeLeft === 0) {
            advanceToNextStep();
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [timeLeft, isTimerPaused, advanceToNextStep]);
    
    useEffect(() => {
        if (initialState) {
            if(initialState.accumulatedDurations) exerciseDurationsRef.current = initialState.accumulatedDurations;
            if(initialState.accumulatedRoutes) allCollectedRoutesRef.current = initialState.accumulatedRoutes;
            setupStep(initialState.exerciseIndex, initialState.phase, false);
            setTimeLeft(initialState.timeLeftInSeconds);
        } else {
            setupStep(0, 'EXERCISE', true);
        }
    }, [day, initialState, setupStep]);

    const currentExercise = exercises[currentIndex];

    // Efecto para voz, GIFs y GPS
    useEffect(() => {
        if (!currentExercise) return;

        // Lógica de Voz
        let speechText = "";
        const durationForSpeech = parseTimeToSeconds(phase === 'EXERCISE' ? currentExercise.repetitions : currentExercise.rest);
        if (phase === 'EXERCISE') {
            let name = currentExercise.name.replace(/(\d+)\s*m/i, '$1 metros');
            speechText = `${name}`;
            if (durationForSpeech > 0) {
                speechText += `, ${formatSpokenTime(durationForSpeech)}`;
            } else {
                speechText += `, ${parseInt(currentExercise.repetitions, 10)} repeticiones`;
            }
        } else { // REST
            speechText = `Descanso de ${formatSpokenTime(durationForSpeech)}`;
        }
        speak(speechText, true);

        // Lógica de GPS
        if (phase === 'EXERCISE') {
            startLocationTracking();
        } else {
            stopLocationTracking();
        }

    }, [currentIndex, phase, currentExercise, startLocationTracking, stopLocationTracking]);

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


    // --- MANEJADORES DE LA UI (COMPLETOS) ---
    const handleNextClick = () => advanceToNextStep();
    const handlePreviousClick = () => {
        commitCurrentStepTime();
        stopTimer();
        if (phase === 'REST') {
            setupStep(currentIndex, 'EXERCISE', true);
        } else if (currentIndex > 0) {
            setupStep(currentIndex - 1, 'EXERCISE', true);
        }
    };
    const toggleTimer = () => setIsTimerPaused(prev => !prev);
    const resetTimer = () => {
        const currentEx = exercises[currentIndex];
        const duration = parseTimeToSeconds(phase === 'EXERCISE' ? currentEx.repetitions : currentEx.rest);
        if (duration > 0) {
            setTimeLeft(duration);
            setIsTimerPaused(false);
        }
    };

    const handlePauseAndExitClick = () => {
        stopTimer();
        commitCurrentStepTime();
        onPauseAndExit(
            {
                exerciseIndex: currentIndex,
                phase: phase,
                timeLeftInSeconds: timeLeft,
                initialDurationInSeconds: 0,
            },
            Array.from(completedIndicesInRunRef.current),
            { ...exerciseDurationsRef.current },
            { ...allCollectedRoutesRef.current }
        );
    };

    const confirmAndCloseSession = () => {
        commitCurrentStepTime();
        onClose('closed_manually', Array.from(completedIndicesInRunRef.current), { ...exerciseDurationsRef.current }, { ...allCollectedRoutesRef.current });
        setShowCloseConfirmModal(false);
    };

    // --- RENDERIZADO (JSX COMPLETO) ---
    if (!currentExercise) return null;
    
    const isTimedStep = parseTimeToSeconds(phase === 'EXERCISE' ? currentExercise.repetitions : currentExercise.rest) > 0;
    
    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-center z-[100] p-3 md:p-6 text-white">
                <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col">
                    <header className="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
                        <div>
                            <h2 id="guided-session-title" className="text-xl sm:text-2xl font-bold text-blue-400">{day.dayName}</h2>
                            <p className="text-xs sm:text-sm text-gray-400">
                                {phase === 'EXERCISE' ? `Ejercicio ${currentIndex + 1} de ${exercises.length}` : 'Descanso'}
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={handlePauseAndExitClick} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Pausar y salir">
                                <ArrowRightStartOnRectangleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400" />
                            </button>
                            <button onClick={() => { stopTimer(); setShowCloseConfirmModal(true); }} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Cerrar sesión">
                                <XCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-red-500" />
                            </button>
                        </div>
                    </header>

                    <main id="guided-session-content" className="flex-grow overflow-y-auto mb-4 custom-scrollbar pr-2 text-center">
                        {phase === 'EXERCISE' ? (
                            <>
                                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                                    <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2">{currentExercise.name}</h3>
                                </div>
                                {currentExercise.name.toLowerCase().includes('estiramientos') && (
                                  <div className="mt-4">
                                    <a
                                      href={postWorkoutStretchUrl} // Usamos la prop que ya recibe el componente
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center px-4 py-3 my-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-teal-500 hover:bg-teal-600"
                                    >
                                      <LinkIcon className="w-5 h-5 mr-2" />
                                      Ver Video de Estiramientos
                                    </a>
                                  </div>
                                )}
                                {isTimedStep ? (
                                    <div className="text-6xl sm:text-8xl font-mono font-bold text-green-400 my-4 tabular-nums">{formatTime(timeLeft)}</div>
                                ) : (
                                    <div className="my-4">
                                        <div className="text-5xl sm:text-7xl font-bold text-green-400 mb-2">{currentExercise.repetitions}</div>
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
                        ) : (
                            <>
                                <div className="bg-gray-750 p-3 sm:p-4 rounded-lg mb-3 shadow">
                                    <h3 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-2">Descanso</h3>
                                </div>
                                <div className="text-6xl sm:text-8xl font-mono font-bold text-green-400 my-4 tabular-nums">{formatTime(timeLeft)}</div>
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
                            <button onClick={handlePreviousClick} disabled={currentIndex === 0 && phase === 'EXERCISE'} className="flex items-center px-4 py-3 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50">
                                <ChevronLeftIcon className="w-5 h-5 mr-2" />
                                Anterior
                            </button>
                            <button onClick={handleNextClick} className="flex items-center px-4 py-3 bg-blue-500 rounded-lg hover:bg-blue-600">
                                Siguiente
                                <ChevronRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
            
            {showCloseConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[200]">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white max-w-sm w-full">
                        <h3 className="text-lg font-semibold text-yellow-400 mb-4">Confirmar Salida</h3>
                        <p className="text-gray-300 mb-6">¿Seguro que quieres salir? El progreso no guardado se perderá.</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setShowCloseConfirmModal(false)} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500">Cancelar</button>
                            <button onClick={confirmAndCloseSession} className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-700">Salir</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GuidedSessionView;