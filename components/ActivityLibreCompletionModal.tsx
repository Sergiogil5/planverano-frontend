
import React, { useState } from 'react';
import { ActivityLibreDetails } from '../types';
import XCircleIcon from './icons/XCircleIcon';

interface ActivityLibreCompletionModalProps {
  dayName: string;
  onClose: () => void;
  onSubmit: (details: ActivityLibreDetails) => void;
}

const ActivityLibreCompletionModal: React.FC<ActivityLibreCompletionModalProps> = ({ dayName, onClose, onSubmit }) => {
  const [activityType, setActivityType] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityType.trim() || !timeSpent.trim()) {
      setError('Ambos campos son obligatorios.');
      return;
    }
    setError('');
    onSubmit({ activityType, timeSpent });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[110] p-4 text-gray-800">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-blue-700">Completar Actividad Libre</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <XCircleIcon className="w-7 h-7 text-red-500" />
          </button>
        </div>
        <p className="text-gray-600 mb-1">Día: <span className="font-medium">{dayName}</span></p>
        <p className="text-sm text-gray-500 mb-6">Introduce los detalles de la actividad realizada.</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="activityType" className="block text-sm font-medium text-gray-700">
              Actividad Realizada
            </label>
            <input
              type="text"
              id="activityType"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              placeholder="Ej: Ciclismo, Senderismo, Padel"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="timeSpent" className="block text-sm font-medium text-gray-700">
              Tiempo Empleado
            </label>
            <input
              type="text"
              id="timeSpent"
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              placeholder="Ej: 1 hora, 45 minutos"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div className="flex justify-end pt-2 space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Guardar y Completar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityLibreCompletionModal;
