
import React from 'react';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';

interface WeekSelectorProps {
  currentWeekNumber: number;
  totalWeeks: number;
  onWeekChange: (weekNumber: number) => void;
  weekTitle: string;
}

const WeekSelector: React.FC<WeekSelectorProps> = ({ currentWeekNumber, totalWeeks, onWeekChange, weekTitle }) => {
  const handlePrevious = () => {
    if (currentWeekNumber > 1) {
      onWeekChange(currentWeekNumber - 1);
    }
  };

  const handleNext = () => {
    if (currentWeekNumber < totalWeeks) {
      onWeekChange(currentWeekNumber + 1);
    }
  };

  return (
    <div className="my-6 p-4 bg-white shadow-lg rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrevious}
          disabled={currentWeekNumber === 1}
          className="p-3 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          aria-label="Previous Week"
        >
          <ChevronLeftIcon className="w-6 h-6 text-blue-600" />
        </button>
        <div className="text-center">
            <h2 className="text-2xl font-bold text-blue-700">Semana {currentWeekNumber}</h2>
            <p className="text-sm text-gray-600">{weekTitle}</p>
        </div>
        <button
          onClick={handleNext}
          disabled={currentWeekNumber === totalWeeks}
          className="p-3 rounded-full hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          aria-label="Next Week"
        >
          <ChevronRightIcon className="w-6 h-6 text-blue-600" />
        </button>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
          style={{ width: `${(currentWeekNumber / totalWeeks) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

export default WeekSelector;
