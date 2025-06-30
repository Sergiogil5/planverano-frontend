// src/components/PlayerFeedbackDetailView.tsx

import React, { useState, useEffect, useRef } from 'react';
import ApiService from './ApiService';
import { User, Coordinate, ApiBloque } from '../types';
import ChevronLeftIcon from './icons/ChevronLeftIcon'; 
import L from 'leaflet';

// --- INTERFAZ PARA EL FEEDBACK (Define la estructura que esperamos de la API) ---
interface FeedbackFromApi {
    id: number;
    completedAt: string;
    feedbackEmoji: string;
    feedbackLabel: string;
    tiemposJson?: string;
    rutaGpsJson?: string;
    sesion: { // Objeto SesionDiaria anidado, enviado por el backend
        id: number;
        numeroSemana: number;
        titulo: string;
        bloques: ApiBloque[] | null; // <-- ¡La fuente de la verdad para los ejercicios!
    };
}

// --- COMPONENTE MAPA ---
const RouteMap: React.FC<{ routeCoordinates: Coordinate[]; exerciseName: string }> = ({ routeCoordinates, exerciseName }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!mapContainerRef.current || routeCoordinates.length === 0) return;

        const map = L.map(mapContainerRef.current).setView([routeCoordinates[0].lat, routeCoordinates[0].lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const latLngs = routeCoordinates.map(c => L.latLng(c.lat, c.lng));
        const polyline = L.polyline(latLngs, { color: 'blue' }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

        // ¡SOLUCIÓN! Envolvemos la limpieza en una función que no devuelve nada.
        return () => {
            map.remove();
        }; 
    }, [routeCoordinates, exerciseName]);
    // ¡SOLUCIÓN! Si no hay coordenadas, devolvemos null explícitamente.
    if (routeCoordinates.length === 0) {
        return null;
    }

    // Si hay coordenadas, devolvemos el div del mapa.
    return <div ref={mapContainerRef} style={{ height: '200px', width: '100%', borderRadius: '8px', marginTop: '8px' }} />;
};

