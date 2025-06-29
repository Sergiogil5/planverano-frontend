import React, { useState, useEffect, useRef } from 'react';
import ApiService from './ApiService';
import { User, PlayerFeedbackDisplay, Exercise, Coordinate, ApiBloque } from '../types';
import { TRAINING_DATA } from '../constants';
import ChevronLeftIcon from './icons/ChevronLeftIcon'; 
import TrashIcon from './icons/TrashIcon'; // Import TrashIcon
import XCircleIcon from './icons/XCircleIcon'; // For modal close
import L from 'leaflet'; // Import Leaflet

// Helper function to check if an exercise is a running exercise
const RUNNING_EXERCISES_FOR_TRACKING = ['carrera suave', 'carrera continua'];

// Map Component (nested for simplicity, can be moved to its own file)
interface RouteMapProps {
  routeCoordinates: Coordinate[];
  exerciseName: string;
}

const RouteMap: React.FC<RouteMapProps> = ({ routeCoordinates, exerciseName }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current && routeCoordinates.length > 0) {
      // Initialize map
      mapRef.current = L.map(mapContainerRef.current).setView([routeCoordinates[0].lat, routeCoordinates[0].lng], 15);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      // Prepare LatLng array for polyline
      const latLngs = routeCoordinates.map(coord => L.latLng(coord.lat, coord.lng));
      
      // Add polyline to map
      L.polyline(latLngs, { color: 'blue', weight: 5 }).addTo(mapRef.current);

      // Fit map to bounds of the polyline
      if (latLngs.length > 0) {
        mapRef.current.fitBounds(L.polyline(latLngs).getBounds(), { padding: [30, 30] }); // Increased padding
        
        // Add markers for start and end points
        L.marker(latLngs[0], { title: `Inicio: ${exerciseName}` })
          .addTo(mapRef.current)
          .bindPopup(`<b>Inicio:</b> ${exerciseName}`)
          .openPopup();
          
        if (latLngs.length > 1) {
          L.marker(latLngs[latLngs.length - 1], { title: `Fin: ${exerciseName}` })
            .addTo(mapRef.current)
            .bindPopup(`<b>Fin:</b> ${exerciseName}`);
        }
      }
    }
    
    // Cleanup function to remove map instance when component unmounts or coordinates change
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [routeCoordinates, exerciseName]); // Re-run effect if coordinates or exerciseName change

  if (routeCoordinates.length === 0) {
    return <p className="text-gray-400 text-sm italic py-2">No hay datos de ruta GPS para mostrar para: {exerciseName}.</p>;
  }

  // Ensure map container has a defined height, otherwise it won't be visible
  return <div ref={mapContainerRef} style={{ height: '250px', width: '100%', borderRadius: '8px', marginBottom: '10px' }} aria-label={`Mapa de ruta para ${exerciseName}`}></div>;
};


// Helper functions
const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return 'N/A';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDayExercises = (weekNumber: number, dayName: string): Exercise[] => {
  const week = TRAINING_DATA.weeks.find(w => w.weekNumber === weekNumber);
  const day = week?.days.find(d => d.dayName === dayName);
  return day?.exercises || [];
};

interface PlayerFeedbackDetailViewProps {
  player: User;
  onClose: () => void; 
}

