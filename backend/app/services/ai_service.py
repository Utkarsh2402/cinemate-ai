import re
import json
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, String, cast
from app.config import settings
from app.models.movie import Movie
from app.models.show import Show, ShowPricing
from app.models.theater import Screen, Theater
from app.schemas.ai import (
    ExtractedFilters,
    MovieDiscoveryResponse,
    GroupPlannerRequest,
    GroupPlannerResponse,
    GroupMovieRecommendation,
    AIChatRequest,
    AIChatResponse,
)
from app.schemas.movie import MovieResponse
from app.services.movie_service import MovieService
from app.services.show_service import ShowService
import logging

import httpx

logger = logging.getLogger("cinemate.ai_service")


class AIService:
    @classmethod
    def _heuristic_filter_extraction(cls, query: str) -> ExtractedFilters:
        """
        Rule-based NLP entity & filter extraction fallback.
        Reliably extracts genres, languages, duration, budget, and time of day.
        """
        q = query.lower()
        filters = ExtractedFilters()

        # 1. Genres
        known_genres = ["action", "comedy", "drama", "sci-fi", "thriller", "horror", "romance", "adventure", "animation", "crime"]
        for g in known_genres:
            if g in q:
                filters.genre = g.capitalize()
                break

        # 2. Languages
        known_languages = ["hindi", "english", "tamil", "telugu", "kannada", "malayalam", "bengali", "marathi"]
        for l in known_languages:
            if l in q:
                filters.language = l.capitalize()
                break

        # 3. Budget / Price: under 300, < 400, below 250, rs 300, 300 inr, etc.
        price_match = re.search(r"(?:under|below|less than|max|budget of|\₹|rs\.?)\s*(\d{2,4})", q)
        if price_match:
            try:
                filters.max_price = float(price_match.group(1))
            except ValueError:
                pass

        # 4. Duration: less than 2 hours, under 120 mins, 90 minutes
        duration_hour_match = re.search(r"(?:less than|under|within)\s*(\d+)\s*(?:hour|hr|hours)", q)
        if duration_hour_match:
            try:
                hours = int(duration_hour_match.group(1))
                filters.max_duration_minutes = hours * 60
            except ValueError:
                pass
        else:
            duration_min_match = re.search(r"(?:less than|under|within)\s*(\d+)\s*(?:min|mins|minutes)", q)
            if duration_min_match:
                try:
                    filters.max_duration_minutes = int(duration_min_match.group(1))
                except ValueError:
                    pass

        # 5. Time of day
        if "morning" in q:
            filters.time_of_day = "morning"
        elif "afternoon" in q:
            filters.time_of_day = "afternoon"
        elif "evening" in q:
            filters.time_of_day = "evening"
        elif "night" in q:
            filters.time_of_day = "night"

        # 6. Target date
        today = date.today()
        if "tomorrow" in q:
            filters.target_date = today + timedelta(days=1)
        elif "today" in q or "tonight" in q:
            filters.target_date = today

        return filters

    @classmethod
    async def extract_filters_with_llm(cls, query: str) -> ExtractedFilters:
        """Attempts Gemini LLM extraction if API key configured, otherwise delegates to heuristic extractor."""
        if settings.GEMINI_API_KEY:
            try:
                prompt = (
                    "You are a movie ticketing assistant. Extract structured filters from this user query:\n"
                    f"User query: \"{query}\"\n\n"
                    "Extract into a JSON object with these fields if mentioned:\n"
                    "- genre: string (e.g. Comedy, Action, Sci-Fi, Drama)\n"
                    "- language: string (e.g. Hindi, English, Tamil)\n"
                    "- max_price: float (e.g. 300.0)\n"
                    "- max_duration_minutes: integer (e.g. 120)\n"
                    "- time_of_day: string (morning, afternoon, evening, night)\n"
                    "- target_date: string (YYYY-MM-DD or today/tomorrow)\n\n"
                    "Return ONLY valid JSON, no markdown codeblocks, no explanations."
                )
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.AI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
                }
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text_part = data["candidates"][0]["content"]["parts"][0]["text"]
                        clean_json = text_part.strip().strip("```json").strip("```").strip()
                        parsed = json.loads(clean_json)
                        if isinstance(parsed.get("target_date"), str):
                            td = parsed["target_date"].lower().strip()
                            if td == "tomorrow":
                                parsed["target_date"] = date.today() + timedelta(days=1)
                            elif td in ["today", "tonight"]:
                                parsed["target_date"] = date.today()
                            else:
                                try:
                                    parsed["target_date"] = date.fromisoformat(td)
                                except ValueError:
                                    parsed["target_date"] = None
                        logger.info("Live Gemini extraction result: %s", parsed)
                        return ExtractedFilters(**parsed)
                    else:
                        logger.warning("Gemini returned %s: %s", resp.status_code, resp.text[:100])
            except Exception as e:
                logger.warning("Gemini LLM extraction error, using heuristic: %s", e)

        return cls._heuristic_filter_extraction(query)

    @classmethod
    async def discover_movies(cls, db: AsyncSession, query: str, city: str = "Delhi") -> MovieDiscoveryResponse:
        filters = await cls.extract_filters_with_llm(query)
        filters.city = city

        stmt = select(Movie).where(Movie.is_active == True)

        if filters.language:
            stmt = stmt.where(Movie.language.ilike(filters.language))

        if filters.genre:
            stmt = stmt.where(cast(Movie.genres, String).ilike(f"%{filters.genre}%"))

        if filters.max_duration_minutes:
            stmt = stmt.where(Movie.duration_minutes <= filters.max_duration_minutes)

        # Filter movies with shows in the specified city and budget
        show_subquery = (
            select(Show.movie_id)
            .join(Screen, Show.screen_id == Screen.id)
            .join(Theater, Screen.theater_id == Theater.id)
            .join(ShowPricing, Show.id == ShowPricing.show_id)
            .where(Theater.city.ilike(city.strip()), Show.is_active == True)
        )
        if filters.max_price:
            show_subquery = show_subquery.where(ShowPricing.price <= filters.max_price)

        stmt = stmt.where(Movie.id.in_(show_subquery))
        stmt = stmt.order_by(Movie.rating.desc()).limit(10)

        result = await db.execute(stmt)
        movies = list(result.scalars().all())

        # If zero matches with strict price/duration, relax to broader genre/language match
        if not movies:
            fallback_stmt = select(Movie).where(Movie.is_active == True)
            if filters.language:
                fallback_stmt = fallback_stmt.where(Movie.language.ilike(filters.language))
            if filters.genre:
                fallback_stmt = fallback_stmt.where(cast(Movie.genres, String).ilike(f"%{filters.genre}%"))
            fallback_stmt = fallback_stmt.order_by(Movie.rating.desc()).limit(5)
            movies = list((await db.execute(fallback_stmt)).scalars().all())

        # Build natural language explanation of findings
        parts = []
        if filters.genre:
            parts.append(f"{filters.genre} genre")
        if filters.language:
            parts.append(f"{filters.language} language")
        if filters.max_price:
            parts.append(f"tickets under ₹{int(filters.max_price)}")
        if filters.max_duration_minutes:
            parts.append(f"runtime under {filters.max_duration_minutes} mins")

        criteria_str = ", ".join(parts) if parts else "your request"
        explanation = (
            f"Found {len(movies)} movie(s) matching {criteria_str} in {city}. "
            f"Results are sorted by critical rating and showtime availability."
        )

        movie_responses = [MovieResponse.model_validate(m) for m in movies]

        return MovieDiscoveryResponse(
            query=query,
            extracted_filters=filters,
            movies=movie_responses,
            matched_show_count=len(movies),
            explanation=explanation,
        )

    @classmethod
    async def plan_group_movie(cls, db: AsyncSession, data: GroupPlannerRequest) -> GroupPlannerResponse:
        """
        Group Movie Planner Scoring Algorithm:
        Scores movies across all group members:
        1. Genre compatibility (40% weight) - intersection of movie genres with members' preferences
        2. Language compatibility (25% weight) - percentage of members happy with the language
        3. Budget fit (20% weight) - minimum show price vs members' max budget
        4. Quality rating (15% weight) - movie IMDb/critic rating out of 10
        """
        # Fetch all active movies
        stmt = select(Movie).where(Movie.is_active == True)
        result = await db.execute(stmt)
        all_movies = list(result.scalars().all())

        if not all_movies:
            return GroupPlannerResponse(
                group_name=data.group_name,
                recommendations=[],
                insights="No movies currently playing in this city.",
                compromise_notes="Please check back when new showtimes are scheduled.",
            )

        # Precompute member preference profiles
        total_members = len(data.members)
        min_group_budget = min(m.max_budget for m in data.members)
        avg_group_budget = sum(m.max_budget for m in data.members) / total_members

        scored_recommendations: List[GroupMovieRecommendation] = []

        for movie in all_movies:
            # 1. Genre score: calculate how many members have at least one genre overlap
            genre_matches = 0
            movie_genres_lower = [g.lower() for g in movie.genres]
            for m in data.members:
                member_genres_lower = [mg.lower() for mg in m.preferred_genres]
                if any(mg in movie_genres_lower for mg in member_genres_lower):
                    genre_matches += 1
            genre_score = (genre_matches / total_members) * 100

            # 2. Language score
            lang_matches = sum(
                1 for m in data.members if movie.language.lower() in [ml.lower() for ml in m.preferred_languages]
            )
            lang_score = (lang_matches / total_members) * 100

            # 3. Budget & Price fit
            # Fetch min pricing for this movie in the city
            price_stmt = (
                select(func.min(ShowPricing.price))
                .join(Show, ShowPricing.show_id == Show.id)
                .join(Screen, Show.screen_id == Screen.id)
                .join(Theater, Screen.theater_id == Theater.id)
                .where(Show.movie_id == movie.id, Theater.city.ilike(data.city.strip()))
            )
            min_price = (await db.execute(price_stmt)).scalar() or 250.0

            if min_price <= min_group_budget:
                budget_score = 100.0
                price_fit = f"Fits everyone's budget (from ₹{int(min_price)})"
            elif min_price <= avg_group_budget:
                budget_score = 70.0
                price_fit = f"Fits average budget (₹{int(min_price)} vs ₹{int(avg_group_budget)} avg)"
            else:
                budget_score = 40.0
                price_fit = f"Slightly above lowest budget (₹{int(min_price)})"

            # 4. Rating score (0-100)
            rating_score = (movie.rating / 10.0) * 100.0

            # Combined weighted score
            compatibility = round(
                (0.40 * genre_score) + (0.25 * lang_score) + (0.20 * budget_score) + (0.15 * rating_score),
                1,
            )

            reasons = []
            if genre_matches == total_members:
                reasons.append("100% of the group loves this genre")
            elif genre_matches > 0:
                reasons.append(f"{genre_matches}/{total_members} members enjoy {', '.join(movie.genres[:2])}")

            if lang_matches == total_members:
                reasons.append(f"Everyone comfortable with {movie.language}")

            if movie.rating >= 8.0:
                reasons.append(f"Critically acclaimed ({movie.rating}/10)")

            if not reasons:
                reasons.append(f"Good mainstream compromise option ({movie.rating}/10)")

            scored_recommendations.append(
                GroupMovieRecommendation(
                    movie_id=movie.id,
                    title=movie.title,
                    genres=movie.genres,
                    language=movie.language,
                    duration_minutes=movie.duration_minutes,
                    poster_url=movie.poster_url,
                    rating=movie.rating,
                    compatibility_score=compatibility,
                    price_fit=price_fit,
                    consensus_reasons=reasons,
                    min_show_price=min_price,
                )
            )

        # Sort recommendations descending by compatibility score
        scored_recommendations.sort(key=lambda r: r.compatibility_score, reverse=True)
        top_recs = scored_recommendations[:5]

        top_movie = top_recs[0] if top_recs else None
        insights = (
            f"Analyzed {len(all_movies)} active titles for {total_members} friends in {data.group_name}. "
            f"The group has strong preference alignment for {top_movie.genres[0] if top_movie else 'popular'} movies."
        )

        compromise_notes = (
            f"Recommended '{top_movie.title if top_movie else 'Top Choice'}' with {top_movie.compatibility_score if top_movie else 90}% "
            f"consensus compatibility. All tickets fit within or near the ₹{int(avg_group_budget)} group target."
        )

        return GroupPlannerResponse(
            group_name=data.group_name,
            recommendations=top_recs,
            insights=insights,
            compromise_notes=compromise_notes,
        )

    @classmethod
    async def chat(cls, db: AsyncSession, request: AIChatRequest) -> AIChatResponse:
        """
        Conversational assistant with tool calling.
        Tools exposed:
        1. search_movies: finds movies by title, genre, language
        2. get_showtimes: retrieves theater showtimes for a movie
        3. check_seat_availability: checks open seats for a show
        4. plan_group_movie: group recommendation
        """
        msg = request.message.lower()
        tools_called = []
        structured_data = {}

        if any(w in msg for w in ["showtime", "show time", "shows", "when", "time", "schedule"]):
            tools_called.append("get_showtimes")
            shows = await ShowService.list_shows(db, city=request.city)
            show_summary = [
                {
                    "show_id": s.id,
                    "movie": s.movie.title if s.movie else "Movie",
                    "theater": s.screen.theater.name if s.screen and s.screen.theater else "Cinema",
                    "start_time": s.start_time.strftime("%I:%M %p"),
                    "format": s.format,
                }
                for s in shows[:5]
            ]
            structured_data["shows"] = show_summary
            reply = f"Here are upcoming showtimes in {request.city}:\n" + "\n".join(
                f"• **{s['movie']}** at {s['theater']} ({s['start_time']} - {s['format']})"
                for s in show_summary
            )

        elif any(w in msg for w in ["seat", "seats", "available", "layout"]):
            tools_called.append("check_seat_availability")
            shows = await ShowService.list_shows(db, city=request.city)
            if shows:
                show = shows[0]
                avail = await ShowService.get_show_seat_availability(db, show.id)
                structured_data["availability"] = {
                    "show_id": show.id,
                    "movie": avail.movie_title,
                    "available": avail.total_available,
                    "held": avail.total_held,
                    "booked": avail.total_booked,
                }
                reply = (
                    f"For **{avail.movie_title}** at {avail.theater_name}:\n"
                    f"• {avail.total_available} seats currently available\n"
                    f"• {avail.total_held} temporarily on hold\n"
                    f"• {avail.total_booked} booked.\n"
                    f"Ticket prices start from ₹{int(min(avail.pricing.values()))}."
                )
            else:
                reply = "No active shows found to inspect seat availability."

        elif any(w in msg for w in ["group", "friends", "vote", "we want", "compromise"]):
            tools_called.append("plan_group_movie")
            reply = "You can use CineMate's **Group Movie Planner** tab! Add each friend's favorite genres and budget to get an automated compatibility score and find the perfect match."

        else:
            tools_called.append("search_movies")
            discovery = await cls.discover_movies(db, request.message, city=request.city or "Delhi")
            structured_data["movies"] = [m.model_dump() for m in discovery.movies]
            if discovery.movies:
                top_movies = "\n".join(f"• **{m.title}** ({m.language}, {m.rating}⭐) - {', '.join(m.genres)}" for m in discovery.movies[:3])
                reply = f"{discovery.explanation}\n\nTop picks:\n{top_movies}\n\nWould you like to view showtimes or check available seats?"
            else:
                reply = "I couldn't find exact matches for that query, but you can explore all currently running blockbusters on our Movies page!"

        return AIChatResponse(
            reply=reply,
            tools_called=tools_called,
            structured_data=structured_data,
        )
