import React, { useState } from 'react';
import { Clock, MapPin, Calendar } from 'lucide-react';
import type { Movie, Show } from '../types';

interface ShowtimeSelectorProps {
  movie: Movie;
  shows: Show[];
  onSelectShow: (show: Show) => void;
  onClose: () => void;
}

export const ShowtimeSelector: React.FC<ShowtimeSelectorProps> = ({
  movie,
  shows,
  onSelectShow,
  onClose,
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);

  // Group shows by Theater
  const theatersMap: Record<string, { theater: any; shows: Show[] }> = {};
  shows.forEach((s) => {
    const t = s.screen?.theater;
    const tId = t?.id || 'default_theater';
    if (!theatersMap[tId]) {
      theatersMap[tId] = { theater: t, shows: [] };
    }
    theatersMap[tId].shows.push(s);
  });

  const dates = [
    { label: 'Today', offset: 0 },
    { label: 'Tomorrow', offset: 1 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-panel rounded-3xl p-6 sm:p-8 border border-slate-700/80 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold border border-rose-500/30">
                {movie.certification}
              </span>
              <span className="text-xs text-slate-400">{movie.duration_minutes} mins</span>
              <span className="text-xs text-slate-400">• {movie.genres.join(', ')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{movie.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Date Selector Tabs */}
        <div className="flex items-center gap-3 mb-6 pb-2 border-b border-slate-800">
          <Calendar className="w-4 h-4 text-rose-500 mr-1" />
          {dates.map((d) => (
            <button
              key={d.offset}
              onClick={() => setSelectedDayOffset(d.offset)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedDayOffset === d.offset
                  ? 'bg-rose-600 text-white shadow-glow-red'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Theaters List */}
        <div className="space-y-6">
          {Object.keys(theatersMap).length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <p>No showtimes scheduled for this date in your selected city.</p>
            </div>
          ) : (
            Object.values(theatersMap).map(({ theater, shows: tShows }) => (
              <div key={theater?.id || 't'} className="glass-card rounded-2xl p-5 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h4 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                      {theater?.name || 'CineMate Cinema'}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        {theater?.chain || 'Premium'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      {theater?.address || 'District Centre, Delhi'}
                    </p>
                  </div>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-1.5">
                    {theater?.amenities?.slice(0, 3).map((a: string) => (
                      <span key={a} className="text-[10px] px-2 py-0.5 rounded bg-slate-900/90 text-cyan-300 border border-cyan-500/20">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Showtimes Pill Grid */}
                <div className="flex flex-wrap gap-3">
                  {tShows.map((show) => {
                    const st = new Date(show.start_time);
                    const timeStr = st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const minPrice = Math.min(...show.pricing.map((p) => p.price));

                    return (
                      <button
                        key={show.id}
                        onClick={() => onSelectShow(show)}
                        className="group flex flex-col items-center justify-center px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-rose-600/20 border border-slate-700/80 hover:border-rose-500 transition-all text-center"
                      >
                        <span className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                          {timeStr}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] mt-1 text-slate-400">
                          <span className="font-semibold text-cyan-400">{show.format}</span>
                          <span>•</span>
                          <span>from ₹{minPrice}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
