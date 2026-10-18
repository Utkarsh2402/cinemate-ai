import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, Ticket, Film, RefreshCw, BarChart2, DollarSign } from 'lucide-react';
import type { AdminAnalytics } from '../types';
import { api } from '../api';

interface AdminDashboardModalProps {
  onClose: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ onClose }) => {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAdminAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/40 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">Administration & Analytics</h2>
              <p className="text-xs text-amber-300">Auditorium occupancy, transactional revenue, and booking volumes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            <span>Aggregating cinema telemetry...</span>
          </div>
        ) : !analytics ? (
          <p className="text-center text-slate-400 py-12">Failed to load analytics.</p>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="glass-card rounded-2xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Gross Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-400">₹{analytics.total_revenue.toFixed(0)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Succeeded payments</p>
              </div>

              <div className="glass-card rounded-2xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Total Bookings</span>
                  <Ticket className="w-4 h-4 text-rose-400" />
                </div>
                <p className="text-2xl font-extrabold text-white">{analytics.total_bookings}</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">{analytics.confirmed_bookings} confirmed</p>
              </div>

              <div className="glass-card rounded-2xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Avg Occupancy</span>
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                </div>
                <p className="text-2xl font-extrabold text-cyan-300">{analytics.average_occupancy_rate}%</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Across active shows</p>
              </div>

              <div className="glass-card rounded-2xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Inventory Catalog</span>
                  <Film className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-extrabold text-amber-300">{analytics.total_movies}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{analytics.total_shows} scheduled shows</p>
              </div>
            </div>

            {/* Occupancy by Show Table */}
            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                Auditorium Occupancy & Seat Utilization
              </h3>
              <div className="space-y-3">
                {analytics.recent_occupancies.map((show) => {
                  const showTime = new Date(show.start_time);
                  return (
                    <div key={show.show_id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white truncate max-w-[200px] sm:max-w-md">
                          {show.movie_title} — {show.theater_name} ({show.screen_name})
                        </span>
                        <span className="text-cyan-400 font-mono font-bold">{show.occupancy_rate}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, show.occupancy_rate)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                        <span>
                          {showTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                          {showTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>
                          Booked: <strong>{show.booked_seats}</strong> / {show.total_seats} seats (Rev: ₹{show.total_revenue.toFixed(0)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
