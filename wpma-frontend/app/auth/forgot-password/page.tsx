'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      // Simuliere API-Call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setEmailSent(true);
      toast.success('Anweisungen zur Passwort-Zurücksetzung wurden an Ihre E-Mail gesendet!');
    } catch (error) {
      toast.error('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate particles
  const particles = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    left: `${(i + 1) * 10}%`,
    delay: `${i * 0.5}s`
  }));

  return (
    <div className="min-h-screen overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 animate-gradient-xy bg-[length:400%_400%]" />
      
      {/* Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 bg-white/30 rounded-full animate-float"
            style={{
              left: particle.left,
              animationDelay: particle.delay,
              animationDuration: `${8 + (particle.id % 4)}s`
            }}
          />
        ))}
      </div>
      
      {/* Blurred Overlay */}
      <div className="absolute inset-0 backdrop-blur-[120px] bg-white/5" />
      
      {/* Main Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white/95 backdrop-blur-[30px] rounded-[30px] border border-white/30 shadow-[0_30px_60px_rgba(0,0,0,0.15)] p-10"
        >
          {/* Back Button */}
          <button
            onClick={() => router.push('/auth/login')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            <span>Zurück zum Login</span>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
              W
            </div>
            <h1 className="text-2xl font-bold text-gray-900">WPMA.io</h1>
          </div>
          
          {!emailSent ? (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Passwort vergessen?</h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen Anweisungen zum Zurücksetzen Ihres Passworts.
              </p>
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-Mail-Adresse
                  </label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail size={20} />
                    </div>
                    <input
                      {...register('email', {
                        required: 'E-Mail ist erforderlich',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Ungültige E-Mail-Adresse',
                        },
                      })}
                      type="email"
                      className={`w-full pl-14 pr-5 py-4 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] focus:-translate-y-0.5 ${
                        errors.email ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                      }`}
                      placeholder="ihre.email@beispiel.de"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>
                
                <Button
                  type="submit"
                  loading={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(59,130,246,0.4)] shadow-[0_8px_20px_rgba(59,130,246,0.3)] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  size="lg"
                >
                  {isLoading && (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  )}
                  Anweisungen senden
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">E-Mail gesendet!</h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Wir haben Ihnen Anweisungen zum Zurücksetzen Ihres Passworts an Ihre E-Mail-Adresse gesendet. 
                Bitte überprüfen Sie Ihren Posteingang.
              </p>
              <Button
                onClick={() => router.push('/auth/login')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-2xl transition-all duration-300"
              >
                Zurück zum Login
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

