import React from 'react';
import { CheckCircle2, QrCode, Printer, MapPin, Calendar, Clock } from 'lucide-react';
import type { TicketDetail } from '../types';

interface DigitalTicketModalProps {
  ticket: TicketDetail;
  onClose: () => void;
}

export const DigitalTicketModal: React.FC<DigitalTicketModalProps> = ({ ticket, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const showDate = new Date(ticket.start_time);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg glass-panel rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl">
        {/* Success Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center mb-2 shadow-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Booking Confirmed!</h2>
          <p className="text-xs text-slate-400">Your digital cinema admission pass is ready</p>
        </div>

        {/* Boarding Pass Ticket Container */}
        <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative mb-6">
          {/* Decorative Top Notch */}
          <div className="p-5 border-b border-dashed border-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  Confirmed Ticket
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1.5">{ticket.movie_title}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-rose-500" />
                  {ticket.theater_name} — {ticket.screen_name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Booking ID</p>
                <p className="text-xs font-mono font-bold text-white">{ticket.booking_code}</p>
              </div>
            </div>
          </div>

          {/* Ticket Body */}
          <div className="p-5 grid grid-cols-2 gap-4 text-xs border-b border-dashed border-slate-800">
            <div>
              <p className="text-slate-500 font-semibold uppercase text-[10px] flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </p>
              <p className="text-white font-bold mt-0.5">
                {showDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold uppercase text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3" /> Show Time
              </p>
              <p className="text-white font-bold mt-0.5">
                {showDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold uppercase text-[10px]">Seats</p>
              <p className="text-rose-400 font-extrabold text-sm mt-0.5">
                {ticket.seats.join(', ')}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-semibold uppercase text-[10px]">Total Paid</p>
              <p className="text-emerald-400 font-bold text-sm mt-0.5">₹{ticket.total_amount.toFixed(2)}</p>
            </div>
          </div>

          {/* QR Code Admission Verification Section */}
          <div className="p-5 flex flex-col items-center justify-center bg-slate-950/70">
            {ticket.qr_code_image_base64 ? (
              <div className="p-2.5 rounded-xl bg-white shadow-xl mb-2">
                <img
                  src={ticket.qr_code_image_base64}
                  alt="QR Ticket Code"
                  className="w-32 h-32 object-contain"
                />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
                <QrCode className="w-12 h-12" />
              </div>
            )}
            <p className="text-xs font-mono font-bold text-slate-300 tracking-wider">
              {ticket.ticket_number}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Scan at cinema gate for seamless entry</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save Pass
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-glow-red transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
