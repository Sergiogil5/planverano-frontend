// src/components/ApiService.ts

import { User, UserRole, SessionFeedbackData, UserDayProgress, TrainingDay, PlayerTeam, PlayerFeedbackDisplay, ActivityLibreDetails } from '../types';

const API_BASE_URL = 'https://planverano-backend.onrender.com';

// --- Funciones de ayuda para gestionar el Token JWT ---
const getToken = (): string | null => localStorage.getItem('jwt_token');
const setToken = (token: string): void => localStorage.setItem('jwt_token', token);
const removeToken = (): void => localStorage.removeItem('jwt_token');
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
});

// --- El nuevo ApiService que habla con el Backend Real ---
const ApiService = {
    // --- Autenticación ---
    login: async (email: string, password_DO_NOT_USE_IN_REAL_APP: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: password_DO_NOT_USE_IN_REAL_APP })
        });
        if (!response.ok) { removeToken(); throw new Error('Login fallido.'); }
        const { token } = await response.json();
        setToken(token);
        const user = await ApiService.getCurrentUser();
        if (!user) throw new Error('No se pudo obtener el usuario después del login.');
        return user;
    },

// EN: src/components/ApiService.ts

  register: async (email: string, password_DO_NOT_USE_IN_REAL_APP: string, role: UserRole, details: any): Promise<User> => {
    
    let requestBody;

    // Construimos el cuerpo de la petición explícitamente según el rol
    if (role === 'JUGADOR') {
        requestBody = {
            email,
            password: password_DO_NOT_USE_IN_REAL_APP,
            codigoRegistro: details.playerAccessCode,
            team: details.team
            // ¡NO incluimos el campo nombreCompleto para el jugador!
        };
    } else { // role === 'admin'
        requestBody = {
            email,
            password: password_DO_NOT_USE_IN_REAL_APP,
            codigoRegistro: details.adminCode,
            nombreCompleto: `${details.firstName} ${details.lastName}`.trim()
            // No incluimos categoría para el admin
        };
    }

    const response = await fetch(`${API_BASE_URL}/api/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error en el registro.');
    }
    
    return ApiService.login(email, password_DO_NOT_USE_IN_REAL_APP);
  },
    logout: async (): Promise<void> => {
        removeToken();
        return Promise.resolve();
    },
    getCurrentUser: async (): Promise<User | null> => {
        const token = getToken();
        if (!token) return null;
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/me`, { headers: getAuthHeaders() });
            if (!response.ok) { removeToken(); return null; }
            return response.json();
        } catch (error) { removeToken(); return null; }
    },
    
    // --- Entrenamientos y Progreso ---
    getWeekData: async (weekNumber: number): Promise<any[]> => {
        const response = await fetch(`${API_BASE_URL}/api/training/semana/${weekNumber}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('No se pudieron cargar los datos de la semana.');
        return response.json();
    },

    submitSessionFeedback: async (feedbackData: SessionFeedbackData & { sesionId: number }) => {
        const requestBody = {
            sesionId: feedbackData.sesionId, feedbackEmoji: feedbackData.feedbackEmoji,
            feedbackLabel: feedbackData.feedbackLabel, feedbackTextoOpcional: '', // Puedes añadir este campo a tu modal
            tiemposJson: JSON.stringify(feedbackData.exerciseActualDurations || {}),
            rutaGpsJson: JSON.stringify(feedbackData.exerciseRoutes || {})
        };
        const response = await fetch(`${API_BASE_URL}/api/progreso`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(requestBody)
        });
        if (!response.ok) throw new Error('Error al enviar el feedback.');
        return { success: true };
    },

    // El resto de funciones (admin, etc.) las dejamos simuladas para no introducir más errores por ahora.
    getUserProgress: async (userId: string): Promise<Record<string, UserDayProgress>> => { return {}; },
    saveUserProgress: async (userId: string, dayKey: string, progress: UserDayProgress): Promise<void> => {
    // Esta función ya no es necesaria, pero la mantenemos para que no haya errores
    console.log("Llamada a saveUserProgress (obsoleta)");},
    recordActivityLibre: async (userId: string, weekNum: number, dayName: string, details: ActivityLibreDetails, completedAt: string): Promise<void> => {
    // Esta lógica ahora está dentro de submitSessionFeedback
    console.log("Llamada a recordActivityLibre (obsoleta)");},
    checkAdminNotification: (): boolean => false,
    clearAdminNotification: (): void => {},
    getAllPlayers: async (): Promise<User[]> => {
    const response = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
    if (!response.ok) {
        console.error("No se pudieron cargar los jugadores.");
        return []; // Devolvemos un array vacío en caso de error
    }
    return response.json();},
    getPlayerFeedback: async (): Promise<PlayerFeedbackDisplay[]> => [],
    deletePlayer: async (): Promise<{ success: boolean; message: string }> => ({ success: true, message: 'Simulado' })
};
export default ApiService;