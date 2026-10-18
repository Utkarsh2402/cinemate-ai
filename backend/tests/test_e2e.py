import json
import pytest
from httpx import AsyncClient
from app.common.security import generate_webhook_signature
from app.config import settings


@pytest.mark.asyncio
async def test_full_end_to_end_booking_journey(client: AsyncClient, seed_test_data):
    """
    Mandatory Full End-to-End Test:
    1. Register user & authenticate
    2. Search and browse movie catalog
    3. Choose show and view interactive seat layout
    4. Temporarily hold chosen seats (seat locking)
    5. Create booking with server-side pricing breakdown
    6. Initiate sandbox checkout
    7. Complete payment via signed webhook
    8. Receive confirmed booking with digital QR ticket
    9. Verify digital ticket at gate
    10. Inspect customer booking history
    """
    # 1. Register & Login
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "e2e_cinema_fan@example.com",
            "password": "Password9988",
            "full_name": "Aarav Patel",
            "phone": "+919999888877",
        },
    )
    assert reg_res.status_code == 201

    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "e2e_cinema_fan@example.com", "password": "Password9988"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Search movies
    movies_res = await client.get("/api/v1/movies?search=Dune", headers=headers)
    assert movies_res.status_code == 200
    movies = movies_res.json()["items"]
    assert len(movies) >= 1
    selected_movie = movies[0]

    # 3. Choose show and view seats
    shows_res = await client.get(f"/api/v1/shows?movie_id={selected_movie['id']}", headers=headers)
    assert shows_res.status_code == 200
    shows = shows_res.json()
    assert len(shows) >= 1
    selected_show = shows[0]

    seats_res = await client.get(f"/api/v1/shows/{selected_show['id']}/seats", headers=headers)
    assert seats_res.status_code == 200
    layout = seats_res.json()
    available_seats = [s for s in layout["seats"] if s["status"] == "AVAILABLE"]
    assert len(available_seats) >= 2
    seat_to_book = available_seats[0]

    # 4. Hold seats
    hold_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": selected_show["id"], "seat_ids": [seat_to_book["seat_id"]]},
        headers=headers,
    )
    assert hold_res.status_code == 201
    hold_data = hold_res.json()
    hold_token = hold_data["hold_token"]
    assert hold_data["remaining_seconds"] > 0

    # 5. Create booking from hold
    booking_res = await client.post(
        "/api/v1/bookings",
        json={"show_id": selected_show["id"], "hold_token": hold_token},
        headers=headers,
    )
    assert booking_res.status_code == 201
    booking = booking_res.json()
    booking_id = booking["id"]
    assert booking["status"] == "PENDING"
    assert booking["total_amount"] > 0

    # 6. Initiate checkout
    checkout_res = await client.post(
        "/api/v1/payments/checkout",
        json={"booking_id": booking_id, "payment_method": "UPI"},
        headers=headers,
    )
    assert checkout_res.status_code == 200
    payment_info = checkout_res.json()
    payment_id = payment_info["payment_id"]

    # 7. Webhook payment confirmation
    wh_payload = {
        "event_type": "payment.succeeded",
        "payment_id": payment_id,
        "booking_id": booking_id,
        "transaction_id": "txn_e2e_successful_pay",
        "amount": payment_info["amount"],
    }
    raw_payload = json.dumps(wh_payload).encode("utf-8")
    sig = generate_webhook_signature(raw_payload, settings.PAYMENT_WEBHOOK_SECRET)

    wh_res = await client.post(
        "/api/v1/payments/webhook",
        content=raw_payload,
        headers={"Content-Type": "application/json", "X-Signature": sig},
    )
    assert wh_res.status_code == 200
    assert wh_res.json()["status"] == "confirmed"

    # 8. Check confirmed booking & digital ticket
    booking_detail_res = await client.get(f"/api/v1/bookings/{booking_id}", headers=headers)
    assert booking_detail_res.status_code == 200
    detail = booking_detail_res.json()
    assert detail["status"] == "CONFIRMED"
    ticket_num = detail["ticket_number"]
    assert ticket_num is not None

    ticket_res = await client.get(f"/api/v1/tickets/{ticket_num}", headers=headers)
    assert ticket_res.status_code == 200
    ticket = ticket_res.json()
    assert ticket["status"] == "ACTIVE"
    assert ticket["qr_code_image_base64"].startswith("data:image/png;base64,")

    # 9. Gate verification
    verify_res = await client.post(
        "/api/v1/tickets/verify",
        json={"ticket_number": ticket_num},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["is_valid"] is True
    assert verify_res.json()["status"] == "VALID"

    # 10. Customer Booking History
    history_res = await client.get("/api/v1/bookings", headers=headers)
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) >= 1
    assert any(b["id"] == booking_id for b in history)
