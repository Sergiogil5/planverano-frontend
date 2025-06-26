
import React, { useState, useEffect, useMemo } from 'react';
import ApiService from './ApiService';
import { User, PlayerTeam } from '../types';
// PlayerFeedbackDisplay and training data related types/constants are no longer needed here directly
import XCircleIcon from './icons/XCircleIcon';
import PlayerFeedbackDetailView from './PlayerFeedbackDetailView'; // Import the new component

// Team colors and order remain relevant for the player list
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

  useEffect(() => {
    // Only fetch players if we are in the player list view
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
  }, [viewingFeedbackForPlayer]); // Refetch if we come back to player list

  const groupedPlayers = useMemo(() => {
    const groups: Partial<Record<PlayerTeam, User[]>> = {};
    allPlayers.forEach(player => {
      if (player.team) {
        if (!groups[player.team]) {
          groups[player.team] = [];
        }
        groups[player.team]!.push(player);
      }
    });
    // Ensure teams are always in the defined order, even if some are empty initially
    const orderedGroups: Partial<Record<PlayerTeam, User[]>> = {};
    teamDisplayOrder.forEach(teamName => {
        if (groups[teamName]) {
            orderedGroups[teamName] = groups[teamName].sort((a,b) => {
                 const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
                 const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
                 if (nameA < nameB) return -1;
                 if (nameA > nameB) return 1;
                 return 0;
            });
        }
    });
    return orderedGroups;
  }, [allPlayers]);
  
  const handlePlayerSelect = (player: User) => {
    setViewingFeedbackForPlayer(player);
  };

  const handleCloseFeedbackView = () => {
    setViewingFeedbackForPlayer(null);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 text-white flex flex-col p-4 z-[150] overflow-hidden">
      {/* Main Admin Panel Header */}
      {!viewingFeedbackForPlayer && ( // Only show main header if not viewing details, detail view has its own
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700 flex-shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-purple-400">Panel de Administrador</h1>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors"
            aria-label="Cerrar panel de administrador"
          >
            <XCircleIcon className="w-8 h-8 text-red-500" />
          </button>
        </header>
      )}

      {error && !viewingFeedbackForPlayer && ( // Show general error only on player list view
        <p className="text-red-400 bg-red-900 p-3 rounded-md mb-4 text-center">{error}</p>
      )}

      {/* Content Area: Either Player List or Player Feedback Detail */}
      <div className="flex-grow overflow-hidden">
        {viewingFeedbackForPlayer ? (
          <PlayerFeedbackDetailView 
            player={viewingFeedbackForPlayer} 
            onClose={handleCloseFeedbackView} 
          />
        ) : (
          // Players List section
          <div className="w-full h-full bg-gray-800 p-0 sm:p-4 rounded-lg shadow-xl flex flex-col overflow-hidden">
             {/* This inner header is for the "Jugadores" list specifically if not viewing details */}
            <h2 className="text-xl font-semibold text-purple-300 mb-4 text-center flex-shrink-0">Jugadores</h2>
            {loadingPlayers ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-400"></div>
              </div>
            ) : allPlayers.length === 0 && !error ? ( // check !error to not show this if error is shown
              <p className="text-gray-400 text-center flex-1 flex items-center justify-center">No hay jugadores registrados.</p>
            ) : (
              <div className="space-y-4 overflow-y-auto custom-scrollbar pr-0 sm:pr-2 flex-1">
                {teamDisplayOrder.map(teamName => {
                  const playersInTeam = groupedPlayers[teamName];
                  if (!playersInTeam || playersInTeam.length === 0) {
                     // Optionally render a message if team exists but is empty, or just skip
                    return (
                        <div key={teamName}>
                           <h3
                            className={`p-2.5 rounded-t-md text-md font-semibold ${teamColors[teamName].headerBg} ${teamColors[teamName].headerText} sticky top-0 z-10`}
                          >
                            {teamName}
                          </h3>
                          <p className="text-gray-500 bg-gray-750 p-2 text-sm rounded-b-md">No hay jugadores en este equipo.</p>
                        </div>
                    );
                  }
                  const colors = teamColors[teamName];
                  return (
                    <section key={teamName} aria-labelledby={`team-header-${teamName}`}>
                      <h3
                        id={`team-header-${teamName}`}
                        className={`p-2.5 rounded-t-md text-md font-semibold ${colors.headerBg} ${colors.headerText} sticky top-0 z-10`}
                      >
                        {teamName}
                      </h3>
                      <ul className="space-y-1 bg-gray-750 p-2 rounded-b-md">
                        {playersInTeam.map(player => (
                          <li key={player.id}>
                            <button
                              onClick={() => handlePlayerSelect(player)}
                              className={`w-full text-left px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out
                                ${'bg-gray-700 hover:bg-gray-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-opacity-75 focus:ring-' + teamName.toLowerCase() + '-400' }
                              `}
                            >
                              <span className="font-medium">{player.firstName} {player.lastName}</span>
                              {player.accessCode && <span className="text-xs text-gray-400 ml-1">({player.accessCode})</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
                 {Object.values(groupedPlayers).length === 0 && allPlayers.length > 0 && !teamDisplayOrder.some(tn => groupedPlayers[tn] && groupedPlayers[tn]!.length > 0) && (
                  <p className="text-gray-400 text-center py-4">Hay jugadores registrados pero no están asignados a los equipos estándar (Infantil, Cadete, Juvenil) o dichos equipos no tienen jugadores.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1f2937; /* gray-800 */ border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; /* gray-600 */ border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; /* gray-500 */ }
        .bg-gray-750 { background-color: rgba(55, 65, 81, 0.7); }
        .focus\\:ring-infantil-400:focus { --tw-ring-color: #38bdf8; } /* sky-400 */
        .focus\\:ring-cadete-400:focus { --tw-ring-color: #34d399; } /* emerald-400 */
        .focus\\:ring-juvenil-400:focus { --tw-ring-color: #818cf8; } /* indigo-400 */
      `}</style>
    </div>
  );
};

export default AdminDashboardView;