import React from 'react';
import { Play, Star, Clock, Ticket } from 'lucide-react';
import type { Movie } from '../types';

interface HeroBannerProps {
  movie: Movie | null;
  onBookNow: (movie: Movie) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ movie, onBookNow }) => {
  if (!movie) return null;

  return (
    <div className="relative w-full rounded-3xl overflow-hidden glass-card my-6 border border-slate-800 shadow-2xl">
      {/* Background Poster Image with Gradients */}
      <div className="absolute inset-0 z-0">
        <img
          src={movie.poster_url}
          alt={movie.title}
          className="w-full h-full object-cover object-center filter blur-md opacity-25 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070913] via-[#070913]/90 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070913] via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 md:p-12 max-w-2xl flex flex-col justify-center">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-600 text-white shadow-glow-red">
            Trending Now
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800/80 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            {movie.rating} / 10
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
            {movie.certification}
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {movie.duration_minutes} mins
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-3">
          {movie.title}
        </h1>

        {/* Genres & Language */}
        <p className="text-sm font-medium text-rose-400 mb-3 flex items-center gap-2">
          <span>{movie.language}</span>
          <span>•</span>
          <span>{movie.genres.join(', ')}</span>
        </p>

        {/* Synopsis */}
        <p className="text-sm sm:text-base text-slate-300 line-clamp-3 mb-6 leading-relaxed">
          {movie.synopsis}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => onBookNow(movie)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-glow-red transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Ticket className="w-4 h-4" />
            Book Tickets
          </button>

          <a
            href={movie.trailer_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title)}+trailer`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 transition-all"
          >
            <Play className="w-4 h-4 fill-slate-200 text-slate-200" />
            Watch Trailer
          </a>
        </div>
      </div>
    </div>
  );
};
