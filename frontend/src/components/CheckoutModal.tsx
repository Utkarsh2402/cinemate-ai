import React, { useState } from 'react';
import { CreditCard, Smartphone, Building, ShieldCheck, Tag, AlertTriangle, CheckCircle, ArrowRight, Zap } from 'lucide-react';
import type { Show, SeatHoldResponse, TicketDetail } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const [gateway, setGateway] = useState<'RAZORPAY' | 'SANDBOX'>('RAZORPAY');
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

  const handleRazorpayPayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      // Verify Razorpay SDK is loaded
      if (typeof (window as any).Razorpay === 'undefined') {
        throw new Error('Razorpay SDK is loading. Please check your internet connection and try again.');
      }

      // 1. Create Pending Booking with server validation & pricing
      const booking = await api.createBooking(
        show.id,
        holdData.hold_token,
        appliedPromo ? appliedPromo.split(' ')[0] : undefined
      );

      // 2. Create Razorpay order on backend
      const order = await api.createRazorpayOrder(booking.id);

      // 3. Launch official Razorpay standard checkout popup
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'CineMate AI',
        description: `${show.movie?.title || 'Movie'} • ${holdData.holds.length} Ticket(s)`,
        image: show.movie?.poster_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=200&auto=format&fit=crop',
        order_id: order.order_id,
        handler: async function (response: any) {
          try {
            setIsProcessing(true);
            const verifyRes = await api.verifyRazorpayPayment({
              booking_id: booking.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.status === 'confirmed') {
              const bookingDetail = await api.getBooking(booking.id);
              if (bookingDetail.ticket_number) {
                const ticket = await api.getTicket(bookingDetail.ticket_number);
                onSuccess(ticket);
              } else {
                setErrorMessage('Booking confirmed, but ticket issuance is processing.');
              }
            } else if (verifyRes.status === 'refunded_due_to_expired_hold') {
              setErrorMessage('Hold expired before payment callback was received. Full refund automatically credited to your account.');
            }
          } catch (err: any) {
            setErrorMessage(err.message || 'Signature verification failed.');
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: user?.full_name || 'CineMate Customer',
          email: user?.email || 'customer@cinemate.ai',
          contact: user?.phone || '9999999999',
        },
        theme: {
          color: '#e11d48',
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', function (resp: any) {
        setErrorMessage(resp.error?.description || 'Razorpay payment was declined.');
        setIsProcessing(false);
      });
      rzpInstance.open();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Razorpay checkout.');
      setIsProcessing(false);
    }
  };

  const handleSandboxPayment = async () => {
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

  const handleProcessPayment = () => {
    if (gateway === 'RAZORPAY') {
      handleRazorpayPayment();
    } else {
      handleSandboxPayment();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[95vh] overflow-y-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Express Checkout</h3>
            <p className="text-xs text-slate-500">Secure Instant Ticket Confirmation</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Booking Summary Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-extrabold text-slate-900 text-base">{show.movie?.title || 'Selected Movie'}</h4>
              <p className="text-xs text-slate-500">{show.screen?.theater?.name}</p>
              <p className="text-xs text-rose-600 font-semibold mt-0.5">
                {new Date(show.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                • {new Date(show.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({show.format})
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200">
              {holdData.holds.length} Tickets
            </span>
          </div>

          <div className="text-xs text-slate-600 flex items-center justify-between pt-2.5 border-t border-slate-200">
            <span>Seats:</span>
            <span className="font-black text-slate-900">
              {holdData.holds.map((h) => `${h.row}${h.number}`).join(', ')}
            </span>
          </div>
        </div>

        {/* Coupon Discount */}
        <div className="mb-5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5 text-amber-500" />
            Promotions & Coupons
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. WELCOME50 or FLAT100"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl px-3 py-2.5 text-base sm:text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
            />
            <button
              onClick={handleApplyPromo}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 transition-colors"
            >
              Apply
            </button>
          </div>
          {appliedPromo && (
            <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1 font-bold">
              <CheckCircle className="w-3.5 h-3.5" />
              Applied: {appliedPromo} (-₹{discountAmount})
            </p>
          )}
        </div>

        {/* Payment Gateway Mode Selector */}
        <div className="mb-5">
          <label className="text-xs font-bold text-slate-700 mb-2 block">Payment Method / Gateway</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setGateway('RAZORPAY')}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                gateway === 'RAZORPAY'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border-transparent'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Razorpay Standard</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold uppercase ${gateway === 'RAZORPAY' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>Live</span>
            </button>
            <button
              onClick={() => setGateway('SANDBOX')}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                gateway === 'SANDBOX'
                  ? 'bg-slate-900 text-white shadow-md border-transparent'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Instant Sandbox</span>
            </button>
          </div>

          {gateway === 'RAZORPAY' ? (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/60 to-indigo-50/60 border border-blue-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  UPI, Cards, NetBanking & Wallets
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Razorpay Test Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Clicking pay will open the secure <strong>Razorpay Standard Checkout</strong> popup. You can use standard Razorpay test UPI IDs, QR codes, or test card numbers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'UPI'
                      ? 'bg-rose-50 border-rose-500 text-rose-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  UPI / QR
                </button>
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'CARD'
                      ? 'bg-rose-50 border-rose-500 text-rose-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Card
                </button>
                <button
                  onClick={() => setPaymentMethod('NET_BANKING')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    paymentMethod === 'NET_BANKING'
                      ? 'bg-rose-50 border-rose-500 text-rose-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  Net Banking
                </button>
              </div>

              {/* Test Mode Failure Simulation Toggle */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="pr-2">
                  <p className="text-xs font-bold text-slate-800">Simulate Bank Decline</p>
                  <p className="text-[10px] text-slate-500">Test backend payment failure & refund rollbacks</p>
                </div>
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Price Breakdown */}
        <div className="border-t border-slate-100 pt-3.5 space-y-2 text-xs text-slate-600 mb-5">
          <div className="flex justify-between">
            <span>Ticket Subtotal</span>
            <span className="font-semibold text-slate-800">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Convenience Fee</span>
            <span className="font-semibold text-slate-800">₹{convenienceFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST (18%)</span>
            <span className="font-semibold text-slate-800">₹{taxAmount.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Coupon Discount</span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2.5 border-t border-slate-200 text-sm font-black text-slate-900">
            <span>Amount Payable</span>
            <span className="text-rose-600">₹{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Pay Button */}
        <button
          disabled={isProcessing}
          onClick={handleProcessPayment}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white shadow-md transition-all disabled:opacity-50 ${
            gateway === 'RAZORPAY'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200'
              : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
          }`}
        >
          {isProcessing ? (
            <span>Processing Gateway Checkout...</span>
          ) : (
            <>
              <span>
                {gateway === 'RAZORPAY' ? `Pay ₹${totalAmount.toFixed(2)} via Razorpay` : `Authorize & Pay ₹${totalAmount.toFixed(2)}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {gateway === 'RAZORPAY' ? 'Secured by Razorpay • 256-Bit SSL Encryption' : '256-Bit Encrypted Sandbox Payment Gateway'}
          </span>
        </div>
      </div>
    </div>
  );
};

