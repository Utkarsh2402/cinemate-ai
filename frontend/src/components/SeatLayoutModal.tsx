import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, Ticket, AlertCircle, RefreshCw } from 'lucide-react';
import type { Show, ShowSeatAvailability, SeatItem, SeatHoldResponse } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

interface SeatLayoutModalProps {
  show: Show;
  onProceedToCheckout: (show: Show, holdData: SeatHoldResponse) => void;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const SeatLayoutModal: React.FC<SeatLayoutModalProps> = ({
  show,
  onProceedToCheckout,
  onClose,
  onOpenAuth,
}) => {
  const { isAuthenticated } = useAuth();
  const [layout, setLayout] = useState<ShowSeatAvailability | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [activeHold, setActiveHold] = useState<SeatHoldResponse | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch real-time seat availability
  const loadSeatAvailability = async (holdToken?: string) => {
    try {
      setIsLoading(true);
      const data = await api.getShowSeats(show.id, holdToken);
      setLayout(data);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load auditorium layout');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSeatAvailability();
  }, [show.id]);

  // Countdown timer for active temporary hold
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setActiveHold(null);
          setSelectedSeatIds([]);
          setErrorMessage('Seat hold expired. Please select your seats again.');
          loadSeatAvailability();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds]);

  // Toggle seat selection
  const handleSeatClick = (seat: SeatItem) => {
    if (seat.status === 'BOOKED' || seat.status === 'HELD') {
      return;
    }

    if (activeHold) {
      setErrorMessage('Seats are already locked for checkout. Please complete booking or cancel.');
      return;
    }

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.seat_id)) {
        return prev.filter((id) => id !== seat.seat_id);
      } else {
        if (prev.length >= 8) {
          setErrorMessage('Maximum 8 seats can be selected per booking');
          return prev;
        }
        setErrorMessage(null);
        return [...prev, seat.seat_id];
      }
    });
  };

  // Lock seats via distributed Redis hold
  const handleLockSeats = async () => {
    if (selectedSeatIds.length === 0) return;
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    try {
      setIsHolding(true);
      setErrorMessage(null);
      const hold = await api.holdSeats(show.id, selectedSeatIds);
      setActiveHold(hold);
      setRemainingSeconds(hold.remaining_seconds);
      await loadSeatAvailability(hold.hold_token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Selected seats could not be held. They might have just been reserved.');
      await loadSeatAvailability();
    } finally {
      setIsHolding(false);
    }
  };

  // Organize seats by row
  const rowsMap: Record<string, SeatItem[]> = {};
  layout?.seats.forEach((seat) => {
    if (!rowsMap[seat.row]) {
      rowsMap[seat.row] = [];
    }
    rowsMap[seat.row].push(seat);
  });

  // Sort seats within each row
  Object.keys(rowsMap).forEach((r) => {
    rowsMap[r].sort((a, b) => a.number - b.number);
  });

  // Calculate live price breakdown
  const selectedSeatsInfo = layout?.seats.filter((s) => selectedSeatIds.includes(s.seat_id)) || [];
  const subtotal = selectedSeatsInfo.reduce((acc, s) => acc + s.price, 0);
  const convenienceFee = selectedSeatsInfo.length > 0 ? 30.0 + 10.0 * selectedSeatsInfo.length : 0;
  const taxAmount = roundTwo(convenienceFee * 0.18);
  const totalAmount = roundTwo(subtotal + convenienceFee + taxAmount);

  function roundTwo(num: number): number {
    return Math.round(num * 100) / 100;
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Color mapping per seat type and status
  const getSeatColorClass = (seat: SeatItem) => {
    const isSelected = selectedSeatIds.includes(seat.seat_id) || seat.status === 'HELD_BY_ME';

    if (isSelected) {
      return 'bg-rose-600 text-white border-rose-600 shadow-md scale-105';
    }

    switch (seat.status) {
      case 'BOOKED':
        return 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed opacity-60';
      case 'HELD':
        return 'bg-amber-100 text-amber-700 border-amber-300 cursor-not-allowed';
      case 'BLOCKED':
        return 'bg-slate-100 border-transparent cursor-not-allowed opacity-30';
      default:
        // By Tier
        switch (seat.seat_type.toUpperCase()) {
          case 'RECLINER':
            return 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-500 hover:text-white';
          case 'VIP':
            return 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-600 hover:text-white';
          case 'PREMIUM':
            return 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-600 hover:text-white';
          default:
            return 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-600 hover:text-white';
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[95vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-2xl flex flex-col justify-between">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-rose-600 font-bold mb-1">
              <span>{layout?.screen_name || 'Auditorium'}</span>
              <span>•</span>
              <span className="text-slate-800 font-bold">{layout?.screen_type || '2D'}</span>
              <span>•</span>
              <span className="text-slate-500">
                {new Date(show.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">{layout?.movie_title}</h2>
            <p className="text-xs text-slate-500">{layout?.theater_name}</p>
          </div>

          {/* Active Hold Countdown Badge */}
          {activeHold && remainingSeconds > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 animate-pulse">
              <Clock className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider">Seats Held For Checkout</p>
                <p className="text-sm font-mono font-extrabold">{formatTimer(remainingSeconds)} remaining</p>
              </div>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-9 h-9 self-end sm:self-auto rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Curved Cinema Screen Projection Visual */}
        <div className="my-3 text-center">
          <div className="w-3/4 mx-auto screen-curve mb-1" />
          <p className="text-[11px] text-sky-600 uppercase tracking-widest font-black opacity-90">
            CINEMA PROJECTION SCREEN
          </p>
        </div>

        {/* Interactive Auditorium Grid */}
        {isLoading && !layout ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-rose-600" />
            <p className="text-xs font-semibold">Loading auditorium seating map...</p>
          </div>
        ) : (
          <div className="my-5 overflow-x-auto pb-4 flex flex-col items-center">
            <div className="min-w-[480px] space-y-2">
              {Object.keys(rowsMap)
                .sort()
                .map((rowLetter) => (
                  <div key={rowLetter} className="flex items-center justify-center gap-2">
                    <span className="w-5 text-xs font-black text-slate-400 text-center">{rowLetter}</span>
                    <div className="flex items-center gap-1.5">
                      {rowsMap[rowLetter].map((seat) => (
                        <button
                          key={seat.seat_id}
                          disabled={seat.status === 'BOOKED' || seat.status === 'HELD'}
                          onClick={() => handleSeatClick(seat)}
                          title={`Row ${seat.row} Seat ${seat.number} (${seat.seat_type}) - ₹${seat.price}`}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center ${getSeatColorClass(
                            seat
                          )}`}
                        >
                          {seat.number}
                        </button>
                      ))}
                    </div>
                    <span className="w-5 text-xs font-black text-slate-400 text-center">{rowLetter}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 py-3 border-t border-b border-slate-100 text-xs text-slate-600 mb-4 bg-slate-50/60 rounded-xl">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-300" />
            <span>Standard (₹{layout?.pricing['STANDARD'] || 220})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-sky-50 border border-sky-300" />
            <span>Premium (₹{layout?.pricing['PREMIUM'] || 320})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-purple-50 border border-purple-300" />
            <span>VIP (₹{layout?.pricing['VIP'] || 450})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-300" />
            <span>Recliner (₹{layout?.pricing['RECLINER'] || 650})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-rose-600 border border-rose-600" />
            <span className="font-bold text-rose-600">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300" />
            <span>On Hold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-200 opacity-60" />
            <span>Sold</span>
          </div>
        </div>

        {/* Bottom Checkout Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {selectedSeatsInfo.length} Seat(s) Selected:
              </span>
              <span className="text-sm text-rose-600 font-black">
                {selectedSeatsInfo.map((s) => `${s.row}${s.number}`).join(', ') || 'None'}
              </span>
            </div>

            {selectedSeatsInfo.length > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                Subtotal: ₹{subtotal} + Fee & GST: ₹{convenienceFee + taxAmount} ={' '}
                <span className="text-slate-900 font-black">Total: ₹{totalAmount}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              Cancel
            </button>

            {activeHold ? (
              <button
                onClick={() => onProceedToCheckout(show, activeHold)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Proceed to Checkout (₹{totalAmount})
              </button>
            ) : (
              <button
                disabled={selectedSeatIds.length === 0 || isHolding}
                onClick={handleLockSeats}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-rose-200 transition-all"
              >
                <Ticket className="w-4 h-4" />
                {isHolding ? 'Locking Seats...' : `Hold Seats & Pay (₹${totalAmount})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
