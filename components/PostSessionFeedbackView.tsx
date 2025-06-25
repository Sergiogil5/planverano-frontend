
import React from 'react';
import { ActivityLibreDetails } from '../types'; // Import ActivityLibreDetails

interface PostSessionFeedbackViewProps {
  quote: string;
  onClose: (feedback?: { emoji: string; label: string }) => void;
  currentWeekNumber: number;
  currentDayName: string;
  activityLibreDetails?: ActivityLibreDetails; // Added to display if available
  // exerciseRoutes is implicitly handled by App.tsx's feedbackContext when calling onClose
}

const feedbackEmojis = [
  { emoji: '😩', label: 'Muy cansado' },
  { emoji: '😕', label: 'Cansado' },
  { emoji: '🙂', label: 'Bien' },
  { emoji: '😄', label: 'Muy bien' },
  { emoji: '🤩', label: '¡Genial!' },
];

const PostSessionFeedbackView: React.FC<PostSessionFeedbackViewProps> = ({ 
  quote, 
  onClose, 
  currentWeekNumber, 
  currentDayName,
  activityLibreDetails 
}) => {

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    // App.tsx now handles restoring overflow when this component is unmounted or its parent state changes
  }, []);

  const handleEmojiClick = (emojiData: { emoji: string; label: string }) => {
    onClose(emojiData); 
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[120] p-4 text-white animate-fadeIn">
      <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md text-center transform transition-all animate-scaleUp">
        <div className="mb-4 sm:mb-6">
          <span className="text-5xl sm:text-6xl" role="img" aria-label="Party Popper">🎉</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-green-400 mb-2 sm:mb-3">¡Enhorabuena!</h2>
        <p className="text-gray-300 mb-1 text-md sm:text-lg">Has completado {activityLibreDetails ? 'la actividad libre' : 'la sesión'} ({currentDayName}, Semana {currentWeekNumber}).</p>
        {activityLibreDetails && (
          <p className="text-sm text-gray-400 mb-3 sm:mb-4">
            Actividad: {activityLibreDetails.activityType} ({activityLibreDetails.timeSpent})
          </p>
        )}
        <p className="text-yellow-400 italic mb-6 sm:mb-8 text-sm sm:text-base">"{quote}"</p>

        <div className="my-6 sm:my-8">
          <h3 className="text-lg sm:text-xl font-semibold text-blue-300 mb-3 sm:mb-4">¿Cómo te has sentido hoy?</h3>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {feedbackEmojis.map((item) => (
              <button
                key={item.label}
                title={item.label}
                onClick={() => handleEmojiClick(item)}
                className="p-2 sm:p-3 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-transform transform hover:scale-110"
                aria-label={item.label}
              >
                <span className="text-3xl sm:text-4xl">{item.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onClose()} 
          className="mt-4 sm:mt-6 w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors"
        >
          Cerrar (Sin Feedback)
        </button>
      </div>
      <style>{
      `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0.5; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .animate-scaleUp { animation: scaleUp 0.3s ease-out forwards; }
      `}
      </style>
    </div>
  );
};

export default PostSessionFeedbackView;