import asyncio
import pytest
from httpx import AsyncClient
from app.common.security import create_access_token
from app.models.user import User


@pytest.mark.asyncio
async def test_concurrent_seat_holds(client: AsyncClient, seed_test_data, db_session):
    """
    CRITICAL CONCURRENCY TEST:
    Simulates competing concurrent users trying to hold the exact same seat at the same time.
    Verifies that dual-layer concurrency control guarantees at most ONE user succeeds,
    while all competing requests receive 409 Conflict.
    """
    show = seed_test_data["show"]
    target_seat = seed_test_data["seats"][0]

    # Create 5 distinct concurrent test users with tokens
    users = []
    tokens = []
    for i in range(5):
        u = User(
            email=f"concurrent_user_{i}@example.com",
            hashed_password="hash",
            full_name=f"User {i}",
            role="customer",
            is_active=True,
        )
        db_session.add(u)
        users.append(u)
    await db_session.commit()

    for u in users:
        tokens.append(create_access_token(subject=u.id, role="customer"))

    payload = {"show_id": show.id, "seat_ids": [target_seat.id]}

    # Send competing requests simultaneously via asyncio.gather
    async def attempt_hold(token):
        return await client.post(
            "/api/v1/seat-holds",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

    responses = await asyncio.gather(*(attempt_hold(t) for t in tokens))

    successes = [r for r in responses if r.status_code == 201]
    conflicts = [r for r in responses if r.status_code == 409]

    # EXACTLY ONE should succeed!
    assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
    assert len(conflicts) == 4, f"Expected 4 conflicts, got {len(conflicts)}"

    # Check error details on conflicts
    for r in conflicts:
        err = r.json()["error"]
        assert err["code"] == "SEATS_ALREADY_RESERVED"
        assert target_seat.id in err["details"]["conflicted_seats"]


@pytest.mark.asyncio
async def test_hold_release_and_rebooking(client: AsyncClient, seed_test_data, auth_headers, db_session):
    """
    Tests that when a user releases their temporary seat hold,
    another user can immediately reserve the seat.
    """
    show = seed_test_data["show"]
    seat = seed_test_data["seats"][1]

    # User 1 holds seat
    hold_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": show.id, "seat_ids": [seat.id]},
        headers=auth_headers,
    )
    assert hold_res.status_code == 201
    hold_token = hold_res.json()["hold_token"]

    # User 2 tries to hold seat -> 409 Conflict
    other_user = User(email="other@cinemate.ai", hashed_password="h", full_name="Other", is_active=True)
    db_session.add(other_user)
    await db_session.commit()
    other_token = create_access_token(subject=other_user.id)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    conflict_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": show.id, "seat_ids": [seat.id]},
        headers=other_headers,
    )
    assert conflict_res.status_code == 409

    # User 1 releases hold
    del_res = await client.delete(f"/api/v1/seat-holds/{hold_token}", headers=auth_headers)
    assert del_res.status_code == 200

    # User 2 tries again -> now succeeds (201)
    rebook_res = await client.post(
        "/api/v1/seat-holds",
        json={"show_id": show.id, "seat_ids": [seat.id]},
        headers=other_headers,
    )
    assert rebook_res.status_code == 201
