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

  // Handle Seat Click
  const handleSeatClick = (seat: SeatItem) => {
    if (seat.status === 'BOOKED' || seat.status === 'HELD' || seat.status === 'BLOCKED') {
      return;
    }

    if (selectedSeatIds.includes(seat.seat_id)) {
      setSelectedSeatIds(selectedSeatIds.filter((id) => id !== seat.seat_id));
    } else {
      if (selectedSeatIds.length >= 10) {
        setErrorMessage('You can select a maximum of 10 seats per booking.');
        return;
      }
      setSelectedSeatIds([...selectedSeatIds, seat.seat_id]);
    }
    setErrorMessage(null);
  };

  // Acquire Dual-Layer Temporary Hold via Backend
  const handleLockSeats = async () => {
    if (!isAuthenticated) {
      onOpenAuth();
      return;
    }

    if (selectedSeatIds.length === 0) {
      setErrorMessage('Please select at least one available seat.');
      return;
    }

    try {
      setIsHolding(true);
      setErrorMessage(null);
      const holdRes = await api.holdSeats(show.id, selectedSeatIds);
      setActiveHold(holdRes);
      setRemainingSeconds(holdRes.remaining_seconds);
      // Refresh seat layout to mark them HELD_BY_ME
      await loadSeatAvailability(holdRes.hold_token);
    } catch (err: any) {
      // Concurrency conflict caught (409)!
      setErrorMessage(err.message || 'Seats were just reserved by another user. Please choose another seat.');
      // Refresh to display new occupancy
      await loadSeatAvailability();
      setSelectedSeatIds([]);
    } finally {
      setIsHolding(false);
    }
  };

  // Group seats by Row letter
  const rowsMap: Record<string, SeatItem[]> = {};
  layout?.seats.forEach((s) => {
    if (!rowsMap[s.row]) rowsMap[s.row] = [];
    rowsMap[s.row].push(s);
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
      return 'bg-rose-500 text-white border-rose-400 shadow-glow-red scale-105';
    }

    switch (seat.status) {
      case 'BOOKED':
        return 'bg-slate-800 text-slate-600 border-slate-700/50 cursor-not-allowed opacity-50';
      case 'HELD':
        return 'bg-amber-600/40 text-amber-300 border-amber-500/60 cursor-not-allowed';
      case 'BLOCKED':
        return 'bg-slate-900 border-transparent cursor-not-allowed opacity-20';
      default:
        // By Tier
        switch (seat.seat_type.toUpperCase()) {
          case 'RECLINER':
            return 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500 hover:text-black';
          case 'VIP':
            return 'bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500 hover:text-white';
          case 'PREMIUM':
            return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500 hover:text-white';
          default:
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500 hover:text-white';
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[95vh] overflow-y-auto glass-panel rounded-3xl p-5 sm:p-8 border border-slate-700/90 shadow-2xl flex flex-col justify-between">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold mb-1">
              <span>{layout?.screen_name || 'Auditorium'}</span>
              <span>•</span>
              <span className="text-cyan-400 font-bold">{layout?.screen_type || '2D'}</span>
              <span>•</span>
              <span className="text-slate-300">
                {new Date(show.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">{layout?.movie_title}</h2>
            <p className="text-xs text-slate-400">{layout?.theater_name}</p>
          </div>

          {/* Active Hold Countdown Badge */}
          {activeHold && remainingSeconds > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse">
              <Clock className="w-4 h-4" />
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider">Seats Held For Checkout</p>
                <p className="text-sm font-mono font-extrabold">{formatTimer(remainingSeconds)} remaining</p>
              </div>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-8 h-8 self-end sm:self-auto rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Curved Cinema Screen Projection Visual */}
        <div className="my-4 text-center">
          <div className="w-3/4 mx-auto screen-curve mb-1" />
          <p className="text-[11px] text-cyan-400 uppercase tracking-widest font-semibold opacity-80">
            CINEMA PROJECTION SCREEN
          </p>
        </div>

        {/* Interactive Auditorium Grid */}
        {isLoading && !layout ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-rose-500" />
            <p className="text-xs">Loading auditorium seating map...</p>
          </div>
        ) : (
          <div className="my-6 overflow-x-auto pb-4 flex flex-col items-center">
            <div className="min-w-[480px] space-y-2">
            {Object.keys(rowsMap)
              .sort()
              .map((rowLetter) => (
                <div key={rowLetter} className="flex items-center justify-center gap-2">
                  <span className="w-5 text-xs font-bold text-slate-400 text-center">{rowLetter}</span>
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
                  <span className="w-5 text-xs font-bold text-slate-400 text-center">{rowLetter}</span>
                </div>
              ))}
          </div>
        </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 py-3 border-t border-b border-slate-800 text-xs text-slate-400 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-900 border border-emerald-500/60" />
            <span>Standard (₹{layout?.pricing['STANDARD'] || 220})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-900 border border-cyan-500/60" />
            <span>Premium (₹{layout?.pricing['PREMIUM'] || 320})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-900 border border-purple-500/60" />
            <span>VIP (₹{layout?.pricing['VIP'] || 450})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-900 border border-amber-500/60" />
            <span>Recliner (₹{layout?.pricing['RECLINER'] || 650})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-rose-500 border border-rose-400" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-amber-600/40 border border-amber-500" />
            <span>On Hold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700 opacity-50" />
            <span>Sold</span>
          </div>
        </div>

        {/* Bottom Checkout Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {selectedSeatsInfo.length} Seat(s) Selected:
              </span>
              <span className="text-sm text-rose-400 font-bold">
                {selectedSeatsInfo.map((s) => `${s.row}${s.number}`).join(', ') || 'None'}
              </span>
            </div>

            {selectedSeatsInfo.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                Subtotal: ₹{subtotal} + Fee & GST: ₹{convenienceFee + taxAmount} ={' '}
                <span className="text-white font-bold">Total: ₹{totalAmount}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>

            {activeHold ? (
              <button
                onClick={() => onProceedToCheckout(show, activeHold)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Proceed to Checkout (₹{totalAmount})
              </button>
            ) : (
              <button
                disabled={selectedSeatIds.length === 0 || isHolding}
                onClick={handleLockSeats}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-glow-red transition-all"
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
