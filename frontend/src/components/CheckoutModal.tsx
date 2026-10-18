import React, { useState } from 'react';
import { CreditCard, Smartphone, Building, ShieldCheck, Tag, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import type { Show, SeatHoldResponse, TicketDetail } from '../types';
import { api } from '../api';

interface CheckoutModalProps {
  show: Show;
  holdData: SeatHoldResponse;
  onSuccess: (ticket: TicketDetail) => void;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  show,
  holdData,
  onSuccess,
  onClose,
}) => {
  const [promoCode, setPromoCode] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'NET_BANKING'>('UPI');
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Price calculations
  const subtotal = holdData.subtotal;
  const convenienceFee = 30.0 + 10.0 * holdData.holds.length;
  const taxAmount = Math.round(convenienceFee * 0.18 * 100) / 100;
  const totalAmount = Math.max(0, Math.round((subtotal + convenienceFee + taxAmount - discountAmount) * 100) / 100);

  const handleApplyPromo = () => {
    const code = promoCode.toUpperCase().trim();
    if (code === 'WELCOME50') {
      const disc = Math.min(150, subtotal * 0.5);
      setDiscountAmount(Math.round(disc * 100) / 100);
      setAppliedPromo('WELCOME50 (50% off)');
      setErrorMessage(null);
    } else if (code === 'FLAT100') {
      if (subtotal >= 400) {
        setDiscountAmount(100);
        setAppliedPromo('FLAT100 (₹100 flat discount)');
        setErrorMessage(null);
      } else {
        setErrorMessage('Coupon FLAT100 requires a minimum ticket subtotal of ₹400');
      }
    } else {
      setErrorMessage('Invalid promo coupon code. Try WELCOME50 or FLAT100');
    }
  };

  const handleProcessPayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      // 1. Create Pending Booking with server validation & pricing
      const booking = await api.createBooking(
        show.id,
        holdData.hold_token,
        appliedPromo ? appliedPromo.split(' ')[0] : undefined
      );

      // 2. Initiate Sandbox Checkout
      const checkoutRes = await api.checkout(booking.id, paymentMethod, simulateFailure);

      // 3. Trigger signed payment webhook
      const webhookRes = await api.simulatePaymentWebhookSuccess(
        checkoutRes.payment_id,
        booking.id,
        checkoutRes.amount
      );

      if (webhookRes.status === 'confirmed') {
        // Fetch generated digital ticket
        const bookingDetail = await api.getBooking(booking.id);
        if (bookingDetail.ticket_number) {
          const ticket = await api.getTicket(bookingDetail.ticket_number);
          onSuccess(ticket);
        } else {
          setErrorMessage('Booking confirmed, but ticket issuance is processing.');
        }
      } else if (webhookRes.status === 'refunded_due_to_expired_hold') {
        setErrorMessage('Hold expired before payment callback was received. Full refund automatically credited.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[95vh] overflow-y-auto glass-panel rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <h3 className="text-xl font-extrabold text-white">Complete Reservation</h3>
            <p className="text-xs text-slate-400">Sandbox Payment Processing</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Booking Summary Box */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 mb-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold text-white text-base">{show.movie?.title || 'Selected Movie'}</h4>
              <p className="text-xs text-slate-400">{show.screen?.theater?.name}</p>
              <p className="text-xs text-cyan-400 mt-0.5">
                {new Date(show.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                • {new Date(show.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({show.format})
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              {holdData.holds.length} Tickets
            </span>
          </div>

          <div className="text-xs text-slate-300 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Seats:</span>
            <span className="font-bold text-white">
              {holdData.holds.map((h) => `${h.row}${h.number}`).join(', ')}
            </span>
          </div>
        </div>

        {/* Coupon Discount */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            Promotions & Coupons
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. WELCOME50 or FLAT100"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
            <button
              onClick={handleApplyPromo}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 transition-colors"
            >
              Apply
            </button>
          </div>
          {appliedPromo && (
            <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
              <CheckCircle className="w-3 h-3" />
              Applied: {appliedPromo} (-₹{discountAmount})
            </p>
          )}
        </div>

        {/* Payment Method Selector */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-300 mb-2 block">Choose Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethod('UPI')}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                paymentMethod === 'UPI'
                  ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-glow-red'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              UPI / QR
            </button>
            <button
              onClick={() => setPaymentMethod('CARD')}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                paymentMethod === 'CARD'
                  ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-glow-red'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Card
            </button>
            <button
              onClick={() => setPaymentMethod('NET_BANKING')}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                paymentMethod === 'NET_BANKING'
                  ? 'bg-rose-600/20 border-rose-500 text-rose-400 shadow-glow-red'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Building className="w-4 h-4" />
              Net Banking
            </button>
          </div>
        </div>

        {/* Test Mode Failure Simulation Toggle */}
        <div className="mb-5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="pr-2">
            <p className="text-xs font-bold text-slate-300">Simulate Bank Decline</p>
            <p className="text-[10px] text-slate-500">Test backend payment failure & refund rollbacks</p>
          </div>
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => setSimulateFailure(e.target.checked)}
            className="w-4 h-4 accent-rose-500 cursor-pointer"
          />
        </div>

        {/* Price Breakdown */}
        <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs text-slate-400 mb-5">
          <div className="flex justify-between">
            <span>Ticket Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Convenience Fee</span>
            <span>₹{convenienceFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST (18%)</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-400 font-medium">
              <span>Coupon Discount</span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-extrabold text-white">
            <span>Amount Payable</span>
            <span className="text-rose-400">₹{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Pay Button */}
        <button
          disabled={isProcessing}
          onClick={handleProcessPayment}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-glow-red transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <span>Securing Payment & Ticket...</span>
          ) : (
            <>
              <span>Authorize & Pay ₹{totalAmount.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit Encrypted Sandbox Payment Gateway</span>
        </div>
      </div>
    </div>
  );
};
