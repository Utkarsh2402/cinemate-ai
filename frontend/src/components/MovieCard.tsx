import React, { useState, useEffect } from 'react';
import { Star, Clock, Ticket } from 'lucide-react';
import type { Movie } from '../types';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}

const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80';

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect }) => {
  const [imgSrc, setImgSrc] = useState<string>(movie.poster_url || FALLBACK_POSTER);

  useEffect(() => {
    if (movie.poster_url) {
      setImgSrc(movie.poster_url);
    }
  }, [movie.poster_url]);

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-rose-400 transition-all duration-300 flex flex-col justify-between">
      {/* Poster Image */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100">
        <img
          src={imgSrc}
          alt={movie.title}
          referrerPolicy="no-referrer"
          onError={() => setImgSrc(FALLBACK_POSTER)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

        {/* Rating Badge */}
        <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-md px-2 py-1 rounded-lg border border-amber-300 text-amber-600 font-bold text-xs flex items-center gap-1 shadow-sm">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          {movie.rating.toFixed(1)}
        </div>

        {/* Top Badges (Netflix + Language) */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
          {movie.genres.some((g) => g.toLowerCase() === 'netflix') && (
            <div className="bg-red-600 text-white font-black text-[9px] tracking-widest px-2 py-0.5 rounded shadow-sm border border-red-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              NETFLIX
            </div>
          )}
          <div className="bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 font-semibold text-[10px] shadow-sm">
            {movie.language}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col flex-1 justify-between bg-white">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 truncate mb-1" title={movie.title}>
            {movie.title}
          </h3>

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {movie.duration_minutes}m
            </span>
            <span>•</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              {movie.certification}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {movie.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Book Button */}
        <button
          onClick={() => onSelect(movie)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-200 active:scale-[0.98]"
        >
          <Ticket className="w-3.5 h-3.5" />
          Book Tickets
        </button>
      </div>
    </div>
  );
};
