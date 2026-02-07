import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { PulseService } from '../services/pulseService';
import { useToast } from './ToastContext';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    currentUser: UserProfile | null;
    login: (email: string, pass: string) => Promise<boolean>;
    registerStudent: (data: any) => Promise<boolean>;
    registerMaster: (data: any) => Promise<boolean>;
    logout: () => void;
    updateUserProfile: (profile: Partial<UserProfile>) => void;
    changePassword: (newPassword: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        let isMounted = true;

        // 0. Quick check for token to avoid unnecessary wait state
        const hasToken = Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        if (!hasToken) {
            setLoading(false);
        }

        // 1. Initial Session Check
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (!isMounted) return;

            if (error) {
                console.error("Auth session error:", error);

                // Only clear if it's a critical refresh error
                if (error.message.includes("Invalid Refresh Token")) {
                    localStorage.removeItem('sb-dpcbpifhcsujlzludnfg-auth-token');
                }

                setLoading(false);
                return;
            }

            if (session?.user) {
                fetchUserProfile(session.user.id, session.user);
            } else {
                setLoading(false);
            }
        });

        // 2. Auth State Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                setLoading(false);
            } else if (session?.user) {
                // Determine if we need to fetch profile (e.g. on SIGNED_IN or TOKEN_REFRESHED)
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                    await fetchUserProfile(session.user.id, session.user);
                }
            } else {
                if (currentUser) setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchUserProfile = async (userId: string, sessionUser?: any) => {
        try {
            // OPTIMIZATION: Use maybeSingle() to handle 0 or 1 row gracefully without throwing
            const { data: d, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error("Profile fetch error (non-fatal):", error.message);
                // We do NOT throw here, allowing fallback logic to run
            }

            // ROBUST MAPPING: Handles null/undefined database values safely
            // If 'd' is null (profile missing), we create a functional temporary profile
            // from the auth session data.
            const userMetadata = sessionUser?.user_metadata || {};

            const mappedProfile: UserProfile = {
                id: userId,
                // Fallback to session email if DB email is missing
                email: d?.email || sessionUser?.email || '',
                // Fallback to metadata name or default
                name: d?.name || userMetadata.name || 'Usuario',
                // Fallback to role in metadata or default to 'student'
                role: (d?.role as 'master' | 'student') || (userMetadata.role as 'master' | 'student') || 'student',
                // Handle null academy_id gracefully
                academyId: d?.academy_id || '',
                studentId: d?.student_id || undefined,
                avatarUrl: d?.avatar_url || '',
                emailConfirmed: !!sessionUser?.email_confirmed_at
            };

            setCurrentUser(mappedProfile);
        } catch (err) {
            console.error('Critical Auth Error (Unexpected):', err);
            // Even in a generic crash, try not to leave the user stranded if we have session data
            if (sessionUser) {
                setCurrentUser({
                    id: userId,
                    email: sessionUser.email || '',
                    name: 'Usuario (Offline)',
                    role: 'student',
                    academyId: '',
                    avatarUrl: '',
                    emailConfirmed: false
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, pass: string) => {
        try {
            // Remove manual timeout race - let Supabase/Network handle it
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password: pass
            });

            if (error) throw error;
            addToast('Sesión iniciada', 'success');
            return true;
        } catch (error) {
            console.error("Login error:", error);
            addToast(error instanceof Error ? error.message : "Error al iniciar sesión", 'error');
            return false;
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            setCurrentUser(null);
            addToast('Sesión cerrada', 'info');
        }
    };

    const validatePassword = (password: string) => {
        if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
        if (!/[A-Z]/.test(password)) return "La contraseña debe tener al menos una mayúscula";
        if (!/[0-9]/.test(password)) return "La contraseña debe tener al menos un número";
        return null;
    };

    const registerMasterAction = async (data: any) => {
        const passError = validatePassword(data.password);
        if (passError) {
            throw new Error(passError);
        }

        // Just await the service call directly
        try {
            await PulseService.registerMaster(data);
            addToast('Academia registrada. Por favor revisa tu correo.', 'success');
            return true;
        } catch (error) {
            console.error("Registration error:", error);
            throw error;
        }
    };

    const registerStudentAction = async (data: any) => {
        try {
            await PulseService.registerStudent(data);
            addToast('Cuenta de alumno creada', 'success');
            return true;
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Error al registrar", 'error');
            return false;
        }
    };

    const updateUserProfile = async (updates: Partial<UserProfile>) => {
        if (!currentUser) return;
        try {
            const { error } = await (supabase
                .from('profiles') as any)
                .update({
                    name: updates.name,
                    avatar_url: updates.avatarUrl
                })
                .eq('id', currentUser.id);

            if (error) throw error;

            setCurrentUser({ ...currentUser, ...updates });
            addToast('Perfil actualizado', 'success');
        } catch (err) {
            console.error("Update profile error:", err);
            addToast('Error al actualizar perfil', 'error');
        }
    };

    const changePassword = async (newPassword: string) => {
        const passError = validatePassword(newPassword);
        if (passError) {
            addToast(passError, 'error');
            return;
        }
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            addToast('Contraseña actualizada', 'success');
        } catch (err) {
            console.error("Change password error:", err);
            addToast('Error al cambiar contraseña', 'error');
        }
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            login,
            logout,
            registerStudent: registerStudentAction,
            registerMaster: registerMasterAction,
            updateUserProfile,
            changePassword
        }}>
            {loading ? (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};