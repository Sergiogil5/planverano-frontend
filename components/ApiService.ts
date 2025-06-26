import { User, UserRole, SessionFeedbackData, UserDayProgress, PlayerTeam, PlayerFeedbackDisplay, ActivityLibreDetails } from '../types';

// La URL de tu backend en Render
const API_BASE_URL = 'https://planverano-backend.onrender.com';

// --- Funciones de ayuda para gestionar el Token JWT ---
const getToken = (): string | null => localStorage.getItem('jwt_token');
const setToken = (token: string): void => localStorage.setItem('jwt_token', token);
const removeToken = (): void => localStorage.removeItem('jwt_token');
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
});

// --- El ApiService que habla con el Backend Real ---
const ApiService = {
    
    // --- Autenticación ---
    login: async (email: string, password_DO_NOT_USE_IN_REAL_APP: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: password_DO_NOT_USE_IN_REAL_APP })
        });
        if (!response.ok) { 
            removeToken(); 
            throw new Error('Login fallido. Verifica tu email y contraseña.'); 
        }
        const { token } = await response.json();
        setToken(token);
        const user = await ApiService.getCurrentUser();
        if (!user) throw new Error('No se pudo obtener el usuario después del login.');
        return user;
    },

    register: async (email: string, password_DO_NOT_USE_IN_REAL_APP: string, role: UserRole, details: any): Promise<User> => {
        let requestBody;
        if (role === 'JUGADOR') {
            requestBody = {
                email,
                password: password_DO_NOT_USE_IN_REAL_APP,
                codigoRegistro: details.playerAccessCode,
                team: details.team
            };
        } else { // role === 'ENTRENADOR'
            requestBody = {
                email,
                password: password_DO_NOT_USE_IN_REAL_APP,
                codigoRegistro: details.adminCode,
                nombreCompleto: `${details.firstName} ${details.lastName}`.trim()
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
            sesionId: feedbackData.sesionId, 
            feedbackEmoji: feedbackData.feedbackEmoji,
            feedbackLabel: feedbackData.feedbackLabel, 
            feedbackTextoOpcional: '', // Puedes añadir este campo a tu modal
            tiemposJson: JSON.stringify(feedbackData.exerciseActualDurations || {}),
            rutaGpsJson: JSON.stringify(feedbackData.exerciseRoutes || {})
        };
        const response = await fetch(`${API_BASE_URL}/api/progreso`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(requestBody)
        });
        if (!response.ok) throw new Error('Error al enviar el feedback.');
        return { success: true };
    },
    
    // --- ¡NUEVAS FUNCIONES PARA CARGAR ESTADO! ---
    
    fetchUserProgress: async (): Promise<any[]> => {
        const token = getToken();
        if (!token) return [];
        const response = await fetch(`${API_BASE_URL}/api/progreso/mis-progresos`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            console.error('Error al cargar el progreso del usuario');
            return [];
        }
        return response.json();
    },
    
    fetchPausedSession: async (): Promise<any | null> => {
        const token = getToken();
        if (!token) return null;
        const response = await fetch(`${API_BASE_URL}/api/progreso/mi-pausa`, {
            headers: getAuthHeaders()
        });
        if (response.status === 204) return null; // No hay sesión pausada, no es un error.
        if (!response.ok) {
            console.error('Error al cargar la sesión pausada');
            return null;
        }
        return response.json();
    },

    savePausedSession: async (pausedState: any): Promise<void> => {
        const token = getToken();
        if (!token) throw new Error('No autenticado');
        
        const response = await fetch(`${API_BASE_URL}/api/progreso/pausar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(pausedState)
        });

        if (!response.ok) {
            throw new Error('Error al guardar la sesión pausada');
        }
    },


    // --- Funciones de Admin ---
    
    getAllPlayers: async (): Promise<User[]> => {
        const token = getToken();
        if (!token) return [];
        const response = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
        if (!response.ok) {
            console.error("No se pudieron cargar los jugadores.");
            return [];
        }
        return response.json();
    },
    
    // Funciones que aún no hemos implementado en el backend, se quedan como están por ahora
    getPlayerFeedback: async (): Promise<PlayerFeedbackDisplay[]> => [],
    deletePlayer: async (): Promise<{ success: boolean; message: string }> => ({ success: true, message: 'Simulado' }),
    checkAdminNotification: (): boolean => false,
    clearAdminNotification: (): void => {},
};

export default ApiService;