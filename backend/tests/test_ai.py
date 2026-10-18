import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_natural_language_movie_discovery(client: AsyncClient, seed_test_data):
    # Prompt: "Find an English Sci-Fi movie under 500 in Delhi"
    query_payload = {
        "query": "Find an English Sci-Fi movie under 500 in Delhi",
        "city": "Delhi",
    }
    res = await client.post("/api/v1/ai/discover", json=query_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["extracted_filters"]["genre"] == "Sci-fi" or data["extracted_filters"]["genre"] == "Sci-Fi"
    assert data["extracted_filters"]["language"] == "English"
    assert data["extracted_filters"]["max_price"] == 500.0
    assert len(data["movies"]) >= 1
    assert data["movies"][0]["title"] == "Dune: Part Two"


@pytest.mark.asyncio
async def test_group_movie_planner_scoring(client: AsyncClient, seed_test_data):
    planner_payload = {
        "group_name": "Weekend Movie Squad",
        "city": "Delhi",
        "members": [
            {
                "name": "Amit",
                "preferred_genres": ["Sci-Fi", "Action"],
                "preferred_languages": ["English"],
                "max_budget": 500.0,
            },
            {
                "name": "Priya",
                "preferred_genres": ["Action", "Adventure"],
                "preferred_languages": ["English", "Hindi"],
                "max_budget": 450.0,
            },
            {
                "name": "Karan",
                "preferred_genres": ["Sci-Fi", "Thriller"],
                "preferred_languages": ["English"],
                "max_budget": 600.0,
            },
        ],
    }
    res = await client.post("/api/v1/ai/group-planner", json=planner_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["group_name"] == "Weekend Movie Squad"
    assert len(data["recommendations"]) >= 1
    top_rec = data["recommendations"][0]
    assert top_rec["title"] == "Dune: Part Two"
    assert top_rec["compatibility_score"] >= 80.0
    assert len(top_rec["consensus_reasons"]) > 0


@pytest.mark.asyncio
async def test_ai_conversational_chat(client: AsyncClient, seed_test_data):
    chat_payload = {
        "message": "What showtimes do you have for movies in Delhi?",
        "city": "Delhi",
    }
    res = await client.post("/api/v1/ai/chat", json=chat_payload)
    assert res.status_code == 200
    data = res.json()
    assert "get_showtimes" in data["tools_called"]
    assert "Dune: Part Two" in data["reply"]
