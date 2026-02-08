import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { PulseService } from '../../services/pulseService';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
    currentUser: UserProfile | null;
    login: (email: string, pass: string) => Promise<boolean>;
    registerStudent: (data: any) => Promise<boolean>;
    registerMaster: (data: any) => Promise<boolean>;
    logout: () => void;
    updateUserProfile: (profile: Partial<UserProfile>) => void;
    changePassword: (newPassword: string) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                // 1. Verificar sesión inicial
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("Auth session error:", error);
                }

                if (session?.user) {
                    // 2. Si hay sesión, cargar perfil con seguridad
                    await fetchUserProfile(session.user.id, session.user);
                }
            } catch (error) {
                console.error("Auth initialization unexpected error:", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                if (session?.user) {
                    await fetchUserProfile(session.user.id, session.user);
                }
            } else if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchUserProfile = async (userId: string, sessionUser: any) => {
        try {
            // GOLDEN RULE #1: Use maybeSingle() to avoid "multiple (or no) rows returned" error
            const { data: dbData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            // GOLDEN RULE #2: Handle error gracefully (do NOT throw)
            if (error) {
                console.warn("Error fetching profile from DB (using fallback):", error.message);
            }

            // GOLDEN RULE #3: Construct Temporal Profile from Session Metadata if DB fails
            const meta = sessionUser.user_metadata || {};
            const d = dbData as any; // Safe cast to access properties even if null

            const profile: UserProfile = {
                id: userId,
                // Email: Prioritize DB -> Session -> Default
                email: d?.email || sessionUser.email || '',
                // Name: Prioritize DB -> Metadata -> Default
                name: d?.name || meta.name || 'Usuario',
                // Role: Prioritize DB -> Metadata -> Default 'student'
                role: (d?.role as 'master' | 'student') || (meta.role as 'master' | 'student') || 'student',
                // Academy ID
                academyId: d?.academy_id || meta.academy_id || '',

                // Optional fields
                studentId: d?.student_id || undefined,
                avatarUrl: d?.avatar_url || '',
                emailConfirmed: !!sessionUser.email_confirmed_at
            };

            setCurrentUser(profile);

        } catch (err) {
            console.error("Critical Profile Construction Error:", err);
            // Ultra-safe fallback to prevent locking out the user
            setCurrentUser({
                id: userId,
                email: sessionUser.email || '',
                name: 'Usuario (System Recovery)',
                role: 'student',
                academyId: '',
                avatarUrl: '',
                emailConfirmed: false
            });
        }
    };

    const login = async (email: string, pass: string) => {
        try {
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
        if (passError) throw new Error(passError);

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
            changePassword,
            loading
        }}>
            {children}
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
