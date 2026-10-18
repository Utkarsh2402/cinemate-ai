import React, { useState, useEffect } from 'react';
import { Ticket, Calendar, Clock, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import type { BookingDetail, TicketDetail } from '../types';
import { api } from '../api';

interface BookingHistoryModalProps {
  onClose: () => void;
  onViewTicket: (ticket: TicketDetail) => void;
}

export const BookingHistoryModal: React.FC<BookingHistoryModalProps> = ({ onClose, onViewTicket }) => {
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const data = await api.getUserBookings();
      setBookings(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load booking history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking and initiate refund?')) {
      return;
    }
    try {
      setCancellingId(bookingId);
      setErrorMessage(null);
      const res = await api.cancelBooking(bookingId, 'Customer cancelled via web portal');
      setSuccessMessage(res.message || 'Booking cancelled and refund initiated.');
      await fetchBookings();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const handleOpenTicket = async (ticketNumber?: string) => {
    if (!ticketNumber) return;
    try {
      const ticket = await api.getTicket(ticketNumber);
      onViewTicket(ticket);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not load ticket pass');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Confirmed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">Cancelled</span>;
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">Pending</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">Expired</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-panel rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-rose-500" />
            <h2 className="text-2xl font-extrabold text-white">My Movie Bookings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs">
            {successMessage}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
            <span>Loading your booking history...</span>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p>You haven't made any movie reservations yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => {
              const showTime = new Date(b.start_time);

              return (
                <div key={b.id} className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">{b.booking_code}</span>
                      {getStatusBadge(b.status)}
                    </div>
                    <h3 className="font-extrabold text-lg text-white">{b.movie_title}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      {b.theater_name} — {b.screen_name} ({b.format})
                    </p>
                    <p className="text-xs text-slate-300 flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        {showTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {showTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>
                        Seats: <strong className="text-white">{b.seats.map((s) => `${s.row}${s.number}`).join(', ')}</strong>
                      </span>
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <p className="text-base font-extrabold text-rose-400">₹{b.total_amount.toFixed(2)}</p>

                    <div className="flex gap-2">
                      {b.status === 'CONFIRMED' && b.ticket_number && (
                        <button
                          onClick={() => handleOpenTicket(b.ticket_number)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        >
                          View Pass
                        </button>
                      )}

                      {b.is_cancellable && (
                        <button
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancelBooking(b.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 transition-colors"
                        >
                          {cancellingId === b.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
