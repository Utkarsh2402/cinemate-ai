from typing import Optional, List, Dict, Any
from datetime import date
from pydantic import BaseModel, Field
from app.schemas.movie import MovieResponse


class ExtractedFilters(BaseModel):
    genre: Optional[str] = None
    language: Optional[str] = None
    city: Optional[str] = None
    max_price: Optional[float] = None
    max_duration_minutes: Optional[int] = None
    time_of_day: Optional[str] = None  # morning, afternoon, evening, night
    target_date: Optional[date] = None


class MovieDiscoveryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Natural language search query")
    city: Optional[str] = "Delhi"


class InternetMovieSuggestion(BaseModel):
    title: str
    year: Optional[int] = 2024
    genres: List[str] = []
    language: Optional[str] = "Hindi"
    rating: float = 8.0
    duration: Optional[str] = "135m"
    director: Optional[str] = None
    synopsis: str
    where_to_watch: str = "Netflix / Prime Video / Theaters"
    streaming_platform: str = "Netflix"
    poster_url: Optional[str] = None
    matched_local_movie_id: Optional[str] = None


class MovieDiscoveryResponse(BaseModel):
    query: str
    extracted_filters: ExtractedFilters
    movies: List[MovieResponse]
    internet_suggestions: List[InternetMovieSuggestion] = []
    matched_show_count: int
    explanation: str


class GroupMemberPreferenceInput(BaseModel):
    name: str
    preferred_genres: List[str]
    preferred_languages: List[str]
    max_budget: float = 400.0


class GroupPlannerRequest(BaseModel):
    group_name: str
    city: Optional[str] = "Delhi"
    members: List[GroupMemberPreferenceInput] = Field(..., min_length=2)


class GroupMovieRecommendation(BaseModel):
    movie_id: str
    title: str
    genres: List[str]
    language: str
    duration_minutes: int
    poster_url: str
    rating: float
    compatibility_score: float  # 0 to 100%
    price_fit: str
    consensus_reasons: List[str]
    min_show_price: Optional[float] = None


class GroupPlannerResponse(BaseModel):
    group_name: str
    recommendations: List[GroupMovieRecommendation]
    insights: str
    compromise_notes: str


class ChatMessage(BaseModel):
    role: str = "user"  # user, assistant, system, model
    content: Optional[str] = None
    parts: Optional[Any] = None

    def get_text(self) -> str:
        if self.content:
            return self.content
        if isinstance(self.parts, list) and len(self.parts) > 0:
            item = self.parts[0]
            if isinstance(item, dict) and "text" in item:
                return item["text"]
            return str(item)
        return ""


class AIChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    city: Optional[str] = "Delhi"


class AIChatResponse(BaseModel):
    reply: str
    tools_called: List[str] = []
    structured_data: Optional[Dict[str, Any]] = None
