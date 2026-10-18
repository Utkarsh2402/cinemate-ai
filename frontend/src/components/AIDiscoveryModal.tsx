import React, { useState } from 'react';
import { Sparkles, Search, ArrowRight, Loader2 } from 'lucide-react';
import type { Movie } from '../types';
import { api } from '../api';

interface AIDiscoveryModalProps {
  currentCity: string;
  onSelectMovie: (movie: Movie) => void;
  onClose: () => void;
}

export const AIDiscoveryModal: React.FC<AIDiscoveryModalProps> = ({
  currentCity,
  onSelectMovie,
  onClose,
}) => {
  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [results, setResults] = useState<{
    explanation: string;
    extracted_filters: any;
    movies: Movie[];
  } | null>(null);

  const samplePrompts = [
    'Find a Hindi comedy under ₹300 per ticket, lasting less than two hours',
    'English Sci-Fi action movies with high rating',
    'Drama or biography movies playing in Delhi',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-panel rounded-3xl p-6 sm:p-8 border border-cyan-500/40 shadow-glow-cyan">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">AI Natural Language Discovery</h2>
              <p className="text-xs text-cyan-300">Intelligent movie filter extraction & catalog query engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Input Bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="e.g. Find a Hindi comedy near me under ₹300 lasting less than 2 hours..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>
          <button
            disabled={isSearching || !query.trim()}
            onClick={() => handleSearch(query)}
            className="px-6 py-3 rounded-2xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all shadow-glow-cyan"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Discover
          </button>
        </div>

        {/* Sample Prompts */}
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
          <span className="text-slate-500 font-semibold">Try asking:</span>
          {samplePrompts.map((p) => (
            <button
              key={p}
              onClick={() => {
                setQuery(p);
                handleSearch(p);
              }}
              className="px-3 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors truncate max-w-xs"
            >
              "{p}"
            </button>
          ))}
        </div>

        {/* Results Container */}
        {results && (
          <div className="space-y-4 animate-fadeIn">
            {/* Extracted Filters Tag Cloud */}
            <div className="glass-card rounded-2xl p-4 border border-cyan-500/20">
              <p className="text-xs text-slate-300 mb-2 font-medium">{results.explanation}</p>
              <div className="flex flex-wrap gap-2">
                {results.extracted_filters.genre && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Genre: {results.extracted_filters.genre}
                  </span>
                )}
                {results.extracted_filters.language && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Language: {results.extracted_filters.language}
                  </span>
                )}
                {results.extracted_filters.max_price && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Max Price: ₹{results.extracted_filters.max_price}
                  </span>
                )}
                {results.extracted_filters.max_duration_minutes && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Max Runtime: {results.extracted_filters.max_duration_minutes}m
                  </span>
                )}
              </div>
            </div>

            {/* Movie Matches */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Matched Cinema Titles ({results.movies.length})
              </h3>
              {results.movies.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No exact matches found. Try broadening the budget or duration criteria.
                </p>
              ) : (
                results.movies.map((m) => (
                  <div
                    key={m.id}
                    className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={m.poster_url}
                        alt={m.title}
                        className="w-12 h-16 rounded-lg object-cover bg-slate-900"
                      />
                      <div>
                        <h4 className="font-bold text-white text-sm">{m.title}</h4>
                        <p className="text-xs text-slate-400">
                          {m.language} • {m.duration_minutes}m • Rating: {m.rating}⭐
                        </p>
                        <p className="text-[11px] text-cyan-400">{m.genres.join(', ')}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onSelectMovie(m);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-glow-red flex-shrink-0"
                    >
                      <span>Book Show</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
