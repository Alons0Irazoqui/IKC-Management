import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { PulseService } from '../services/pulseService';
import { useToast } from './ToastContext';

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

import { supabase } from '../lib/supabase'; // ADJUSTED IMPORT

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        let isMounted = true;

        // OPTIMIZATION: Check if we have a token in storage. If not, don't wait.
        // Supabase keys usually look like 'sb-<project-id>-auth-token'
        const hasToken = Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));

        if (!hasToken) {
            setLoading(false);
        }

        // Safety timeout to prevent infinite loading (e.g. if Supabase is unreachable)
        const timeoutId = setTimeout(() => {
            if (isMounted && loading) {
                console.warn("Auth check timed out - forcing application load");
                setLoading(false);
            }
        }, hasToken ? 6000 : 500); // Slight buffer over the fetch timeout

        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (!isMounted) return;

            if (error) {
                // Handle specific "Invalid Refresh Token" error
                if (error.message.includes("Invalid Refresh Token") || error.message.includes("Refresh Token Not Found")) {
                    console.warn("Session expired. Clearing data.");
                    supabase.auth.signOut();
                    localStorage.removeItem('sb-dpcbpifhcsujlzludnfg-auth-token');
                }
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            if (session?.user) {
                fetchUserProfile(session.user.id, session.user).finally(() => {
                    if (isMounted) clearTimeout(timeoutId);
                });
            } else {
                setLoading(false);
                clearTimeout(timeoutId);
            }
        }).catch(err => {
            console.error("Auth check failed:", err);
            if (isMounted) {
                setLoading(false);
                clearTimeout(timeoutId);
            }
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                setLoading(false);
                return;
            }

            if (session?.user) {
                await fetchUserProfile(session.user.id, session.user);
            } else {
                setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    const fetchUserProfile = async (userId: string, sessionUser?: any) => {
        try {
            // Force a timeout on the profile fetch to prevent hanging
            // CRITICAL FIX: Use limit(1) instead of single() to avoid 406 errors if multiple rows exist
            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .limit(1);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Profile fetch timed out")), 5000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (error) {
                console.warn("Profile fetch warning:", error.message);
            }

            // Handle validation: data is now an array due to removing .single()
            const profileData = Array.isArray(data) ? data[0] : data;

            if (profileData) {
                const d = profileData;
                setCurrentUser({
                    id: d.id,
                    email: d.email || '',
                    name: d.name || 'Usuario',
                    role: d.role as 'master' | 'student',
                    academyId: d.academy_id || '',
                    studentId: d.student_id || undefined,
                    avatarUrl: d.avatar_url || '',
                    emailConfirmed: !!sessionUser?.email_confirmed_at
                });
            }
        } catch (err) {
            // Log as warning to reduce console noise unless critical
            console.warn('Profile fetch check completed with info:', err);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, pass: string) => {
        try {
            // Race between actual login and a timeout
            const { error } = await Promise.race([
                supabase.auth.signInWithPassword({
                    email,
                    password: pass
                }),
                new Promise<{ error: any }>((_, reject) =>
                    setTimeout(() => reject(new Error("Tiempo de espera agotado. Verifica tu conexión.")), 10000)
                )
            ]);

            if (error) throw error;
            addToast('Sesión iniciada', 'success');
            return true;
        } catch (error) {
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

        // Allow PulseService to throw errors (e.g. 429) so UI can handle them
        // Add timeout wrapper
        await Promise.race([
            PulseService.registerMaster(data),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Tiempo de espera agotado al registrar academia.")), 15000)
            )
        ]);

        addToast('Academia registrada. Por favor revisa tu correo.', 'success');
        return true;
    };

    const registerStudentAction = async (data: any) => {
        // Students might be registered without password initially or via master, logic depends on form.
        // Assuming data has password if it's a self-signup, but PulseService.registerStudent currently just inserts data.
        // If we added Auth to student registration, we'd check password here too.
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