import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EnvelopeOpenIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'; // Check if EnvelopeOpenIcon exists or use EnvelopeIcon

const VerifyEmail: React.FC = () => {
    const [resendStatus, setResendStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [cooldown, setCooldown] = React.useState(0);
    const location = useLocation();

    // Attempt to get email from navigation state or query param
    const email = location.state?.email || new URLSearchParams(location.search).get('email');

    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        if (cooldown > 0) {
            timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (!email) {
            alert("No se pudo identificar el correo. Por favor intenta registrarte nuevamente.");
            return;
        }

        setResendStatus('loading');
        try {
            // We need to import PulseService. 
            // Since this file didn't have it, we need to ensure it's imported at the top. 
            // I will assume for this block replacement that PulseService needs to be imported if not present.
            // However, this block replaces the FUNCTION BODY. I need to make sure I add the import too.
            // Wait, I can't add imports with this tool easily if I only replace the function.
            // I will use a larger range or a separate edit for imports if needed.
            // Ideally, I should have checked imports first. 
            // For now, I will assume I can't add the import here without replacing the whole file or using multi-replace.
            // I will use `PulseService` assuming I'll fix the import in a second step or if I replace the whole file.

            // Actually, let's just use the global PulseService if available or dynamic import? No, that's bad practice.
            // I will replace the whole file content in a subsequent step or use multi_replace.
            // For this specific tool call, I'm replacing lines 5-67.
            // I'll assume I can't add the import here. 
            // I will add the import in a separate `multi_replace` or `replace_file_content` call at the top.

            await import('../../services/pulseService').then(m => m.PulseService.resendVerificationEmail(email));

            setResendStatus('success');
            setCooldown(60);
        } catch (error: any) {
            console.error("Error resending email:", error);
            setResendStatus('error');
        } finally {
            if (resendStatus !== 'success') setResendStatus('idle'); // Keep success state if successful
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center">
                    <img
                        className="mx-auto h-12 w-auto"
                        src="/ikc-logo.png"
                        alt="IKC Management"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Revisa tu correo
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Hemos enviado un enlace de confirmación a tu dirección de correo electrónico.
                        {email && <span className="block font-medium mt-1 text-gray-900">{email}</span>}
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>

                        <div className="space-y-6">
                            <p className="text-gray-700">
                                Haz clic en el enlace del correo para activar tu cuenta y acceder a la plataforma.
                            </p>

                            <div className="rounded-md bg-blue-50 p-4">
                                <div className="flex">
                                    <div className="ml-3 w-full">
                                        <h3 className="text-sm font-medium text-blue-800">
                                            ¿No recibiste el correo?
                                        </h3>
                                        <div className="mt-2 text-sm text-blue-700">
                                            <p className="mb-3">
                                                Revisa tu carpeta de Spam o Correo no deseado.
                                            </p>

                                            {resendStatus === 'success' ? (
                                                <div className="p-2 bg-green-100 text-green-700 rounded text-xs font-bold">
                                                    ¡Correo reenviado exitosamente!
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleResend}
                                                    disabled={cooldown > 0 || resendStatus === 'loading' || !email}
                                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {resendStatus === 'loading' ? 'Enviando...' : cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar confirmación'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Link
                                    to="/login"
                                    className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-gray-50 border-blue-600 transition-colors"
                                >
                                    <ArrowLeftIcon className="h-4 w-4 mr-2" />
                                    Volver al inicio de sesión
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
