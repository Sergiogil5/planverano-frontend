
import React from 'react';
import { TrainingWeek, TrainingDay, PausedSessionState, UserDayProgress } from '../types';
import DayCard from './DayCard';

interface WeekViewProps {
  week: TrainingWeek;
  onStartGuidedSession: (day: TrainingDay) => void;
  onRestartGuidedSession: (day: TrainingDay) => void; // Added prop
  onOpenActivityLibreModal: (day: TrainingDay) => void;
  pausedSessionDetails: PausedSessionState | null;
  userProgress: Record<string, UserDayProgress>;
  getDayKey: (weekNum: number, dayName: string) => string;
}

const WeekView: React.FC<WeekViewProps> = ({ 
  week, 
  onStartGuidedSession, 
  onRestartGuidedSession,
  onOpenActivityLibreModal,
  pausedSessionDetails,
  userProgress,
  getDayKey
}) => {
  return (
    <div className="mt-2">
      {week.days.map((day, index) => {
        const isPaused = pausedSessionDetails?.weekNumber === week.weekNumber && pausedSessionDetails?.dayName === day.dayName;
        const dayKey = getDayKey(week.weekNumber, day.dayName);
        const dayProgress = userProgress[dayKey];

        let isLocked = false;
        if (index > 0) { // No need to check for the first day
          for (let j = 0; j < index; j++) {
            const previousDay = week.days[j];
            // Skip "Descanso activo" days for locking logic
            if (previousDay.notes?.toLowerCase().includes('descanso activo')) {
              continue;
            }
            const previousDayKey = getDayKey(week.weekNumber, previousDay.dayName);
            const previousDayProgress = userProgress[previousDayKey];
            if (!previousDayProgress || !previousDayProgress.allExercisesCompleted) {
              isLocked = true;
              break;
            }
          }
        }
        
        return (
          <DayCard 
            key={`${week.weekNumber}-day-${index}`} 
            day={day} 
            onStartGuidedSession={onStartGuidedSession}
            onRestartGuidedSession={onRestartGuidedSession}
            onOpenActivityLibreModal={onOpenActivityLibreModal}
            isSessionPaused={isPaused}
            dayProgress={dayProgress}
            isLocked={isLocked} // Pass down isLocked status
          />
        );
      })}
    </div>
  );
};

export default WeekView;
