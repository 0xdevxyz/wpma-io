'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff, User, Mail } from 'lucide-react';
import { useAuthStore } from '../../../lib/auth-store';
import { Button } from '../../../components/ui/button';

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const features = [
  {
    icon: '🚀',
    title: 'Schneller Start',
    description: 'In wenigen Minuten mit WordPress durchstarten'
  },
  {
    icon: '💼',
    title: 'Professionell',
    description: 'Enterprise-Level Tools für Ihr Business'
  },
  {
    icon: '🔐',
    title: 'Sicher & Zuverlässig',
    description: 'Ihre Daten sind bei uns in besten Händen'
  }
];

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>();

  const password = watch('password');

  // Check if mobile/tablet
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Feature rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const onSubmit = async (data: RegisterForm) => {
    const success = await registerUser({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password
    });
    if (success) {
      router.push('/dashboard');
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
          className="w-full max-w-6xl h-auto lg:h-[650px] bg-white/95 backdrop-blur-[30px] rounded-[30px] border border-white/30 shadow-[0_30px_60px_rgba(0,0,0,0.15)] flex flex-col lg:flex-row overflow-hidden relative"
        >
          {/* Left Side - Register Form */}
          <div className="flex-1 flex items-center justify-center px-6 py-8 md:px-12 md:py-10 relative" style={{ clipPath: isMobile ? 'none' : 'polygon(0 0, calc(100% - 30px) 0, 100% 100%, 0 100%)' }}>
            <div className="w-full max-w-md z-10">
              {/* Logo */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  W
                </div>
                <h1 className="text-2xl font-bold text-gray-900">WPMA.io</h1>
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Konto erstellen</h2>
              
              {/* Register Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vorname
                    </label>
                    <input
                      {...register('firstName', {
                        required: 'Vorname ist erforderlich',
                        minLength: {
                          value: 2,
                          message: 'Mindestens 2 Zeichen',
                        },
                      })}
                      className={`w-full px-4 py-3 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] ${
                        errors.firstName ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                      }`}
                      placeholder="Max"
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nachname
                    </label>
                    <input
                      {...register('lastName', {
                        required: 'Nachname ist erforderlich',
                        minLength: {
                          value: 2,
                          message: 'Mindestens 2 Zeichen',
                        },
                      })}
                      className={`w-full px-4 py-3 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] ${
                        errors.lastName ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                      }`}
                      placeholder="Mustermann"
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-Mail-Adresse
                  </label>
                  <input
                    {...register('email', {
                      required: 'E-Mail ist erforderlich',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Ungültige E-Mail-Adresse',
                      },
                    })}
          type="email"
                    className={`w-full px-5 py-4 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] ${
                      errors.email ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                    }`}
                    placeholder="max.mustermann@beispiel.de"
                  />
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passwort
                  </label>
                  <div className="relative">
                    <input
                      {...register('password', {
                        required: 'Passwort ist erforderlich',
                        minLength: {
                          value: 8,
                          message: 'Passwort muss mindestens 8 Zeichen lang sein',
                        },
                      })}
                      type={showPassword ? 'text' : 'password'}
                      className={`w-full px-5 py-4 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] ${
                        errors.password ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                      }`}
                      placeholder="Mindestens 8 Zeichen"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1 rounded"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <input
                      {...register('confirmPassword', {
                        required: 'Bitte bestätigen Sie Ihr Passwort',
                        validate: (value) =>
                          value === password || 'Passwörter stimmen nicht überein',
                      })}
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`w-full px-5 py-4 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] ${
                        errors.confirmPassword ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                      }`}
                      placeholder="Passwort wiederholen"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors p-1 rounded"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
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
                  Konto erstellen
        </Button>
      </form>
              
              <div className="mt-6 text-center text-sm text-gray-600">
                Bereits ein Konto?{' '}
                <button
                  onClick={() => router.push('/auth/login')}
                  className="text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline"
                >
                  Jetzt anmelden
                </button>
              </div>
            </div>
          </div>
          
          {/* Right Side - Features */}
          <div 
            className="hidden lg:flex flex-1 relative overflow-hidden bg-cover bg-center"
            style={{ 
              clipPath: 'polygon(30px 0, 100% 0, 100% 100%, 0 100%)',
              backgroundImage: 'url("https://images.unsplash.com/photo-1551434678-e076c223a692?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80")'
            }}
          >
            {/* Gradient Overlay - überdeckt das Bild komplett */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(219, 39, 119, 1) 0%, rgba(59, 130, 246, 1) 50%, rgba(147, 51, 234, 1) 100%)',
                clipPath: 'polygon(30px 0, 100% 0, 100% 100%, 0 100%)'
              }}
            />
            
            <div className="relative z-10 h-full flex items-center justify-center px-12 py-10">
              <div className="text-center text-white w-full max-w-lg">
                <h2 className="text-4xl font-bold mb-6 text-white text-shadow-lg">
                  Willkommen bei
                  <br />
                  WPMA.io
                </h2>
                <p className="text-lg mb-10 text-white leading-relaxed text-shadow">
                  Starten Sie noch heute mit der professionellen WordPress-Management-Plattform.
                </p>
                
                {/* Animated Features */}
                <div className="relative h-40 overflow-hidden w-full">
                  {features.map((feature, index) => (
                    <motion.div
                      key={index}
                      className={`absolute inset-0 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20 p-6 transition-all duration-600 ${
                        index === currentFeature ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
                      }`}
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl border border-white/30">
                          {feature.icon}
                        </div>
                        <h3 className="text-xl font-semibold text-white text-shadow">{feature.title}</h3>
                      </div>
                      <p className="text-white leading-relaxed text-shadow-sm text-left">
                        {feature.description}
                      </p>
                    </motion.div>
                  ))}
                </div>
                
                {/* Feature Indicators */}
                <div className="flex justify-center gap-2 mt-5">
                  {features.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentFeature(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentFeature 
                          ? 'bg-white scale-125' 
                          : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
