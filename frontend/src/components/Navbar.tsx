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
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-md shadow-rose-200">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                CineMate <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold">AI</span>
              </span>
              <p className="text-[10px] text-slate-500 tracking-wider uppercase font-semibold">Cinema & Streaming Discovery</p>
            </div>
          </div>

          {/* City Selector */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <select
              value={currentCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="bg-transparent text-slate-800 outline-none cursor-pointer font-semibold"
            >
              {cities.map((c) => (
                <option key={c} value={c} className="bg-white text-slate-900">
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
            className="w-full bg-slate-100 border border-slate-200 rounded-full pl-10 pr-4 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-rose-500 transition-colors"
          />
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* AI Discovery Trigger */}
          <button
            onClick={onOpenAIDiscovery}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">AI Discover</span>
          </button>

          {/* Group Movie Planner */}
          <button
            onClick={onOpenGroupPlanner}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-sm"
          >
            <Users className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Group Planner</span>
          </button>

          {/* My Bookings */}
          {isAuthenticated && (
            <button
              onClick={onOpenBookings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-sm"
            >
              <Ticket className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">My Bookings</span>
            </button>
          )}

          {/* Admin Dashboard */}
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          {/* User Auth Profile / Login */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[100px]">{user?.full_name}</p>
                <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm shadow-rose-200"
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
