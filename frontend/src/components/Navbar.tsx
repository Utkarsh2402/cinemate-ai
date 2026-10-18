import React, { useState } from 'react';
import { Film, Sparkles, Users, Ticket, Shield, LogIn, LogOut, MapPin, Search, Menu, X } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);

  const cities = ['Delhi', 'Noida', 'Gurgaon', 'Mumbai'];

  const handleMobileNavAction = (action: () => void) => {
    setIsMobileMenuOpen(false);
    action();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Logo & City (Desktop + Mobile) */}
          <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-md shadow-rose-200">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                  CineMate <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold">AI</span>
                </span>
                <p className="text-[9px] sm:text-[10px] text-slate-500 tracking-wider uppercase font-semibold hidden xs:block">
                  Cinema & Streaming
                </p>
              </div>
            </div>

            {/* City Selector (Desktop / Tablet) */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 transition-colors">
              <MapPin className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <select
                aria-label="Select City"
                value={currentCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="bg-transparent text-slate-800 outline-none cursor-pointer font-bold text-xs"
              >
                {cities.map((c) => (
                  <option key={c} value={c} className="bg-white text-slate-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Center: Global Search Bar (Desktop) */}
          <div className="hidden lg:flex flex-1 max-w-md relative mx-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search movies"
              placeholder="Search movies by title, genre, language..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-full pl-10 pr-4 py-1.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-rose-500 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right: Desktop Action Buttons */}
          <div className="hidden sm:flex items-center gap-2 lg:gap-2.5">
            {/* AI Discovery Trigger */}
            <button
              onClick={onOpenAIDiscovery}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-all shadow-sm active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden md:inline">AI Discover</span>
            </button>

            {/* Group Movie Planner */}
            <button
              onClick={onOpenGroupPlanner}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-sm active:scale-95"
            >
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden md:inline">Group Planner</span>
            </button>

            {/* My Bookings */}
            {isAuthenticated && (
              <button
                onClick={onOpenBookings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-sm active:scale-95"
              >
                <Ticket className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden lg:inline">My Bookings</span>
              </button>
            )}

            {/* Admin Dashboard */}
            {isAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all active:scale-95"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden lg:inline">Admin</span>
              </button>
            )}

            {/* User Auth Profile / Login */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="text-right hidden md:block">
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[110px]">{user?.full_name}</p>
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm shadow-rose-200 active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          {/* Mobile Right Controls (< 640px) */}
          <div className="flex sm:hidden items-center gap-1.5">
            {/* Quick City Selector Pill */}
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700">
              <MapPin className="w-3 h-3 text-rose-600" />
              <select
                aria-label="Mobile City Selector"
                value={currentCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="bg-transparent text-slate-800 outline-none cursor-pointer"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Mobile Search Toggle */}
            <button
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className={`p-2 rounded-lg border transition-colors ${
                isMobileSearchOpen || searchQuery
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="Search Movies"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
              title="Open Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4 text-rose-600" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar Dropdown */}
        {isMobileSearchOpen && (
          <div className="pt-2.5 pb-1 sm:hidden animate-fadeIn">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Search movies, genres, language..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-rose-500 shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center bg-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="fixed top-0 right-0 bottom-0 w-[82vw] max-w-xs bg-white border-l border-slate-200 shadow-2xl p-5 flex flex-col justify-between overflow-y-auto animate-slideIn">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-sm">
                    <Film className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-black text-slate-900 text-base">CineMate Menu</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Card or Sign In Button */}
              {isAuthenticated ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900">{user?.full_name}</p>
                    <p className="text-[10px] text-slate-500">{user?.email}</p>
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                      {user?.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleMobileNavAction(onOpenAuth)}
                  className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs bg-rose-600 text-white shadow-md shadow-rose-200 active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In / Register
                </button>
              )}

              {/* City Selection */}
              <div className="mb-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Select Location
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {cities.map((c) => (
                    <button
                      key={c}
                      onClick={() => onCityChange(c)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                        currentCity === c
                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Navigation Links */}
              <div className="space-y-2">
                <button
                  onClick={() => handleMobileNavAction(onOpenAIDiscovery)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold text-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <div className="text-left">
                    <p>AI Movie Discovery</p>
                    <p className="text-[10px] text-rose-600/80 font-normal">Gemini & Streaming Matches</p>
                  </div>
                </button>

                <button
                  onClick={() => handleMobileNavAction(onOpenGroupPlanner)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs transition-colors"
                >
                  <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div className="text-left">
                    <p>Group Movie Planner</p>
                    <p className="text-[10px] text-slate-500 font-normal">Ranked Consensus Voting</p>
                  </div>
                </button>

                {isAuthenticated && (
                  <button
                    onClick={() => handleMobileNavAction(onOpenBookings)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs transition-colors"
                  >
                    <Ticket className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <div className="text-left">
                      <p>My Reservations</p>
                      <p className="text-[10px] text-slate-500 font-normal">View QR Admission Passes</p>
                    </div>
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => handleMobileNavAction(onOpenAdmin)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs transition-colors"
                  >
                    <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div className="text-left">
                      <p>Chain Admin Dashboard</p>
                      <p className="text-[10px] text-amber-700/80 font-normal">Revenue & Capacity Metrics</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 font-medium">
                CineMate AI v1.0 • Protected by Redis Dual-Lock
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
