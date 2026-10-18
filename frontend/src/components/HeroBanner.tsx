import React, { useState } from 'react';
import { Play, Star, Clock, Ticket } from 'lucide-react';
import type { Movie } from '../types';

interface HeroBannerProps {
  movie: Movie | null;
  onBookNow: (movie: Movie) => void;
}

const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80';

export const HeroBanner: React.FC<HeroBannerProps> = ({ movie, onBookNow }) => {
  const [imgError, setImgError] = useState(false);

  if (!movie) return null;

  const posterSrc = imgError || !movie.poster_url ? FALLBACK_POSTER : movie.poster_url;

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-white my-6 border border-slate-200 shadow-xl flex flex-col md:flex-row items-stretch">
      {/* Visual Backdrop with subtle overlay */}
      <div className="relative w-full md:w-5/12 min-h-[300px] md:min-h-[380px] overflow-hidden bg-slate-100 flex-shrink-0">
        <img
          src={posterSrc}
          alt={movie.title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-transparent via-transparent to-white/90 hidden md:block" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent md:hidden" />

        {/* Floating Rating Badge */}
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-300 text-amber-600 font-extrabold text-xs flex items-center gap-1.5 shadow-md">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>{movie.rating.toFixed(1)} / 10 Critic Rating</span>
        </div>
      </div>

      {/* Content Side */}
      <div className="relative z-10 p-6 md:p-10 flex-1 flex flex-col justify-between bg-white">
        <div>
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-600 text-white shadow-sm shadow-rose-200">
              Featured Premiere
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {movie.certification}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {movie.duration_minutes} mins
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-2">
            {movie.title}
          </h1>

          {/* Genres & Language */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-rose-600 mb-4">
            <span className="uppercase tracking-wider px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
              {movie.language}
            </span>
            <span>•</span>
            <span className="text-slate-500 font-medium">{movie.genres.join(', ')}</span>
          </div>

          {/* Synopsis */}
          <p className="text-sm sm:text-base text-slate-600 line-clamp-3 mb-6 leading-relaxed">
            {movie.synopsis}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() => onBookNow(movie)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Ticket className="w-4 h-4" />
            Book Tickets Now
          </button>

          <a
            href={movie.trailer_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title)}+trailer`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
          >
            <Play className="w-4 h-4 fill-slate-700 text-slate-700" />
            Watch Trailer
          </a>
        </div>
      </div>
    </div>
  );
};
