'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Globe, Server, Shield, Zap } from 'lucide-react';
import { useAuthStore } from '../../../lib/auth-store';
import { Button } from '../../../components/ui/button';

interface LoginForm {
  email: string;
  password: string;
}

const features = [
  {
    icon: '🚀',
    title: 'Hochperformant',
    description: 'Blitzschnelle WordPress-Websites mit optimierter Performance'
  },
  {
    icon: '🔒',
    title: 'Sicher',
    description: 'Maximale Sicherheit durch automatische Updates und Monitoring'
  },
  {
    icon: '⚡',
    title: 'Automatisiert',
    description: 'Vollautomatische Backups und Wartung für sorgenfreies Hosting'
  }
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [showPassword, setShowPassword] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

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

  const onSubmit = async (data: LoginForm) => {
    const success = await login(data.email, data.password);
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
          className="w-full max-w-6xl h-auto lg:h-[600px] bg-white/95 backdrop-blur-[30px] rounded-[30px] border border-white/30 shadow-[0_30px_60px_rgba(0,0,0,0.15)] flex flex-col lg:flex-row overflow-hidden relative"
        >
          {/* Left Side - Login Form */}
          <div className="flex-1 flex items-center justify-center px-6 py-8 md:px-12 md:py-16 relative" style={{ clipPath: isMobile ? 'none' : 'polygon(0 0, calc(100% - 30px) 0, 100% 100%, 0 100%)' }}>
            <div className="w-full max-w-md z-10">
              {/* Logo */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  W
                </div>
                <h1 className="text-2xl font-bold text-gray-900">WPMA.io</h1>
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Kundencenter</h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Logge dich hier mit deinen Zugangsdaten ein.
              </p>
              
              {/* Login Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-Mail oder Benutzername
                  </label>
                  <div className="relative">
                    <input
                      {...register('email', {
                        required: 'E-Mail ist erforderlich',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Ungültige E-Mail-Adresse',
                        },
                      })}
                      type="email"
                      className={`w-full px-5 py-4 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] focus:-translate-y-0.5 ${
                        errors.email ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                      }`}
                      placeholder="E-Mail oder Benutzername"
                    />
                    {!errors.email && (
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-green-500">
                        ✓
                      </div>
                    )}
                  </div>
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
                          value: 6,
                          message: 'Passwort muss mindestens 6 Zeichen lang sein',
                        },
                      })}
                      type={showPassword ? 'text' : 'password'}
                      className={`w-full px-5 py-4 border-2 rounded-2xl text-base bg-white/80 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:bg-white/95 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] focus:-translate-y-0.5 ${
                        errors.password ? 'border-red-500 bg-red-50/90' : 'border-gray-200'
                      }`}
                      placeholder="Passwort"
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
                
                <Button
                  type="submit"
                  loading={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(59,130,246,0.4)] shadow-[0_8px_20px_rgba(59,130,246,0.3)] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  size="lg"
                >
                  {isLoading && (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  )}
                  Einloggen
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <button
                  onClick={() => router.push('/auth/forgot-password')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                >
                  Zugangsdaten vergessen?
                </button>
              </div>
              
              <div className="mt-7 text-center relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative bg-white px-4">
                  <span className="text-sm text-gray-500">oder</span>
                </div>
              </div>
              
              <div className="mt-7 text-center text-sm text-gray-600">
                Noch kein Konto?{' '}
                <button
                  onClick={() => router.push('/auth/register')}
                  className="text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline"
                >
                  Jetzt registrieren
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
                  WordPress
                  <br />
                  Management
                </h2>
                <p className="text-lg mb-10 text-white leading-relaxed text-shadow">
                  Die professionelle Lösung für WordPress-Hosting und Management. Schnell, sicher und zuverlässig.
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
