import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient):
    # 1. Register new user
    reg_payload = {
        "email": "newuser@example.com",
        "password": "Password123",
        "full_name": "New User",
        "phone": "+919876500000",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["email"] == "newuser@example.com"
    assert user_data["full_name"] == "New User"

    # 2. Duplicate registration check (409)
    dup_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 409
    assert dup_res.json()["error"]["code"] == "USER_ALREADY_EXISTS"

    # 3. Login with wrong password (401)
    bad_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "newuser@example.com", "password": "WrongPassword"},
    )
    assert bad_login.status_code == 401

    # 4. Successful login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "newuser@example.com", "password": "Password123"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data

    # 5. Get current profile with Bearer token
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "newuser@example.com"

    # 6. Refresh token
    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_data["refresh_token"]},
    )
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()
