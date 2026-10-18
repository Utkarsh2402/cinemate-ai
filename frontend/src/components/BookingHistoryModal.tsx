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
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Confirmed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Expired</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <Ticket className="w-5 h-5 text-rose-600" />
            <h2 className="text-2xl font-black text-slate-900">My Movie Bookings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
            {successMessage}
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-rose-600" />
            <span className="text-xs font-semibold">Loading your booking history...</span>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-sm font-semibold">You haven't made any movie reservations yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => {
              const showTime = new Date(b.start_time);

              return (
                <div key={b.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500">{b.booking_code}</span>
                      {getStatusBadge(b.status)}
                    </div>
                    <h3 className="font-extrabold text-lg text-slate-900">{b.movie_title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      {b.theater_name} — {b.screen_name} ({b.format})
                    </p>
                    <p className="text-xs text-slate-600 flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {showTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {showTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>
                        Seats: <strong className="text-slate-900">{b.seats.map((s) => `${s.row}${s.number}`).join(', ')}</strong>
                      </span>
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                    <p className="text-base font-black text-rose-600">₹{b.total_amount.toFixed(2)}</p>

                    <div className="flex gap-2">
                      {b.status === 'CONFIRMED' && b.ticket_number && (
                        <button
                          onClick={() => handleOpenTicket(b.ticket_number)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-sm"
                        >
                          View Pass
                        </button>
                      )}

                      {b.is_cancellable && (
                        <button
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancelBooking(b.id)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
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
