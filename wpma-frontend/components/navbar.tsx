'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  LogOut,
  ChevronDown,
  User,
  Bell,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '../lib/auth-store';
import { useTheme } from './theme-provider';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bulk-operations', label: 'Bulk', icon: Layers },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const isAuthPage = pathname?.startsWith('/auth');
  if (isAuthPage || !isAuthenticated) return null;

  function handleLogout() {
    logout();
    router.replace('/auth/login');
  }

  const initials = user
    ? `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase() ||
      user.email?.charAt(0).toUpperCase()
    : '?';

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-14
      bg-white/90 dark:bg-gray-950/95
      backdrop-blur-md
      border-b border-gray-200 dark:border-white/[0.06]
      transition-colors duration-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-6">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-sm tracking-tight">
            wpma<span className="text-blue-500">.io</span>
          </span>
        </Link>

        <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 ml-auto">

          {/* Theme Toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            className="p-2 rounded-md transition-colors
              text-gray-500 hover:text-gray-900 hover:bg-gray-100
              dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/[0.06]"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />
            }
          </button>

          {/* Notifications */}
          <button className="p-2 rounded-md transition-colors
            text-gray-500 hover:text-gray-900 hover:bg-gray-100
            dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/[0.06]">
            <Bell className="w-4 h-4" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-md transition-colors
                hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <span className="text-sm hidden sm:block max-w-[120px] truncate
                text-gray-700 dark:text-gray-300">
                {user?.email?.split('@')[0]}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform
                text-gray-400 dark:text-gray-500
                ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-52 z-20 py-1.5 rounded-xl shadow-2xl overflow-hidden
                  bg-white border border-gray-200
                  dark:bg-gray-900 dark:border-white/10">
                  <div className="px-3 py-2 border-b mb-1
                    border-gray-100 dark:border-white/[0.06]">
                    <p className="text-xs font-semibold truncate
                      text-gray-900 dark:text-white">{user?.email}</p>
                    <p className="text-xs capitalize mt-0.5
                      text-gray-500 dark:text-gray-500">{user?.planType ?? 'Free'} Plan</p>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push('/dashboard'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                      text-gray-700 hover:bg-gray-50
                      dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <User className="w-3.5 h-3.5" />
                    Profil
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-white/[0.06]" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                      text-red-500 hover:bg-red-50
                      dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Abmelden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
