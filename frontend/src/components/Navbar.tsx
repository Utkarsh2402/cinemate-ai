import React from 'react';
import { Film, Sparkles, Users, Ticket, Shield, LogIn, LogOut, MapPin, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentCity: string;
  onCityChange: (city: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAIDiscovery: () => void;
  onOpenGroupPlanner: () => void;
  onOpenBookings: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentCity,
  onCityChange,
  searchQuery,
  onSearchChange,
  onOpenAIDiscovery,
  onOpenGroupPlanner,
  onOpenBookings,
  onOpenAdmin,
  onOpenAuth,
}) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const cities = ['Delhi', 'Noida', 'Gurgaon', 'Mumbai'];

  return (
    <nav className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-glow-red">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                CineMate <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">AI</span>
              </span>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">Cinema Reserved</p>
            </div>
          </div>

          {/* City Selector */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            <select
              value={currentCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer font-medium"
            >
              {cities.map((c) => (
                <option key={c} value={c} className="bg-slate-900 text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search movies by title, genre, language..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/70 rounded-full pl-10 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/80 transition-colors"
          />
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Discovery Trigger */}
          <button
            onClick={onOpenAIDiscovery}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-500/20 to-rose-500/20 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400 transition-all shadow-glow-cyan"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">AI Discover</span>
          </button>

          {/* Group Movie Planner */}
          <button
            onClick={onOpenGroupPlanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-all"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Group Planner</span>
          </button>

          {/* My Bookings */}
          {isAuthenticated && (
            <button
              onClick={onOpenBookings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-all"
            >
              <Ticket className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">My Bookings</span>
            </button>
          )}

          {/* Admin Dashboard */}
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          {/* User Auth Profile / Login */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-white truncate max-w-[100px]">{user?.full_name}</p>
                <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-glow-red"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
