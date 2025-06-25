
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { UserRole, PlayerTeam } from '../types';
import XCircleIcon from './icons/XCircleIcon'; // For the modal
// AppLogoIcon is no longer imported as it's replaced by an img tag

const AuthView: React.FC = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [playerAccessCode, setPlayerAccessCode] = useState('');
  const [role, setRole] = useState<UserRole>('JUGADOR');
  const [team, setTeam] = useState<PlayerTeam>('Infantil');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAdminCodeErrorModal, setShowAdminCodeErrorModal] = useState(false);
  const { login, register, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowAdminCodeErrorModal(false);
    try {
      if (isLoginView) {
        await login(email, password);
      } else {
        const registrationDetails: any = {}; // Team is always relevant for player, might be undefined for admin but won't hurt

        if (role === 'JUGADOR') {
          if (!playerAccessCode.trim()) {
            setError("El Código de Acceso es requerido para registrarse como jugador.");
            return;
          }
          if (!team) {
            setError("Debes seleccionar un equipo para el rol de jugador.");
            return;
          }
          registrationDetails.playerAccessCode = playerAccessCode;
          registrationDetails.team = team;
        } else if (role === 'ENTRENADOR') {
          if (!firstName.trim() || !lastName.trim()) {
            setError("Nombre y apellidos son requeridos para el rol de Entrenador.");
            return;
          }
          if (!adminCode.trim()) {
            setError("El Código de Administrador es requerido para el rol de Entrenador.");
            return;
          }
          registrationDetails.firstName = firstName;
          registrationDetails.lastName = lastName;
          registrationDetails.adminCode = adminCode;
        }
        
        await register(email, password, role, registrationDetails);
      }
    } catch (err: any) {
      if (err.message === "User with this email already exists.") {
        setError("Este correo electrónico ya está registrado. Por favor, utiliza otro correo o inicia sesión si ya tienes una cuenta.");
      } else if (err.message === "Código de Administrador incorrecto.") {
        setError(null); 
        setShowAdminCodeErrorModal(true);
      } else if (err.message.includes("Código de Acceso inválido") || err.message.includes("ya ha sido utilizado")) {
        setError(err.message);
      }
      else {
        setError(err.message || 'Error en la autenticación.');
      }
      console.error("Auth error:", err.message);
    }
  };

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-blue-100 p-4 relative">
        <div className="rounded-xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
          <div
            className="absolute inset-0 bg-no-repeat bg-center pointer-events-none"
            style={{
              backgroundImage: "url('https://i.ibb.co/5WN2Q6F2/escudo-club.png')",
              backgroundSize: 'auto 60%',
              opacity: 0.40
            }}
            aria-hidden="true"
          ></div>

          <div className="relative z-[1] bg-white bg-opacity-95 p-8 rounded-xl">
            <div className="text-center mb-8">
                <div className="inline-block rounded-full w-16 h-16 flex items-center justify-center mb-3 overflow-hidden">
                    <img src="https://i.ibb.co/6RgT2yc9/Logo1-2.png" alt="Logo del Club" className="w-full h-full object-contain scale-125" /> 
                </div>
                <h1 className="text-3xl font-bold text-blue-700">
                {isLoginView ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </h1>
                <p className="text-gray-500">Accede a tu plan de entrenamiento.</p>
            </div>

            {error && !showAdminCodeErrorModal && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLoginView && (
                <>
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rol</label>
                    <select 
                        id="role" 
                        name="role" 
                        value={role} 
                        onChange={(e) => {
                            setRole(e.target.value as UserRole);
                            setError(null); // Clear errors on role change
                            setFirstName(''); 
                            setLastName('');
                            setPlayerAccessCode('');
                            setAdminCode('');
                        }} 
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                        disabled={loading}
                    >
                      <option value="JUGADOR">Jugador</option>
                      <option value="ENTRENADOR">Entrenador (Admin)</option>
                    </select>
                  </div>

                  {role === 'JUGADOR' && (
                    <>
                      <div>
                        <label htmlFor="playerAccessCode" className="block text-sm font-medium text-gray-700">Código de Acceso</label>
                        <input id="playerAccessCode" name="playerAccessCode" type="text" required value={playerAccessCode} onChange={(e) => setPlayerAccessCode(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Introduce tu código" disabled={loading}/>
                      </div>
                      <div>
                        <label htmlFor="team" className="block text-sm font-medium text-gray-700">Equipo</label>
                        <select id="team" name="team" value={team} onChange={(e) => setTeam(e.target.value as PlayerTeam)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" disabled={loading}>
                          <option value="Infantil">Infantil</option>
                          <option value="Cadete">Cadete</option>
                          <option value="Juvenil">Juvenil</option>
                        </select>
                      </div>
                    </>
                  )}

                  {role === 'ENTRENADOR' && (
                    <>
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input id="firstName" name="firstName" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" disabled={loading}/>
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Apellidos</label>
                        <input id="lastName" name="lastName" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" disabled={loading}/>
                      </div>
                      <div>
                        <label htmlFor="adminCode" className="block text-sm font-medium text-gray-700">Código de Administrador</label>
                        <input id="adminCode" name="adminCode" type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Introduce el código secreto" disabled={loading}/>
                      </div>
                    </>
                  )}
                </>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" disabled={loading}/>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
                <input id="password" name="password" type="password" autoComplete={isLoginView ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" disabled={loading}/>
              </div>
              
              <div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                  {loading ? (isLoginView ? 'Iniciando...' : 'Registrando...') : (isLoginView ? 'Iniciar Sesión' : 'Crear Cuenta')}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <button onClick={() => { setIsLoginView(!isLoginView); setError(null); setShowAdminCodeErrorModal(false); }} className="font-medium text-blue-600 hover:text-blue-500" disabled={loading}>
                {isLoginView ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia Sesión'}
              </button>
            </div>
          </div>
        </div>

        <footer className="text-center p-6 text-sm text-gray-500 mt-8 relative z-[5]">
          <p>&copy; {new Date().getFullYear()} Sergio Gil. Plan de Entrenamiento.</p>
          <p>Desarrollado con 💪.</p>
        </footer>
      </div>

      {showAdminCodeErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200] p-4" role="alertdialog" aria-modal="true" aria-labelledby="admin-code-error-title">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm w-full">
            <div className="flex justify-center mb-4">
                <XCircleIcon className="w-12 h-12 text-red-500" />
            </div>
            <h3 id="admin-code-error-title" className="text-lg font-semibold text-gray-800 mb-3">Código Erróneo</h3>
            <p className="text-gray-600 mb-6 text-sm">
              El Código de Administrador proporcionado es incorrecto. Sin el código correcto, no puedes registrarte como entrenador. Puedes registrarte como jugador si lo deseas.
            </p>
            <button
              onClick={() => setShowAdminCodeErrorModal(false)}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors w-full"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AuthView;
