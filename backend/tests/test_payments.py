import json
import pytest
from httpx import AsyncClient
from app.common.security import generate_webhook_signature
from app.config import settings


@pytest.mark.asyncio
async def test_checkout_and_webhook_confirmation(client: AsyncClient, seed_test_data, auth_headers):
    show = seed_test_data["show"]
    seat = seed_test_data["seats"][4]

    # 1. Hold
    h_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": show.id, "seat_ids": [seat.id]},
        headers=auth_headers,
    )
    hold_token = h_res.json()["hold_token"]

    # 2. Book
    b_res = await client.post(
        "/api/v1/bookings",
        json={"show_id": show.id, "hold_token": hold_token},
        headers=auth_headers,
    )
    booking_id = b_res.json()["id"]

    # 3. Checkout
    checkout_res = await client.post(
        "/api/v1/payments/checkout",
        json={"booking_id": booking_id, "payment_method": "UPI"},
        headers=auth_headers,
    )
    assert checkout_res.status_code == 200
    payment_data = checkout_res.json()
    payment_id = payment_data["payment_id"]
    assert payment_data["status"] == "PENDING"

    # 4. Webhook with invalid signature -> 401
    webhook_payload = {
        "event_type": "payment.succeeded",
        "payment_id": payment_id,
        "booking_id": booking_id,
        "transaction_id": "txn_test_valid_123",
        "amount": payment_data["amount"],
    }
    raw_bytes = json.dumps(webhook_payload).encode("utf-8")

    bad_wh = await client.post(
        "/api/v1/payments/webhook",
        content=raw_bytes,
        headers={"Content-Type": "application/json", "X-Signature": "invalid_sig"},
    )
    assert bad_wh.status_code == 401

    # 5. Webhook with authentic HMAC signature -> 200
    valid_sig = generate_webhook_signature(raw_bytes, settings.PAYMENT_WEBHOOK_SECRET)
    good_wh = await client.post(
        "/api/v1/payments/webhook",
        content=raw_bytes,
        headers={"Content-Type": "application/json", "X-Signature": valid_sig},
    )
    assert good_wh.status_code == 200
    assert good_wh.json()["status"] == "confirmed"

    # 6. Verify booking is now CONFIRMED and has a digital ticket
    booking_check = await client.get(f"/api/v1/bookings/{booking_id}", headers=auth_headers)
    assert booking_check.status_code == 200
    assert booking_check.json()["status"] == "CONFIRMED"
    assert booking_check.json()["ticket_number"] is not None


@pytest.mark.asyncio
async def test_simulated_payment_failure(client: AsyncClient, seed_test_data, auth_headers):
    show = seed_test_data["show"]
    seat = seed_test_data["seats"][5]

    h_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": show.id, "seat_ids": [seat.id]},
        headers=auth_headers,
    )
    hold_token = h_res.json()["hold_token"]

    b_res = await client.post(
        "/api/v1/bookings",
        json={"show_id": show.id, "hold_token": hold_token},
        headers=auth_headers,
    )
    booking_id = b_res.json()["id"]

    # Request failure simulation -> 402 Payment Required
    checkout_res = await client.post(
        "/api/v1/payments/checkout",
        json={"booking_id": booking_id, "payment_method": "CARD", "simulate_failure": True},
        headers=auth_headers,
    )
    assert checkout_res.status_code == 402
    assert checkout_res.json()["error"]["code"] == "PAYMENT_FAILED"
