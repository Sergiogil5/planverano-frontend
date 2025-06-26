import React, { useState, useEffect, useMemo } from 'react';
import ApiService from './ApiService';
import { User, PlayerTeam } from '../types';
import XCircleIcon from './icons/XCircleIcon';
import PlayerFeedbackDetailView from './PlayerFeedbackDetailView';

// La configuración de colores y orden no cambia
const teamColors: Record<PlayerTeam, { bg: string; text: string; headerBg: string; headerText: string }> = {
  Infantil: { bg: 'bg-sky-600', text: 'text-white', headerBg: 'bg-sky-700', headerText: 'text-sky-100' },
  Cadete: { bg: 'bg-emerald-600', text: 'text-white', headerBg: 'bg-emerald-700', headerText: 'text-emerald-100' },
  Juvenil: { bg: 'bg-indigo-600', text: 'text-white', headerBg: 'bg-indigo-700', headerText: 'text-indigo-100' },
};
const teamDisplayOrder: PlayerTeam[] = ['Infantil', 'Cadete', 'Juvenil'];

const AdminDashboardView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [allPlayers, setAllPlayers] = useState<User[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingFeedbackForPlayer, setViewingFeedbackForPlayer] = useState<User | null>(null);

  // useEffect para cargar la lista de jugadores cuando el componente se monta
  useEffect(() => {
    if (!viewingFeedbackForPlayer) {
      const fetchPlayers = async () => {
        setLoadingPlayers(true);
        setError(null);
        try {
          const fetchedPlayers = await ApiService.getAllPlayers();
          console.log("Jugadores recibidos del backend:", fetchedPlayers);
          setAllPlayers(fetchedPlayers);
        } catch (err) {
          console.error("Error fetching players:", err);
          setError("No se pudieron cargar los jugadores.");
        } finally {
          setLoadingPlayers(false);
        }
      };
      fetchPlayers();
    }
  }, [viewingFeedbackForPlayer]);

  // useMemo para agrupar los jugadores por equipo cada vez que la lista 'allPlayers' cambia
  const groupedPlayers = useMemo(() => {
    // 1. Inicializamos un objeto con un array vacío para cada equipo
    const groups: Record<PlayerTeam, User[]> = {
      Infantil: [],
      Cadete: [],
      Juvenil: [],
    };
    
    // 2. Recorremos los jugadores recibidos de la API
    allPlayers.forEach(player => {
      // 3. Si el jugador tiene un equipo y es uno de los que esperamos...
      if (player.team && groups[player.team]) {
        // 4. ...lo añadimos a la lista de ese equipo.
        groups[player.team].push(player);
      }
    });

    // 5. Opcional: Ordenamos alfabéticamente los jugadores dentro de cada equipo
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

  // Si hemos seleccionado un jugador, mostramos su vista de detalle en lugar de la lista
  if (viewingFeedbackForPlayer) {
    return <PlayerFeedbackDetailView 
              player={viewingFeedbackForPlayer} 
              onClose={handleCloseFeedbackView} 
           />;
  }

  // Si no, mostramos la lista principal de jugadores por equipo
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 text-white flex flex-col p-4 z-[150] overflow-hidden">
      <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700 flex-shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-purple-400">Panel de Administrador</h1>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors" aria-label="Cerrar panel">
          <XCircleIcon className="w-8 h-8 text-red-500" />
        </button>
      </header>
      
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-0 sm:pr-2">
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
                    {teamName} ({playersInTeam.length})
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