// --- VISTA DE DETALLE DE UNA SESIÓN ---
const FeedbackDetail: React.FC<{ feedback: FeedbackFromApi; onBack: () => void; }> = ({ feedback, onBack }) => {
    const { sesion, completedAt, feedbackEmoji, feedbackLabel, tiemposJson, rutaGpsJson } = feedback;
    
    // 1. Parseamos los JSON de tiempos y rutas
    const tiempos: Record<number, number> = JSON.parse(tiemposJson || '{}');
    const rutas: Record<number, Coordinate[]> = JSON.parse(rutaGpsJson || '{}');

    // 2. ¡AQUÍ ESTÁ LA LÓGICA CLAVE!
    // Reconstruimos la lista de ejercicios en orden, usando los datos del backend.
    const allExercisesInOrder = sesion.bloques?.flatMap(
        bloque => Array.from({ length: bloque.repeticionesBloque }, () => bloque.pasos).flat()
    ) || [];

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
                <h3 className="text-xl font-semibold text-purple-300">Detalle de Sesión</h3>
                <button onClick={onBack} className="flex items-center text-sm px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
                    <ChevronLeftIcon className="w-5 h-5 mr-1.5" /> Volver al Historial
                </button>
            </header>
            <div className="overflow-y-auto custom-scrollbar-details pr-2 flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-lg text-purple-300">Semana {sesion.numeroSemana} - {sesion.titulo}</span>
                    <span className="text-xs text-gray-400">{new Date(completedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="flex items-center mb-3 p-3 bg-gray-600 rounded-lg">
                    <span className="text-4xl mr-3">{feedback.feedbackEmoji}</span>
                    <span className="text-lg text-gray-200">{feedback.feedbackLabel}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-600">
                    <h4 className="text-md font-semibold text-purple-200 mb-2">Tiempos de Ejercicio:</h4>
                    {Object.keys(tiempos).length > 0 ? (
                        <ul className="space-y-1.5 text-sm">
                            {/* 3. Mapeamos los tiempos y usamos el índice para obtener el nombre correcto */}
                            {Object.entries(tiempos).map(([indexStr, duration]) => {
                                const index = parseInt(indexStr, 10);
                                // Obtenemos el nombre del ejercicio de la lista que reconstruimos del backend
                                const exerciseName = allExercisesInOrder[index]?.nombreEjercicio || `Ejercicio ${index + 1}`;
                                const routeData = rutas[index];
                                return (
                                    <li key={index} className="p-2 bg-gray-700 rounded-md">
                                        <div className="flex justify-between items-center">
                                            <span>{exerciseName}</span>
                                            <span className="font-mono text-green-300">{`${Math.floor(duration / 60).toString().padStart(2, '0')}:${Math.floor(duration % 60).toString().padStart(2, '0')}`}</span>
                                        </div>
                                        {routeData && <RouteMap routeCoordinates={routeData} exerciseName={exerciseName} />}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm italic text-gray-400">No se registraron tiempos para esta sesión (ej. Actividad Libre).</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- VISTA DE LISTA DE FEEDBACKS ---
const FeedbackList: React.FC<{ feedbacks: FeedbackFromApi[]; onSelect: (fb: FeedbackFromApi) => void; }> = ({ feedbacks, onSelect }) => (
    <ul className="space-y-3 overflow-y-auto custom-scrollbar-details pr-2 flex-1">
        {feedbacks.map((fb) => (
            <li key={fb.id}>
                <button onClick={() => onSelect(fb)} className="w-full text-left p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                    <div className="flex justify-between text-sm">
                        <span className="font-bold text-white">Semana {fb.sesion.numeroSemana} - {fb.sesion.titulo}</span>
                        <span className="text-gray-400">{new Date(fb.completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span>
                    </div>
                    <div className="flex items-center mt-2">
                        <span className="text-2xl mr-2">{fb.feedbackEmoji}</span>
                        <span className="text-gray-300">{fb.feedbackLabel}</span>
                    </div>
                </button>
            </li>
        ))}
    </ul>
);

// --- COMPONENTE PRINCIPAL (GESTOR DE VISTAS) ---
const PlayerFeedbackDetailView: React.FC<{ player: User; onClose: () => void; }> = ({ player, onClose }) => {
    const [allFeedback, setAllFeedback] = useState<FeedbackFromApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFeedback, setSelectedFeedback] = useState<FeedbackFromApi | null>(null);

    useEffect(() => {
        setLoading(true);
        ApiService.getPlayerFeedback(String(player.id))
            .then(data => {
                data.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
                setAllFeedback(data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [player.id]);

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-xl flex flex-col h-full overflow-hidden text-white">
            {selectedFeedback ? (
                // Si hay un feedback seleccionado, muestra la vista de detalle
                <FeedbackDetail feedback={selectedFeedback} onBack={() => setSelectedFeedback(null)} />
            ) : (
                // Si no, muestra el historial
                <div className="flex flex-col h-full">
                    <header className="flex-shrink-0 flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
                        <h2 className="text-xl font-semibold text-purple-300">Historial de {player.nombreCompleto}</h2>
                        <button onClick={onClose} className="flex items-center text-sm px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
                             <ChevronLeftIcon className="w-5 h-5 mr-1.5" /> Volver a Jugadores
                        </button>
                    </header>
                    <div className="flex-grow overflow-y-auto">
                    {loading ? <p className="text-center p-4">Cargando historial...</p> : 
                     allFeedback.length === 0 ? <p className="text-center p-4">No hay progresos registrados.</p> :
                     <FeedbackList feedbacks={allFeedback} onSelect={setSelectedFeedback} />
                    }
                </div>
            </div>
            )}
            <style>{`.custom-scrollbar-details::-webkit-scrollbar { width: 8px; } .custom-scrollbar-details::-webkit-scrollbar-track { background: #1f2937; } .custom-scrollbar-details::-webkit-scrollbar-thumb { background: #4b5563; }`}</style>
        </div>
    );
};

export default PlayerFeedbackDetailView;