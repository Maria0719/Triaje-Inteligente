/**
 * Service that calls the backend API for authentication.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type LoginResponse = {
    id: string;
    name: string;
    email: string;
    role: string;
};

const buildError = async (response: Response, fallback: string): Promise<Error> => {
    try {
        const body = await response.json();
        const detail = typeof body?.detail === 'string' ? body.detail : fallback;
        return new Error(detail);
    }
    catch {
        return new Error(fallback);
    }
};

export class AuthApiService {
    async login(email: string, password: string, role: string): Promise<LoginResponse> {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw await buildError(response, 'Correo o contraseña incorrectos');
            }
            throw await buildError(response, 'Error al iniciar sesión');
        }

        const data = (await response.json()) as LoginResponse;
        return {
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role || role,
        };
    }

    async register(email: string, password: string, name: string, role: string): Promise<LoginResponse> {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, role }),
        });

        if (!response.ok) {
            throw await buildError(response, 'Error al registrarse');
        }

        const data = (await response.json()) as LoginResponse;
        return {
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role,
        };
    }
}
