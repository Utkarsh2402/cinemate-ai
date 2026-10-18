from typing import Optional
from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    booking_id: str
    payment_method: str = "CARD"  # CARD, UPI, NET_BANKING
    simulate_failure: bool = False  # Allows testing payment decline/failure flows


class CheckoutResponse(BaseModel):
    payment_id: str
    booking_id: str
    amount: float
    currency: str
    status: str
    client_secret: str
    redirect_url: Optional[str] = None


class WebhookPayload(BaseModel):
    event_type: str  # payment.succeeded, payment.failed
    payment_id: str
    booking_id: str
    transaction_id: str
    amount: float
    failure_reason: Optional[str] = None


class RefundResponse(BaseModel):
    refund_id: str
    payment_id: str
    amount: float
    status: str
    reason: Optional[str] = None


class RazorpayOrderRequest(BaseModel):
    booking_id: str


class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: int  # in paise
    currency: str
    key_id: str
    booking_id: str
    payment_id: str


class RazorpayVerifyRequest(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

