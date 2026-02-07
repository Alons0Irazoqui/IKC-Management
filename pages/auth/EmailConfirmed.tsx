import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const EmailConfirmed: React.FC = () => {
    const navigate = useNavigate();

    // Optional: Auto-redirect after 5 seconds if desired, currently manual
    // useEffect(() => {
    //     const timer = setTimeout(() => navigate('/login'), 5000);
    //     return () => clearTimeout(timer);
    // }, [navigate]);

    return (
        <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto h-24 w-24 flex items-center justify-center rounded-full bg-green-100">
                    <CheckCircleIcon className="h-16 w-16 text-green-600" aria-hidden="true" />
                </div>
                <h2 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
                    Correo Confirmado
                </h2>
                <p className="mt-2 text-center text-lg text-gray-600">
                    Tu cuenta ha sido verificada exitosamente.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">
                    <div className="space-y-6">
                        <div className="text-center">
                            <p className="text-sm text-gray-500 mb-6">
                                Ahora puedes acceder a tu panel de control y comenzar a gestionar tu academia.
                            </p>

                            <Link
                                to="/login"
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                Iniciar Sesión
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-gray-400">
                &copy; {new Date().getFullYear()} IKC Management. Todos los derechos reservados.
            </div>
        </div>
    );
};

export default EmailConfirmed;
