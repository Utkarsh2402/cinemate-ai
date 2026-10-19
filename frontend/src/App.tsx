import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MovieCard } from './components/MovieCard';
import { ShowtimeSelector } from './components/ShowtimeSelector';
import { SeatLayoutModal } from './components/SeatLayoutModal';
import { CheckoutModal } from './components/CheckoutModal';
import { DigitalTicketModal } from './components/DigitalTicketModal';
import { BookingHistoryModal } from './components/BookingHistoryModal';
import { AIDiscoveryModal } from './components/AIDiscoveryModal';
import { GroupPlannerModal } from './components/GroupPlannerModal';
import { AIChatDrawer } from './components/AIChatDrawer';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AuthModal } from './components/AuthModal';
import type { Movie, Show, SeatHoldResponse, TicketDetail } from './types';
import { api } from './api';
import { getRoomCodeFromUrl, clearRoomCodeFromUrl } from './utils/url';
import { Film, Filter, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const [currentCity, setCurrentCity] = useState<string>('Delhi');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoadingMovies, setIsLoadingMovies] = useState<boolean>(true);

  // Modal States
  const [selectedMovieForShows, setSelectedMovieForShows] = useState<Movie | null>(null);
  const [movieShows, setMovieShows] = useState<Show[]>([]);
  const [selectedShowForSeats, setSelectedShowForSeats] = useState<Show | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<{ show: Show; holdData: SeatHoldResponse } | null>(null);
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);

  const [isBookingsOpen, setIsBookingsOpen] = useState<boolean>(false);
  const [isAIDiscoveryOpen, setIsAIDiscoveryOpen] = useState<boolean>(false);
  const [isGroupPlannerOpen, setIsGroupPlannerOpen] = useState<boolean>(false);
  const [initialRoomCode, setInitialRoomCode] = useState<string>('');
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  const genres = ['All', 'Netflix', 'Action', 'Sci-Fi', 'Comedy', 'Drama', 'Horror', 'Adventure'];

  const fetchMovies = async () => {
    try {
      setIsLoadingMovies(true);
      const res = await api.getMovies({
        city: currentCity,
        search: searchQuery || undefined,
        genre: selectedGenre !== 'All' ? selectedGenre : undefined,
      });
      setMovies(res.items);
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setIsLoadingMovies(false);
    }
  };

  // Auto-open Group Planner if user arrived via an invite link ?room=CODE or path /room/CODE
  useEffect(() => {
    const code = getRoomCodeFromUrl();
    if (code) {
      setInitialRoomCode(code);
      setIsGroupPlannerOpen(true);
    }
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [currentCity, searchQuery, selectedGenre]);

  const handleOpenShowtimes = async (movie: Movie) => {
    try {
      setSelectedMovieForShows(movie);
      const shows = await api.getShows({ movie_id: movie.id, city: currentCity });
      setMovieShows(shows);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectMovieById = async (movieId: string) => {
    try {
      const movie = await api.getMovie(movieId);
      await handleOpenShowtimes(movie);
    } catch (err) {
      console.error(err);
    }
  };

  const featuredMovie = movies.length > 0 ? movies[0] : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between selection:bg-rose-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentCity={currentCity}
        onCityChange={(c) => setCurrentCity(c)}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
        onOpenAIDiscovery={() => setIsAIDiscoveryOpen(true)}
        onOpenGroupPlanner={() => setIsGroupPlannerOpen(true)}
        onOpenBookings={() => setIsBookingsOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 w-full flex-1">
        {/* Cinematic Featured Hero */}
        {!searchQuery && selectedGenre === 'All' && featuredMovie && (
          <HeroBanner movie={featuredMovie} onBookNow={handleOpenShowtimes} />
        )}

        {/* Section Header & Genre Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Film className="w-5 h-5 text-rose-600" />
              Now Showing in {currentCity}
            </h2>
            <p className="text-xs text-slate-500">Live cinema inventory with verified reserved seating</p>
          </div>

          {/* Genre Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 max-w-full touch-pan-x scrollbar-none select-none">
            <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mr-1" />
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                  selectedGenre === g
                    ? g === 'Netflix'
                      ? 'bg-red-600 text-white shadow-md shadow-red-200 border border-red-600'
                      : 'bg-rose-600 text-white shadow-md shadow-rose-200 border border-rose-600'
                    : g === 'Netflix'
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                    : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm'
                }`}
              >
                {g === 'Netflix' && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />}
                {g === 'Netflix' ? 'Netflix Live' : g}
              </button>
            ))}
          </div>
        </div>

        {/* Movie Grid */}
        {isLoadingMovies ? (
          <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-rose-600" />
            <p className="text-sm font-semibold">Syncing live catalog...</p>
          </div>
        ) : movies.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <Film className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">No movies found</h3>
            <p className="text-xs text-slate-500 mb-4">
              Try adjusting your search criteria, selecting another city, or ask AI Discover.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGenre('All');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} onSelect={handleOpenShowtimes} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 CineMate AI — Production-Grade Movie Ticket Reservation Architecture.</p>
          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Redis Hold Locking Active
            </span>
            <span>•</span>
            <span>PostgreSQL ACID Transactions</span>
          </div>
        </div>
      </footer>

      {/* Floating Conversational AI Drawer */}
      <AIChatDrawer currentCity={currentCity} />

      {/* Modals */}
      {selectedMovieForShows && (
        <ShowtimeSelector
          movie={selectedMovieForShows}
          shows={movieShows}
          onSelectShow={(show) => {
            setSelectedMovieForShows(null);
            setSelectedShowForSeats(show);
          }}
          onClose={() => setSelectedMovieForShows(null)}
        />
      )}

      {selectedShowForSeats && (
        <SeatLayoutModal
          show={selectedShowForSeats}
          onProceedToCheckout={(show, holdData) => {
            setSelectedShowForSeats(null);
            setActiveCheckout({ show, holdData });
          }}
          onClose={() => setSelectedShowForSeats(null)}
          onOpenAuth={() => setIsAuthOpen(true)}
        />
      )}

      {activeCheckout && (
        <CheckoutModal
          show={activeCheckout.show}
          holdData={activeCheckout.holdData}
          onSuccess={(ticket) => {
            setActiveCheckout(null);
            setActiveTicket(ticket);
          }}
          onClose={() => setActiveCheckout(null)}
        />
      )}

      {activeTicket && (
        <DigitalTicketModal ticket={activeTicket} onClose={() => setActiveTicket(null)} />
      )}

      {isBookingsOpen && (
        <BookingHistoryModal
          onClose={() => setIsBookingsOpen(false)}
          onViewTicket={(ticket) => {
            setIsBookingsOpen(false);
            setActiveTicket(ticket);
          }}
        />
      )}

      {isAIDiscoveryOpen && (
        <AIDiscoveryModal
          currentCity={currentCity}
          onSelectMovie={handleOpenShowtimes}
          onClose={() => setIsAIDiscoveryOpen(false)}
        />
      )}

      {isGroupPlannerOpen && (
        <GroupPlannerModal
          currentCity={currentCity}
          initialRoomCode={initialRoomCode}
          onSelectMovieById={handleSelectMovieById}
          onClose={() => {
            setIsGroupPlannerOpen(false);
            setInitialRoomCode('');
            clearRoomCodeFromUrl();
          }}
        />
      )}

      {isAdminOpen && <AdminDashboardModal onClose={() => setIsAdminOpen(false)} />}

      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
