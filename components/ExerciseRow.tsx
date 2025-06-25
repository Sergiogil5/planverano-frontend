
import React from 'react';
import { Exercise } from '../types';
import FireIcon from './icons/FireIcon';
import ClockIcon from './icons/ClockIcon';
import CheckCircleIcon from './icons/CheckCircleIcon'; // Import CheckCircleIcon

interface ExerciseRowProps {
  exercise: Exercise;
  isHeader?: boolean;
  isCompleted?: boolean; // New prop to indicate completion
}

const ExerciseRow: React.FC<ExerciseRowProps> = ({ exercise, isHeader = false, isCompleted = false }) => {
  const cellClasses = `py-3 px-3 md:px-4 text-sm ${isHeader ? 'font-semibold text-gray-600' : 'text-gray-700'}`;
  const iconClasses = "w-4 h-4 mr-1 inline-block text-blue-500";

  if (isHeader) {
    return (
      <thead className="bg-gray-100 sticky top-0 z-10">
        <tr>
          <th className={`${cellClasses} text-left rounded-tl-lg`}>Ejercicio</th>
          <th className={`${cellClasses} text-center whitespace-nowrap`}>
            <FireIcon className={iconClasses} /> Reps
            </th>
          <th className={`${cellClasses} text-center whitespace-nowrap rounded-tr-lg`}>
            <ClockIcon className={iconClasses} /> Descanso
            </th>
        </tr>
      </thead>
    );
  }

  return (
    <tr className={`border-b border-gray-200 transition-colors duration-100 ${isCompleted ? 'bg-green-50' : 'hover:bg-blue-50'}`}>
      <td className={`${cellClasses} font-medium ${isCompleted ? 'line-through text-gray-500' : ''}`}>
        <div className="flex items-center">
          {isCompleted && <CheckCircleIcon className="w-4 h-4 mr-2 text-green-500 shrink-0" />}
          <span>{exercise.name}</span>
        </div>
      </td>
      <td className={`${cellClasses} text-center whitespace-nowrap ${isCompleted ? 'line-through text-gray-500' : ''}`}>
        {exercise.repetitions}
      </td>
      <td className={`${cellClasses} text-center whitespace-nowrap ${isCompleted ? 'line-through text-gray-500' : ''}`}>
        {exercise.rest}
      </td>
    </tr>
  );
};

export default ExerciseRow;
