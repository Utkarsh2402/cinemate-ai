import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_booking_price_calculation_and_idempotency(client: AsyncClient, seed_test_data, auth_headers):
    show = seed_test_data["show"]
    seat = seed_test_data["seats"][2]  # STANDARD seat (300.0)

    # 1. Hold seat
    hold_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": show.id, "seat_ids": [seat.id]},
        headers=auth_headers,
    )
    assert hold_res.status_code == 201
    hold_token = hold_res.json()["hold_token"]

    # 2. Create booking with Idempotency-Key
    headers = {**auth_headers, "Idempotency-Key": "test_idem_key_001"}
    booking_res = await client.post(
        "/api/v1/bookings",
        json={"show_id": show.id, "hold_token": hold_token},
        headers=headers,
    )
    assert booking_res.status_code == 201
    booking_data = booking_res.json()

    assert booking_data["status"] == "PENDING"
    assert booking_data["subtotal"] == 300.0
    # Convenience fee: 30 + 10 = 40.0
    assert booking_data["convenience_fee"] == 40.0
    # Tax: 18% of 40 = 7.2
    assert booking_data["tax_amount"] == 7.2
    # Total: 300 + 40 + 7.2 = 347.2
    assert booking_data["total_amount"] == 347.2

    # 3. Resubmit with same idempotency key -> returns identical booking without duplicate
    dup_res = await client.post(
        "/api/v1/bookings",
        json={"show_id": show.id, "hold_token": hold_token},
        headers=headers,
    )
    assert dup_res.status_code == 201
    assert dup_res.json()["id"] == booking_data["id"]
    assert dup_res.json()["booking_code"] == booking_data["booking_code"]


@pytest.mark.asyncio
async def test_cancel_booking_workflow(client: AsyncClient, seed_test_data, auth_headers, db_session):
    show = seed_test_data["show"]
    seat = seed_test_data["seats"][3]

    # Hold & Book
    hold_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": show.id, "seat_ids": [seat.id]},
        headers=auth_headers,
    )
    hold_token = hold_res.json()["hold_token"]

    b_res = await client.post(
        "/api/v1/bookings",
        json={"show_id": show.id, "hold_token": hold_token},
        headers=auth_headers,
    )
    booking_id = b_res.json()["id"]

    # Confirm booking via BookingService
    from app.services.booking_service import BookingService
    await BookingService.confirm_booking(db_session, booking_id, "mock_payment_id")

    # Cancel booking
    cancel_res = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Schedule changed"},
        headers=auth_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
    assert cancel_res.json()["refund_amount"] > 0

    # Attempt second cancellation -> 400 InvalidStateTransitionException
    bad_cancel = await client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Repeat"},
        headers=auth_headers,
    )
    assert bad_cancel.status_code == 400
    assert bad_cancel.json()["error"]["code"] == "INVALID_STATE_TRANSITION"
