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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Administration & Analytics</h2>
              <p className="text-xs text-slate-500">Auditorium occupancy, transactional revenue, and booking volumes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-rose-600" />
            <span className="text-xs font-semibold">Aggregating cinema telemetry...</span>
          </div>
        ) : !analytics ? (
          <p className="text-center text-slate-500 py-12">Failed to load analytics.</p>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-semibold">
                  <span>Gross Revenue</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-600">₹{analytics.total_revenue.toFixed(0)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Succeeded payments</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-semibold">
                  <span>Total Bookings</span>
                  <Ticket className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-2xl font-black text-slate-900">{analytics.total_bookings}</p>
                <p className="text-[10px] text-emerald-600 mt-0.5 font-bold">{analytics.confirmed_bookings} confirmed</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-semibold">
                  <span>Avg Occupancy</span>
                  <TrendingUp className="w-4 h-4 text-sky-600" />
                </div>
                <p className="text-2xl font-black text-sky-600">{analytics.average_occupancy_rate}%</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Across active shows</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-semibold">
                  <span>Inventory Catalog</span>
                  <Film className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-amber-600">{analytics.total_movies}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{analytics.total_shows} scheduled shows</p>
              </div>
            </div>

            {/* Occupancy by Show Table */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-sky-600" />
                Auditorium Occupancy & Seat Utilization
              </h3>
              <div className="space-y-3">
                {analytics.recent_occupancies.map((show) => {
                  const showTime = new Date(show.start_time);
                  return (
                    <div key={show.show_id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-900 truncate max-w-[200px] sm:max-w-md">
                          {show.movie_title} — {show.theater_name} ({show.screen_name})
                        </span>
                        <span className="text-sky-600 font-mono font-bold">{show.occupancy_rate}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, show.occupancy_rate)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                        <span>
                          {showTime.toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                          {showTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>
                          Booked: <strong className="text-slate-800">{show.booked_seats}</strong> / {show.total_seats} seats (Rev: ₹{show.total_revenue.toFixed(0)})
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
