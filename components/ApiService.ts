import { User, UserRole, TrainingWeek, ApiTrainingDay, ApiResponse_TrainingWeek } from '../types';

const API_BASE_URL = 'https://planverano-backend.onrender.com';

const getToken = (): string | null => localStorage.getItem('jwt_token');
const setToken = (token: string): void => localStorage.setItem('jwt_token', token);
const removeToken = (): void => localStorage.removeItem('jwt_token');
const getAuthHeaders = (): Record<string,string> => {
  const token = getToken();
  const headers: Record<string,string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

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
            const errorText = await response.text().catch(() => 'Login fallido.');
            throw new Error(errorText);
        }
        // ¡CAMBIO CLAVE! Extraemos tanto el token como el usuario de la misma respuesta.
        const { token, user } = await response.json();
        if (!token || !user) {
            throw new Error('La respuesta del login desde el servidor es inválida.');
        }
        // Guardamos el token
        setToken(token);
                // Devolvemos el usuario directamente. ¡Ya no hay segunda llamada!
        return user;
    },

    register: async (email: string, password_DO_NOT_USE_IN_REAL_APP: string, role: UserRole, details: any): Promise<User> => {
        const requestBody = {
            email,
            password: password_DO_NOT_USE_IN_REAL_APP,
            codigoRegistro: role === 'JUGADOR' ? details.playerAccessCode : details.adminCode,
            team: role === 'JUGADOR' ? details.team : null,
            nombreCompleto: role === 'ENTRENADOR' ? `${details.firstName} ${details.lastName}`.trim() : null
        };

        const response = await fetch(`${API_BASE_URL}/api/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Error en el registro.');
        }
        
        // Tras un registro exitoso, hacemos login para obtener el token y los datos del usuario.
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
    getWeekData: async (weekNumber: number): Promise<ApiResponse_TrainingWeek> => {
        const response = await fetch(`${API_BASE_URL}/api/training/semana/${weekNumber}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('No se pudieron cargar los datos de la semana.');
        return response.json();
    },

    submitSessionFeedback: async (feedbackData: any) => {
        const response = await fetch(`${API_BASE_URL}/api/progreso`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(feedbackData)
        });
        if (!response.ok) throw new Error('Error al enviar el feedback.');
        return response.json();
    },
    
    savePausedSession: async (pausedState: any): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/api/progreso/pausar`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(pausedState)
        });
        if (!response.ok) throw new Error('Error al guardar la sesión pausada');
    },

    fetchUserProgress: async (): Promise<any[]> => {
        const response = await fetch(`${API_BASE_URL}/api/progreso/mis-progresos`, { headers: getAuthHeaders() });
        if (!response.ok) return [];
        return response.json();
    },
    
    fetchPausedSession: async (): Promise<any | null> => {
        const response = await fetch(`${API_BASE_URL}/api/progreso/mi-pausa`, { headers: getAuthHeaders() });
        if (response.status === 204) return null;
        if (!response.ok) return null;
        return response.json();
    },

    // --- Admin ---
    getAllPlayers: async (): Promise<User[]> => {
        const response = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
        if (!response.ok) return [];
        return response.json();
    },

    getPlayerFeedback: async (userId: string): Promise<any[]> => {
        const response = await fetch(`${API_BASE_URL}/api/progreso/jugador/${userId}`, { headers: getAuthHeaders() });
        if (!response.ok) return [];
        return response.json();
    },
    
    // Dejamos esta simulada por ahora
    deletePlayer: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        // Si hay un error, lo lanzamos para que se pueda capturar en el componente
        const errorText = await response.text();
        throw new Error(errorText || "Error al eliminar el jugador.");
    }

    // Si la respuesta es 204 No Content (éxito), no hay cuerpo JSON que parsear.
    // Devolvemos un mensaje de éxito genérico.
    return { success: true, message: `Jugador con ID ${userId} eliminado.` };
    }
};

export default ApiService;