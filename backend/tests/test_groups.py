import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_group_session_4_digit_numeric(client: AsyncClient, seed_test_data):
    # 1. Create a group session
    res = await client.post(
        "/api/v1/groups/sessions",
        json={"name": "Friday Squad Night", "host_name": "Utkarsh"},
    )
    assert res.status_code == 201
    data = res.json()

    invite_code = data["invite_code"]
    # Check that invite_code is exactly 4 digits numeric
    assert len(invite_code) == 4
    assert invite_code.isdigit()
    assert int(invite_code) >= 1000 and int(invite_code) <= 9999
    assert data["name"] == "Friday Squad Night"
    assert len(data["members"]) == 1
    assert data["members"][0]["name"] == "Utkarsh"

    # 2. Retrieve session using 4-digit code
    get_res = await client.get(f"/api/v1/groups/sessions/{invite_code}")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["invite_code"] == invite_code
    assert get_data["name"] == "Friday Squad Night"

    # 3. Join session using 4-digit code
    join_res = await client.post(
        f"/api/v1/groups/sessions/{invite_code}/join",
        json={
            "name": "Kavita",
            "preferred_genres": ["Action", "Sci-Fi"],
            "preferred_languages": ["Hindi"],
            "max_budget": 400.0,
        },
    )
    assert join_res.status_code == 200
    join_data = join_res.json()
    assert len(join_data["members"]) == 2
    names = [m["name"] for m in join_data["members"]]
    assert "Utkarsh" in names
    assert "Kavita" in names

    # 4. Decide session
    decide_res = await client.post(f"/api/v1/groups/sessions/{invite_code}/decide")
    assert decide_res.status_code == 200
    decide_data = decide_res.json()
    assert decide_data["status"] == "DECIDED"
    assert decide_data["consensus_result"] is not None
