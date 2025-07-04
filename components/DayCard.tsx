
import React from 'react';
import { TrainingDay, UserDayProgress } from '../types';
import ExerciseRow from './ExerciseRow';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import PlayIcon from './icons/PlayIcon';
import CheckCircleIcon from './icons/CheckCircleIcon'; 
import ArrowPathIcon from './icons/ArrowPathIcon'; // For "Entrenar de Nuevo"

interface DayCardProps {
  day: TrainingDay;
  onStartGuidedSession: (day: TrainingDay) => void;
  onRestartGuidedSession: (day: TrainingDay) => void; // Added prop
  onOpenActivityLibreModal: (day: TrainingDay) => void;
  isSessionPaused?: boolean;
  dayProgress?: UserDayProgress;
  isLocked?: boolean; // Added prop
}

const DayCard: React.FC<DayCardProps> = ({ 
  day, 
  onStartGuidedSession, 
  onRestartGuidedSession,
  onOpenActivityLibreModal, 
  isSessionPaused = false,
  dayProgress,
  isLocked = false 
}) => {
  const isStructuredExerciseDay = day.exercises && day.exercises.length > 0;
  const isActivityLibreDay = !isStructuredExerciseDay && day.notes?.toLowerCase().includes('actividad libre');
  const isRestDay = !isStructuredExerciseDay && day.notes?.toLowerCase().includes('descanso activo');

  const allExercisesCompleted = dayProgress?.allExercisesCompleted || false;

  const canStartNormalSession = isStructuredExerciseDay && !allExercisesCompleted && !isLocked;
  const canMarkActivityLibre = isActivityLibreDay && !allExercisesCompleted && !isLocked;
  
  const startButtonText = isSessionPaused ? "Continuar Sesión Guiada" : "Iniciar Sesión Guiada";
  const startButtonAriaLabel = isSessionPaused ? `Continuar sesión guiada para ${day.dayName}` : `Iniciar sesión guiada para ${day.dayName}`;
  const lockedTooltipText = "Completa los días anteriores de esta semana primero.";

  return (
    <div className={`bg-white shadow-md rounded-lg p-3 md:p-5 mb-6 transition-all duration-300 ${allExercisesCompleted ? 'border-l-4 border-green-500' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <CalendarDaysIcon className="w-6 h-6 text-blue-600 mr-3"/>
          <h3 className="text-xl font-semibold text-blue-700">{day.dayName}</h3>
          {allExercisesCompleted && (
            <span className="ml-3 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center">
              <CheckCircleIcon className="w-4 h-4 mr-1"/>
              {isActivityLibreDay && dayProgress?.activityLibreDetails ? 'Realizado' : 'Sesión Completada'}
            </span>
          )}
        </div>
      </div>
      
      {day.notes && (
        <div className={`p-3 rounded-md mb-4 text-sm ${
          isActivityLibreDay ? 'bg-yellow-50 text-yellow-700' : 
          isRestDay ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
        } italic`}>
          {/* Descripción genérica solo si no hay personalizada */}
          <p>
            {dayProgress?.actividadLibre
              ? `Actividad realizada: ${dayProgress.actividadLibre}${dayProgress.tiempoLibre ? ` — ${dayProgress.tiempoLibre}` : ''}`
              : day.notes}
          </p>
        </div>
      )}

      {isStructuredExerciseDay && (
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full table-fixed">
            <ExerciseRow exercise={{ name: 'Ejercicio', repetitions: 'Repeticiones', rest: 'Descanso' }} isHeader />
            <tbody>
              {day.exercises.map((exercise, index) => (
                <ExerciseRow 
                  key={`${day.dayName}-ex-${index}`} 
                  exercise={exercise} 
                  isCompleted={dayProgress?.completedExerciseIndices?.includes(index) || false}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isStructuredExerciseDay && !allExercisesCompleted && (
        <button
          onClick={() => onStartGuidedSession(day)}
          disabled={!canStartNormalSession}
          className={`w-full flex items-center justify-center mt-3 px-4 py-3 text-white font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-opacity-75 ${
            !canStartNormalSession
              ? 'bg-gray-400 cursor-not-allowed'
              : isSessionPaused 
                ? 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400' 
                : 'bg-green-500 hover:bg-green-600 focus:ring-green-400'
          }`}
          aria-label={startButtonAriaLabel}
          title={isLocked ? lockedTooltipText : (allExercisesCompleted ? "Sesión ya completada" : startButtonAriaLabel)}
        >
          <PlayIcon className="w-5 h-5 mr-2" />
          {startButtonText}
        </button>
      )}
      
      {isStructuredExerciseDay && allExercisesCompleted && (
         <button
            onClick={() => onRestartGuidedSession(day)}
            className="w-full flex items-center justify-center mt-3 px-4 py-3 text-white font-semibold bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-75"
            aria-label={`Entrenar de nuevo para ${day.dayName}`}
          >
            <ArrowPathIcon className="w-5 h-5 mr-2" />
            Entrenar de Nuevo
          </button>
      )}
      
      {isActivityLibreDay && !allExercisesCompleted && (
        <button
          onClick={() => onOpenActivityLibreModal(day)}
          disabled={!canMarkActivityLibre}
          className={`w-full flex items-center justify-center mt-3 px-4 py-3 text-white font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75 ${
            !canMarkActivityLibre ? 'bg-gray-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600'
          }`}
          aria-label={`Marcar como realizada la actividad libre para ${day.dayName}`}
          title={isLocked ? lockedTooltipText : (allExercisesCompleted ? "Actividad ya marcada" : `Marcar como realizada la actividad libre para ${day.dayName}`)}
        >
          <CheckCircleIcon className="w-5 h-5 mr-2" />
          Marcar como Realizado
        </button>
      )}
    </div>
  );
};

export default DayCard;