const PlayerFeedbackDetailView: React.FC<PlayerFeedbackDetailViewProps> = ({ player, onClose }) => {
  const [playerFeedback, setPlayerFeedback] = useState<PlayerFeedbackDisplay[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  useEffect(() => {
    const fetchFeedback = async () => {
      setLoadingFeedback(true);
      setError(null);
      try {
        const feedback = await ApiService.getPlayerFeedback(String(player.id));
        setPlayerFeedback(feedback);
      } catch (err: any ) {
        console.error(`Error fetching feedback for ${player.nombreCompleto}:`, err);
        setError("No se pudo cargar el feedback del jugador.");
        setPlayerFeedback([]);
      } finally {
        setLoadingFeedback(false);
      }
    };
    fetchFeedback();
  }, [player]);

  const playerDisplayName = `${player.nombreCompleto}`;
  const playerTitle = player.codigoRegistro  
    ? `${playerDisplayName} (${player.codigoRegistro})` 
    : playerDisplayName;

  const handleDeletePlayer = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await ApiService.deletePlayer(String(player.id));
      setShowDeleteConfirmModal(false);
      onClose(); // Go back to player list
    } catch (err: any) {
      console.error("Error deleting player:", err);
      setDeleteError(err.message || "Error al eliminar el jugador.");
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <>
      <div className="bg-gray-800 p-4 rounded-lg shadow-xl flex flex-col h-full overflow-hidden">
        <header className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
          <div className="flex-1 min-w-0"> {/* Added for truncation */}
            <h2 className="text-xl sm:text-2xl font-semibold text-purple-300 truncate" title={`Feedback de ${playerTitle} (${player.team})`}>
              Feedback de {playerDisplayName} 
              {player.team && <span className="text-sm text-gray-400 ml-2">({player.team})</span>}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDeleteConfirmModal(true)}
              className="flex items-center text-sm px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white"
              aria-label="Eliminar jugador"
              title="Eliminar Jugador"
            >
              <TrashIcon className="w-5 h-5 mr-1.5" />
              Eliminar
            </button>
            <button
              onClick={onClose}
              className="flex items-center text-sm px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-gray-300"
              aria-label="Volver a la lista de jugadores"
            >
              <ChevronLeftIcon className="w-5 h-5 mr-1.5" />
              Volver
            </button>
          </div>
        </header>

        {loadingFeedback ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-400"></div>
          </div>
        ) : error ? (
           <p className="text-red-400 bg-red-900 p-3 rounded-md text-center flex-1 flex items-center justify-center">{error}</p>
        ) : playerFeedback.length === 0 ? (
          <p className="text-gray-400 text-center flex-1 flex items-center justify-center">No hay feedback para este jugador.</p>
        ) : (
          <div className="overflow-y-auto custom-scrollbar-details pr-2 flex-1">
            <ul className="space-y-4">
              {playerFeedback.map((fb: any) => {
                // --- ¡AQUÍ ESTÁ LA MAGIA! ---
                // fb.sesion contiene el objeto SesionDiaria del backend
                const weekNum = fb.sesion.numeroSemana;
                const dayName = fb.sesion.titulo;
                const exercisesForDay = getDayExercises(weekNum, dayName);
                
                let tiempos: Record<number, number> = {};
                if (fb.tiemposJson) {
                  try { tiempos = JSON.parse(fb.tiemposJson); } catch (e) { console.error("Error al parsear tiemposJson:", e); }
                }

                let rutas: Record<number, Coordinate[]> = {};
                if (fb.rutaGpsJson) {
                  try { rutas = JSON.parse(fb.rutaGpsJson); } catch (e) { console.error("Error al parsear rutaGpsJson:", e); }
                }
                return (
                  <li key={fb.id} className="bg-gray-700 p-4 rounded-md shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-lg text-purple-300">Semana {weekNum} - {dayName}</span>
                      <span className="text-xs text-gray-400">{formatDate(fb.completedAt)}</span>
                    </div>
                    <div className="flex items-center mb-2">
                      <span className="text-4xl mr-3">{fb.feedbackEmoji}</span>
                      <span className="text-lg text-gray-200">{fb.feedbackLabel}</span>
                    </div>
                    {fb.feedbackTextoOpcional && (
                        <p className="text-sm italic text-gray-400 mt-1 pl-2 border-l-2 border-gray-600">"{fb.feedbackTextoOpcional}"</p>
                    )}
                    
                    {(exercisesForDay.length > 0) && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <h4 className="text-md font-semibold text-purple-200 mb-2">Detalles de la Sesión:</h4>
                        <ul className="space-y-1.5 text-xs">
                          {Object.entries(tiempos).map(([indexStr, duration]) => {
                            // exerciseIndex es el "0", "1", "2"... y duration es el tiempo en segundos
                            const exerciseIndex = parseInt(indexStr, 10);
                            // ¡CAMBIO CLAVE! Buscamos el nombre del ejercicio DIRECTAMENTE
                            // en los datos que vienen del backend para ese día.
                            // Esto es mucho más robusto.
                            const exerciseName = fb.sesion.bloques
                                ?.flatMap((b: ApiBloque) => b.pasos)
                                ?.[exerciseIndex]?.nombreEjercicio || `Ejercicio ${exerciseIndex + 1}`;
                            const routeData = rutas[exerciseIndex];

                            
                            return (
                              <li key={exerciseIndex} className="py-1.5 px-2 bg-gray-600 rounded">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-gray-300 flex-1 mr-2">{exerciseName} </span>                                  
                                  <span className="font-mono text-green-300">
                                    {formatDuration(duration)}
                                  </span>
                                </div>
                                {routeData && routeData.length > 0 && (
                                  <RouteMap routeCoordinates={routeData} exerciseName={exerciseName} />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <style>{`
          .custom-scrollbar-details::-webkit-scrollbar { width: 8px; }
          .custom-scrollbar-details::-webkit-scrollbar-track { background: #1f2937; /* gray-800 */ border-radius: 10px; }
          .custom-scrollbar-details::-webkit-scrollbar-thumb { background: #4b5563; /* gray-600 */ border-radius: 10px; }
          .custom-scrollbar-details::-webkit-scrollbar-thumb:hover { background: #6b7280; /* gray-500 */ }
          .bg-gray-650 { background-color: rgba(75, 85, 99, 0.5); /* gray-600 with opacity */ }
          .text-xxs { font-size: 0.65rem; line-height: 0.85rem; }
        `}</style>
      </div>

      {showDeleteConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200] p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-white max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 id="delete-confirm-title" className="text-lg font-semibold text-red-400">Confirmar Eliminación</h3>
              <button onClick={() => setShowDeleteConfirmModal(false)} className="p-1 rounded-full hover:bg-gray-700" aria-label="Cerrar modal">
                <XCircleIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <p id="delete-confirm-description" className="text-gray-300 mb-6">
              ¿Estás seguro que quieres eliminar a <strong>{player.nombreCompleto}</strong> del plan de entrenamiento? Esta acción es irreversible.
            </p>
            {deleteError && (
              <div className="bg-red-900 border border-red-700 text-red-300 px-3 py-2 rounded-md relative mb-4 text-sm" role="alert">
                {deleteError}
              </div>
            )}
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePlayer}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlayerFeedbackDetailView;