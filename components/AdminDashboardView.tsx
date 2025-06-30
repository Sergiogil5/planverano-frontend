import React, { useState, useEffect, useMemo, useRef } from 'react'; // NUEVO: Importamos useRef
import ApiService from './ApiService';
import { User, PlayerTeam } from '../types';
import XCircleIcon from './icons/XCircleIcon';
import PlayerFeedbackDetailView from './PlayerFeedbackDetailView';

// La configuración de colores y orden no cambia
const teamColors: Record<PlayerTeam, { bg: string; text: string; headerBg: string; headerText: string }> = {
  INFANTIL: { bg: 'bg-sky-600', text: 'text-white', headerBg: 'bg-sky-700', headerText: 'text-sky-100' },
  CADETE: { bg: 'bg-emerald-600', text: 'text-white', headerBg: 'bg-emerald-700', headerText: 'text-emerald-100' },
  JUVENIL: { bg: 'bg-indigo-600', text: 'text-white', headerBg: 'bg-indigo-700', headerText: 'text-indigo-100' },
};
const teamDisplayOrder: PlayerTeam[] = ['INFANTIL', 'CADETE', 'JUVENIL'];

const AdminDashboardView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [allPlayers, setAllPlayers] = useState<User[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingFeedbackForPlayer, setViewingFeedbackForPlayer] = useState<User | null>(null);

  // NUEVO: Ref para el contenedor de la lista y estado para el botón de scroll
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // useEffect para cargar la lista de jugadores (sin cambios)
  useEffect(() => {
    if (!viewingFeedbackForPlayer) {
      const fetchPlayers = async () => {
        setLoadingPlayers(true);
        setError(null);
        try {
          const fetchedPlayers = await ApiService.getAllPlayers();
          setAllPlayers(fetchedPlayers);
        } catch (err) {
          setError("No se pudieron cargar los jugadores.");
        } finally {
          setLoadingPlayers(false);
        }
      };
      fetchPlayers();
    }
  }, [viewingFeedbackForPlayer]);

  // NUEVO: Efecto para detectar el scroll en la lista de jugadores y mostrar/ocultar el botón
  useEffect(() => {
    // Si estamos viendo el detalle de un jugador, la lógica de scroll la maneja ese componente.
    // Ocultamos el botón de esta vista y no hacemos nada más.
    if (viewingFeedbackForPlayer) {
      setShowScrollTop(false);
      return;
    }

    const scrollContainer = listContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
        if (scrollContainer.scrollTop > 300) {
            setShowScrollTop(true);
        } else {
            setShowScrollTop(false);
        }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [viewingFeedbackForPlayer]); // Se re-evalúa cuando cambiamos de vista

  // useMemo para agrupar jugadores (sin cambios)
  const groupedPlayers = useMemo(() => {
    const groups:  { INFANTIL: User[], CADETE: User[], JUVENIL: User[] } = {
      INFANTIL: [],
      CADETE: [],
      JUVENIL: [],
    };
    allPlayers.forEach(player => {
      if (player.team && groups[player.team]) {
        groups[player.team].push(player);
      }
    });
    for (const teamName in groups) {
      (groups as any)[teamName].sort((a: User, b: User) => (a.nombreCompleto || '').localeCompare(b.nombreCompleto || ''));
    }
    return groups;
  }, [allPlayers]);
  
  const handlePlayerSelect = (player: User) => {
    setViewingFeedbackForPlayer(player);
  };

  const handleCloseFeedbackView = () => {
    setViewingFeedbackForPlayer(null);
  };

  // NUEVO: Función para hacer scroll hacia arriba en la lista de jugadores
  const scrollToTop = () => {
    listContainerRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
  };

  // Si hemos seleccionado un jugador, mostramos su vista de detalle (sin cambios)
  if (viewingFeedbackForPlayer) {
    return <PlayerFeedbackDetailView 
              player={viewingFeedbackForPlayer} 
              onClose={handleCloseFeedbackView} 
           />;
  }

  // Si no, mostramos la lista principal de jugadores
  return (
    // Ya has quitado 'overflow-hidden' aquí, lo cual es CORRECTO.
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 text-white flex flex-col p-4 z-[150]">
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-purple-400">Panel de Administrador</h1>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Cerrar panel">
          <XCircleIcon className="w-8 h-8 text-red-500" />
        </button>
      </header>
      
      {/* NUEVO: Asignamos el ref al contenedor que tiene el scroll */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto custom-scrollbar pr-0 sm:pr-2">
        <h2 className="text-xl font-semibold text-purple-300 mb-4 text-center">Jugadores</h2>
        {loadingPlayers ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-400"></div>
          </div>
        ) : error ? (
           <p className="text-red-400 bg-red-900 p-3 rounded-md text-center">{error}</p>
        ) : (
          <div className="space-y-4">
            {teamDisplayOrder.map(teamName => {
              const playersInTeam = groupedPlayers[teamName];
              const colors = teamColors[teamName];
              return (
                <section key={teamName} aria-labelledby={`team-header-${teamName}`}>
                  <h3 id={`team-header-${teamName}`} className={`p-2.5 rounded-t-md text-md font-semibold ${colors.headerBg} ${colors.headerText} sticky top-0 z-10`}>
                    {teamName.charAt(0) + teamName.slice(1).toLowerCase()} ({playersInTeam.length})
                  </h3>
                  <div className="bg-gray-750 p-2 rounded-b-md">
                    {playersInTeam.length === 0 ? (
                      <p className="text-gray-500 px-3 py-2 text-sm">No hay jugadores en este equipo.</p>
                    ) : (
                      <ul className="space-y-1">
                        {playersInTeam.map(player => (
                          <li key={player.id}>
                            <button onClick={() => handlePlayerSelect(player)} className="w-full text-left px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out bg-gray-700 hover:bg-gray-600 text-gray-200">
                              <span className="font-medium">{player.nombreCompleto}</span>
                              {player.codigoRegistro && <span className="text-xs text-gray-400 ml-1">({player.codigoRegistro})</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* NUEVO: Botón inteligente de "Scroll hacia arriba" para la lista de jugadores */}
      {showScrollTop && (
          <button
              onClick={scrollToTop}
              aria-label="Scroll hacia arriba"
              className="fixed bottom-6 right-6 w-12 h-12 bg-purple-600 bg-opacity-70 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-opacity-100 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 z-50"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1f2937; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        .bg-gray-750 { background-color: rgba(55, 65, 81, 0.7); }
      `}</style>
    </div>
  );
};

export default AdminDashboardView;