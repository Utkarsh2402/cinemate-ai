import React, { useState } from 'react';
import { Sparkles, Search, ArrowRight, Loader2, Globe, Film, Tv, Star } from 'lucide-react';
import type { Movie, MovieDiscoveryResult, InternetMovieSuggestion } from '../types';
import { api } from '../api';

interface AIDiscoveryModalProps {
  currentCity: string;
  onSelectMovie: (movie: Movie) => void;
  onClose: () => void;
}

const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=700&q=80';

export const AIDiscoveryModal: React.FC<AIDiscoveryModalProps> = ({
  currentCity,
  onSelectMovie,
  onClose,
}) => {
  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [results, setResults] = useState<MovieDiscoveryResult | null>(null);

  const samplePrompts = [
    'Recommend top mind-bending sci-fi thrillers like Interstellar or Inception',
    'Best Hindi comedy movies with great ratings',
    'Action blockbusters available on Netflix or in theaters',
    'Award-winning drama movies under 2 hours',
  ];

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    try {
      setIsSearching(true);
      const res = await api.discoverMovies(searchQuery, currentCity);
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookInternetMovie = async (item: InternetMovieSuggestion) => {
    if (item.matched_local_movie_id) {
      try {
        const m = await api.getMovie(item.matched_local_movie_id);
        onClose();
        onSelectMovie(m);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-md shadow-rose-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                AI Universal Movie Discovery
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  Global Internet Catalog
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Ask Gemini for any movie across Netflix, Prime, Disney+, Theaters, or worldwide cinema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Input Bar */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="e.g. Suggest thrilling mind-bending movies with plot twists, or fun comedies for family night..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
            />
          </div>
          <button
            disabled={isSearching || !query.trim()}
            onClick={() => handleSearch(query)}
            className="px-6 py-3.5 rounded-2xl font-bold text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-md shadow-rose-200 flex-shrink-0"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Ask AI</span>
          </button>
        </div>

        {/* Sample Prompts */}
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
          <span className="text-slate-400 font-semibold">Try asking:</span>
          {samplePrompts.map((p) => (
            <button
              key={p}
              onClick={() => {
                setQuery(p);
                handleSearch(p);
              }}
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 text-slate-600 transition-colors text-left truncate max-w-xs"
            >
              "{p}"
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
            <p className="text-sm font-semibold text-slate-700">Searching global cinema & streaming platforms with Gemini AI...</p>
            <p className="text-xs text-slate-400">Curating titles from the entire internet and checking local theater availability.</p>
          </div>
        )}

        {/* Results Container */}
        {!isSearching && results && (
          <div className="space-y-6 animate-fadeIn">
            {/* Extracted Intent & Overview */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <p className="text-xs text-slate-700 mb-2 font-medium leading-relaxed">{results.explanation}</p>
              <div className="flex flex-wrap gap-2">
                {results.extracted_filters.genre && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                    Genre: {results.extracted_filters.genre}
                  </span>
                )}
                {results.extracted_filters.language && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-600 border border-sky-200">
                    Language: {results.extracted_filters.language}
                  </span>
                )}
                {results.extracted_filters.max_price && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    Max Price: ₹{results.extracted_filters.max_price}
                  </span>
                )}
                {results.extracted_filters.max_duration_minutes && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                    Max Runtime: {results.extracted_filters.max_duration_minutes}m
                  </span>
                )}
              </div>
            </div>

            {/* SECTION 1: Internet & Streaming Suggestions (Global Internet) */}
            {results.internet_suggestions && results.internet_suggestions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-rose-600" />
                    Worldwide Cinema & Streaming Recommendations ({results.internet_suggestions.length})
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Any movie on the internet</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {results.internet_suggestions.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-rose-400 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3.5 mb-3">
                        <img
                          src={item.poster_url || FALLBACK_POSTER}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = FALLBACK_POSTER;
                          }}
                          className="w-16 h-22 rounded-xl object-cover bg-slate-100 flex-shrink-0 shadow-sm border border-slate-100"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h4 className="font-extrabold text-slate-900 text-sm truncate" title={item.title}>
                              {item.title}
                            </h4>
                            <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex-shrink-0">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {item.rating.toFixed(1)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1.5">
                            {item.year && <span>{item.year}</span>}
                            <span>•</span>
                            <span>{item.duration || '130m'}</span>
                            <span>•</span>
                            <span>{item.language}</span>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white flex items-center gap-1">
                              <Tv className="w-2.5 h-2.5" />
                              {item.streaming_platform || 'Netflix'}
                            </span>
                            {item.genres?.slice(0, 2).map((g) => (
                              <span
                                key={g}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                {g}
                              </span>
                            ))}
                          </div>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {item.synopsis}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Action / Where to watch */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 truncate max-w-[200px]" title={item.where_to_watch}>
                          Watch: <span className="font-semibold text-slate-700">{item.where_to_watch}</span>
                        </span>

                        {item.matched_local_movie_id ? (
                          <button
                            onClick={() => handleBookInternetMovie(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-[11px] bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
                          >
                            <span>Book In Theaters</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <a
                            href={`https://www.google.com/search?q=watch+${encodeURIComponent(item.title)}+movie`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-semibold text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                          >
                            <span>Find Online</span>
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 2: Movies Showing in Local Theaters */}
            {results.movies && results.movies.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Film className="w-4 h-4 text-emerald-600" />
                    Now Playing in Theaters ({currentCity})
                  </h3>
                  <span className="text-[11px] text-emerald-600 font-bold">Instant Seat Reservation</span>
                </div>

                <div className="space-y-2.5">
                  {results.movies.map((m) => (
                    <div
                      key={m.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={m.poster_url || FALLBACK_POSTER}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = FALLBACK_POSTER;
                          }}
                          className="w-12 h-16 rounded-xl object-cover bg-slate-100 shadow-sm border border-slate-100"
                        />
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm">{m.title}</h4>
                          <p className="text-xs text-slate-500">
                            {m.language} • {m.duration_minutes}m • Rating: {m.rating}⭐
                          </p>
                          <p className="text-[11px] text-rose-600 font-medium">{m.genres.join(', ')}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          onSelectMovie(m);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-200 flex-shrink-0"
                      >
                        <span>Book Seats</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
