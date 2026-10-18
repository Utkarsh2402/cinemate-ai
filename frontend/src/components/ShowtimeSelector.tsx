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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-600 font-bold border border-rose-200">
                {movie.certification}
              </span>
              <span className="text-xs text-slate-500 font-semibold">{movie.duration_minutes} mins</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600">{movie.genres.join(', ')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{movie.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Date Selector Tabs */}
        <div className="flex items-center gap-2.5 mb-6 pb-3 border-b border-slate-100">
          <Calendar className="w-4 h-4 text-rose-600 mr-1" />
          {dates.map((d) => (
            <button
              key={d.offset}
              onClick={() => setSelectedDayOffset(d.offset)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedDayOffset === d.offset
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Theaters List */}
        <div className="space-y-4">
          {Object.keys(theatersMap).length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-semibold">No showtimes scheduled for this date in your selected city.</p>
            </div>
          ) : (
            Object.values(theatersMap).map(({ theater, shows: tShows }) => (
              <div key={theater?.id || 't'} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 hover:border-slate-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                      {theater?.name || 'CineMate Cinema'}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                        {theater?.chain || 'Premium'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      {theater?.address || 'District Centre, Delhi'}
                    </p>
                  </div>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-1.5">
                    {theater?.amenities?.slice(0, 3).map((a: string) => (
                      <span key={a} className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 font-medium">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Showtimes Pill Grid */}
                <div className="flex flex-wrap gap-2.5">
                  {tShows.map((show) => {
                    const st = new Date(show.start_time);
                    const timeStr = st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const minPrice = Math.min(...show.pricing.map((p) => p.price));

                    return (
                      <button
                        key={show.id}
                        onClick={() => onSelectShow(show)}
                        className="group flex flex-col items-center justify-center px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-400 transition-all text-center shadow-sm"
                      >
                        <span className="text-sm font-extrabold text-slate-900 group-hover:text-rose-600 transition-colors">
                          {timeStr}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] mt-1 text-slate-500">
                          <span className="font-bold text-rose-600">{show.format}</span>
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
