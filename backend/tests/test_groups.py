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


@pytest.mark.asyncio
async def test_movie_suggestions_with_descriptions(client: AsyncClient, seed_test_data):
    # 1. Create group session
    create_res = await client.post(
        "/api/v1/groups/sessions",
        json={"name": "Cinema Lovers", "host_name": "Rohan"},
    )
    assert create_res.status_code == 201
    invite_code = create_res.json()["invite_code"]

    # 2. Add movie suggestion with description
    sug_res = await client.post(
        f"/api/v1/groups/sessions/{invite_code}/movie-suggestions",
        json={
            "movie_title": "Dune: Part Two",
            "suggested_by": "Rohan",
            "description": "Must watch in IMAX! The soundtrack and visual effects are unbelievable.",
            "movie_poster": "https://example.com/dune.jpg",
        },
    )
    assert sug_res.status_code == 200
    sug_data = sug_res.json()
    assert len(sug_data["movie_suggestions"]) == 1
    item = sug_data["movie_suggestions"][0]
    assert item["movie_title"] == "Dune: Part Two"
    assert item["suggested_by"] == "Rohan"
    assert item["description"] == "Must watch in IMAX! The soundtrack and visual effects are unbelievable."
    sug_id = item["id"]

    # 3. Toggle like
    like_res = await client.post(
        f"/api/v1/groups/sessions/{invite_code}/movie-suggestions/{sug_id}/like",
        json={"member_name": "Kavita"},
    )
    assert like_res.status_code == 200
    assert "Kavita" in like_res.json()["movie_suggestions"][0]["likes"]

    # 4. Delete suggestion
    del_res = await client.delete(
        f"/api/v1/groups/sessions/{invite_code}/movie-suggestions/{sug_id}",
    )
    assert del_res.status_code == 200
    assert len(del_res.json()["movie_suggestions"]) == 0
