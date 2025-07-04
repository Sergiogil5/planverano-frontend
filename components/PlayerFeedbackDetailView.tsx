// src/components/PlayerFeedbackDetailView.tsx

import React, { useState, useEffect, useRef } from 'react';
import ApiService from './ApiService';
import { User, Coordinate, ApiBloque } from '../types';
import ChevronLeftIcon from './icons/ChevronLeftIcon'; 
import L from 'leaflet';

// --- INTERFAZ ---
interface FeedbackFromApi {
    id: number;
    completedAt: string;
    feedbackEmoji: string;
    feedbackLabel: string;
    tiemposJson?: string;
    rutaGpsJson?: string;
    sesion: {
        id: number;
        numeroSemana: number;
        titulo:string;
        bloques: ApiBloque[] | null;
    };
    actividadLibre?: string;
    tiempoLibre?: string;
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
        return () => { map.remove(); };
    }, [routeCoordinates, exerciseName]);
    if (routeCoordinates.length === 0) return null;
    return <div ref={mapContainerRef} style={{ height: '200px', width: '100%', borderRadius: '8px', marginTop: '8px' }} />;
};

// --- VISTA DE DETALLE DE UNA SESIÓN ---
const FeedbackDetail: React.FC<{ feedback: FeedbackFromApi; onBack: () => void; scrollContainerRef: React.Ref<HTMLDivElement> }> = ({ feedback, onBack, scrollContainerRef }) => {
    const { sesion, completedAt, feedbackEmoji, feedbackLabel, tiemposJson, rutaGpsJson } = feedback;
    const tiempos: Record<number, number> = JSON.parse(tiemposJson || '{}');
    const rutas: Record<number, Coordinate[]> = JSON.parse(rutaGpsJson || '{}');
    const allExercisesInOrder = sesion.bloques?.flatMap(b => Array.from({ length: b.repeticionesBloque }, () => b.pasos).flat()) || [];

    return (
        <div className="flex flex-col h-full">
            <header className="flex-shrink-0 flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
                <h3 className="text-xl font-semibold text-purple-300">Detalle de Sesión</h3>
                <button onClick={onBack} className="flex items-center text-sm px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
                    <ChevronLeftIcon className="w-5 h-5 mr-1.5" /> Volver al Historial
                </button>
            </header>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar-details pr-2">
                <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-lg text-purple-300">Semana {sesion.numeroSemana} - {sesion.titulo}</span>
                    <span className="text-xs text-gray-400">{new Date(completedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="flex items-center mb-3 p-3 bg-gray-600 rounded-lg">
                    <span className="text-4xl mr-3">{feedbackEmoji}</span>
                    <span className="text-lg text-gray-200">{feedbackLabel}</span>
                </div>
                {feedback.actividadLibre && (
                    <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-200">
                        Actividad libre: <strong>{feedback.actividadLibre}</strong>
                        {feedback.tiempoLibre && <> — {feedback.tiempoLibre}</>}
                        </p>
                    </div>
                )}
                <div className="mt-4 pt-4 border-t border-gray-600">
                    <h4 className="text-md font-semibold text-purple-200 mb-2">Tiempos de Ejercicio:</h4>
                    {Object.keys(tiempos).length > 0 ? (
                        <ul className="space-y-1.5 text-sm">
                            {Object.entries(tiempos).map(([indexStr, duration]) => {
                                const index = parseInt(indexStr, 10);
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
                        <p className="text-sm italic text-gray-400">No se registraron tiempos para esta sesión.</p>
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

// --- COMPONENTE PRINCIPAL ---
const PlayerFeedbackDetailView: React.FC<{ player: User; onClose: () => void; }> = ({ player, onClose }) => {
    const [allFeedback, setAllFeedback] = useState<FeedbackFromApi[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFeedback, setSelectedFeedback] = useState<FeedbackFromApi | null>(null);
    // NUEVO: Estado para mostrar el botón de scroll
    const [showScrollTop, setShowScrollTop] = useState(false);

    const listContainerRef = useRef<HTMLDivElement>(null);
    const detailContainerRef = useRef<HTMLDivElement>(null);
    const [showConfirmDeleteJugador, setShowConfirmDeleteJugador] = useState(false);


    // NUEVO: El ref que está activo en cada momento (lista o detalle)
    const activeScrollRef = selectedFeedback ? detailContainerRef : listContainerRef;

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

    // NUEVO: Efecto para detectar el scroll y mostrar/ocultar el botón
    useEffect(() => {
        const scrollContainer = activeScrollRef.current;
        if (!scrollContainer) return;

        const handleScroll = () => {
            if (scrollContainer.scrollTop > 300) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        // Limpiamos el evento al desmontar o cambiar el ref
        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll);
        };
    }, [activeScrollRef]); // Se re-ejecuta si cambiamos entre lista y detalle

    // NUEVO: Función para hacer scroll hacia arriba
    const scrollToTop = () => {
        activeScrollRef.current?.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const handleConfirmDeleteJugador = async () => {
        try {
            const result = await ApiService.deletePlayer(String(player.id));
            console.log(result.message); // opcional: mostrar mensaje
            onClose(); // Cierra el panel y refresca la lista de jugadores
        } catch (err) {
            console.error("Error al eliminar jugador:", err);
        }
    };

     return (
        // CORRECCIÓN: Eliminado 'overflow-hidden' para permitir scroll natural
        <div className="bg-gray-800 p-4 rounded-lg shadow-xl flex flex-col h-full text-white">
            {selectedFeedback ? (
                <FeedbackDetail feedback={selectedFeedback} onBack={() => setSelectedFeedback(null)} scrollContainerRef={detailContainerRef} />
            ) : (
                <div className="flex flex-col h-full">
                    <header className="flex-shrink-0 flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
                        <h2 className="text-xl font-semibold text-purple-300">Historial de {player.nombreCompleto}</h2>
                        <button
                          onClick={() => setShowConfirmDeleteJugador(true)}
                          className="mt-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"> Eliminar Jugador
                        </button>
                        <button onClick={onClose} className="flex items-center text-sm px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
                             <ChevronLeftIcon className="w-5 h-5 mr-1.5" /> Volver a Jugadores
                        </button>
                    </header>
                    <div ref={listContainerRef} className="flex-grow overflow-y-auto">
                        {loading ? <p className="text-center p-4">Cargando historial...</p> : 
                         allFeedback.length === 0 ? <p className="text-center p-4">No hay progresos registrados.</p> :
                         <FeedbackList feedbacks={allFeedback} onSelect={setSelectedFeedback} />
                        }
                    </div>
                </div>
            )}

            {showConfirmDeleteJugador && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white text-black p-6 rounded-lg shadow-lg max-w-sm">
                    <h3 className="text-lg font-semibold mb-2">¿Eliminar Jugador?</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Esta acción eliminará al jugador de la plataforma y también su historial de progreso.
                    </p>
                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setShowConfirmDeleteJugador(false)} className="px-4 py-2 bg-gray-300 rounded">Cancelar</button>
                        <button onClick={handleConfirmDeleteJugador} className="px-4 py-2 bg-red-600 text-white rounded">Eliminar</button>
                    </div>
                    </div>
                </div>
            )}

            
            {/* NUEVO: Botón inteligente de "Scroll hacia arriba" */}
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    aria-label="Scroll hacia arriba"
                    className="fixed bottom-6 right-6 w-12 h-12 bg-purple-600 bg-opacity-70 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 z-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
            )}
        

            <style>{`.custom-scrollbar-details::-webkit-scrollbar { width: 8px; } .custom-scrollbar-details::-webkit-scrollbar-track { background: #1f2937; } .custom-scrollbar-details::-webkit-scrollbar-thumb { background: #4b5563; }`}</style>
        </div>
    );
};

export default PlayerFeedbackDetailView;