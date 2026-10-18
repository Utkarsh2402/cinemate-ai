import React from 'react';
import { Star, Clock, Ticket } from 'lucide-react';
import type { Movie } from '../types';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect }) => {
  return (
    <div className="group relative rounded-2xl overflow-hidden glass-card flex flex-col justify-between border border-slate-800/80 hover:border-rose-500/50 hover:shadow-glow-red transition-all duration-300">
      {/* Poster Image */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
        <img
          src={movie.poster_url}
          alt={movie.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070913] via-transparent to-transparent opacity-80" />

        {/* Rating Badge */}
        <div className="absolute top-2.5 right-2.5 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1 shadow-lg">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          {movie.rating.toFixed(1)}
        </div>

        {/* Top Badges (Netflix + Language) */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {movie.genres.some((g) => g.toLowerCase() === 'netflix') && (
            <div className="bg-red-600/95 text-white font-black text-[9px] tracking-widest px-2 py-0.5 rounded shadow-lg border border-red-500/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              NETFLIX
            </div>
          )}
          <div className="bg-slate-900/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-700 text-slate-300 font-semibold text-[10px]">
            {movie.language}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <h3 className="font-bold text-base text-white truncate mb-1" title={movie.title}>
            {movie.title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {movie.duration_minutes}m
            </span>
            <span>•</span>
            <span className="text-slate-300 font-medium">{movie.certification}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {movie.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Book Button */}
        <button
          onClick={() => onSelect(movie)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-glow-red group-hover:bg-rose-500"
        >
          <Ticket className="w-3.5 h-3.5" />
          Book Tickets
        </button>
      </div>
    </div>
  );
};
