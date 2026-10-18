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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92vh] bg-white rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* 1. STICKY TOP HEADER */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex-shrink-0 bg-white/95 backdrop-blur-md z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 text-xs text-rose-600 font-bold mb-0.5">
              <span>{layout?.screen_name || 'Auditorium'}</span>
              <span>•</span>
              <span className="text-slate-800 font-bold">{layout?.screen_type || '2D'}</span>
              <span>•</span>
              <span className="text-slate-500">
                {new Date(show.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">{layout?.movie_title}</h2>
            <p className="text-[11px] sm:text-xs text-slate-500">{layout?.theater_name}</p>
          </div>

          {/* Active Hold Countdown Badge */}
          {activeHold && remainingSeconds > 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 animate-pulse self-start sm:self-auto">
              <Clock className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-[9px] uppercase font-black tracking-wider">Seats Held For Checkout</p>
                <p className="text-xs sm:text-sm font-mono font-extrabold">{formatTimer(remainingSeconds)} remaining</p>
              </div>
            </div>
          ) : (
            <button
              onClick={onClose}
              aria-label="Close Seat Map"
              className="w-8 h-8 sm:w-9 sm:h-9 self-end sm:self-auto rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2. SCROLLABLE MIDDLE CONTENT (Screen curve + Seat Grid + Legend) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 space-y-3 sm:space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Curved Cinema Screen Projection Visual */}
          <div className="my-1 sm:my-3 text-center">
            <div className="w-3/4 mx-auto screen-curve mb-1" />
            <p className="text-[10px] sm:text-[11px] text-sky-600 uppercase tracking-widest font-black opacity-90">
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
            <div className="my-2 sm:my-4">
              {/* Mobile swipe helper */}
              <div className="sm:hidden text-center text-[10px] text-slate-500 font-semibold mb-2 flex items-center justify-center gap-1.5 bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200">
                <span>👉</span>
                <span>Swipe horizontally to browse rows & seats</span>
                <span>👈</span>
              </div>

              <div className="w-full overflow-x-auto pb-4 touch-pan-x scrollbar-thin">
                <div className="inline-block min-w-full text-center">
                  <div className="inline-flex flex-col items-center space-y-2 px-2">
                    {Object.keys(rowsMap)
                      .sort()
                      .map((rowLetter) => (
                        <div key={rowLetter} className="flex items-center justify-center gap-2">
                          <span className="w-5 text-xs font-black text-slate-400 text-center select-none">{rowLetter}</span>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {rowsMap[rowLetter].map((seat) => (
                              <button
                                key={seat.seat_id}
                                disabled={seat.status === 'BOOKED' || seat.status === 'HELD'}
                                onClick={() => handleSeatClick(seat)}
                                title={`Row ${seat.row} Seat ${seat.number} (${seat.seat_type}) - ₹${seat.price}`}
                                aria-label={`Row ${seat.row} Seat ${seat.number}`}
                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-[10px] sm:text-xs font-bold border transition-all flex items-center justify-center select-none active:scale-95 ${getSeatColorClass(
                                  seat
                                )}`}
                              >
                                {seat.number}
                              </button>
                            ))}
                          </div>
                          <span className="w-5 text-xs font-black text-slate-400 text-center select-none">{rowLetter}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 py-2 sm:py-3 border-t border-b border-slate-100 text-[10px] sm:text-xs text-slate-600 bg-slate-50/70 rounded-xl px-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300" />
              <span>Standard (₹{layout?.pricing['STANDARD'] || 220})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-sky-50 border border-sky-300" />
              <span>Premium (₹{layout?.pricing['PREMIUM'] || 320})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-50 border border-purple-300" />
              <span>VIP (₹{layout?.pricing['VIP'] || 450})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-50 border border-amber-300" />
              <span>Recliner (₹{layout?.pricing['RECLINER'] || 650})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-rose-600 border border-rose-600" />
              <span className="font-bold text-rose-600">Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
              <span>On Hold</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-slate-200 border border-slate-200 opacity-60" />
              <span>Sold</span>
            </div>
          </div>
        </div>

        {/* 3. STICKY BOTTOM CHECKOUT ACTION BAR (ALWAYS VISIBLE & UNMISSABLE) */}
        <div className="p-3 sm:p-5 border-t border-slate-200 bg-white/95 backdrop-blur-md flex-shrink-0 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {selectedSeatsInfo.length} Seat(s) Selected:
                </span>
                <span className="text-xs sm:text-sm text-rose-600 font-black">
                  {selectedSeatsInfo.map((s) => `${s.row}${s.number}`).join(', ') || 'None'}
                </span>
              </div>

              {selectedSeatsInfo.length > 0 ? (
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  Tickets: ₹{subtotal} + Fee & GST: ₹{convenienceFee + taxAmount} ={' '}
                  <span className="text-slate-900 font-black text-xs sm:text-sm">Total: ₹{totalAmount}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-0.5">Tap any available seat coordinate above to begin</p>
              )}
            </div>

            <div className="flex items-stretch sm:items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                Cancel
              </button>

              {activeHold ? (
                <button
                  onClick={() => onProceedToCheckout(show, activeHold)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Proceed to Checkout (₹{totalAmount})
                </button>
              ) : (
                <button
                  disabled={selectedSeatIds.length === 0 || isHolding}
                  onClick={handleLockSeats}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 shadow-lg ${
                    selectedSeatIds.length > 0
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 cursor-pointer animate-pulse'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70 shadow-none'
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  {isHolding
                    ? 'Locking Seats...'
                    : selectedSeatIds.length > 0
                    ? `Hold Seats & Pay (₹${totalAmount})`
                    : 'Select Seats to Pay'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
