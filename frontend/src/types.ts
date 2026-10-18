export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'customer' | 'admin';
  is_active: boolean;
  preferences?: Record<string, any>;
}

export interface Movie {
  id: string;
  title: string;
  original_title?: string;
  synopsis: string;
  release_date: string;
  duration_minutes: number;
  poster_url: string;
  backdrop_url?: string;
  trailer_url?: string;
  rating: number;
  vote_count: number;
  certification: string;
  language: string;
  genres: string[];
  is_active: boolean;
}

export interface Theater {
  id: string;
  name: string;
  chain?: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  amenities: string[];
  screens?: Screen[];
}

export interface Screen {
  id: string;
  theater_id: string;
  name: string;
  screen_type: string;
  rows_count: number;
  cols_count: number;
  total_seats: number;
}

export interface ShowPricing {
  seat_type: string;
  price: number;
}

export interface Show {
  id: string;
  movie_id: string;
  screen_id: string;
  start_time: string;
  end_time: string;
  language: string;
  format: string;
  status: string;
  movie?: Movie;
  screen?: Screen & { theater?: Theater };
  pricing: ShowPricing[];
}

export interface SeatItem {
  seat_id: string;
  row: string;
  number: number;
  column_index: number;
  seat_type: string;
  price: number;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED' | 'HELD_BY_ME';
  hold_expires_at?: string;
}

export interface ShowSeatAvailability {
  show_id: string;
  movie_id: string;
  movie_title: string;
  theater_name: string;
  screen_name: string;
  screen_type: string;
  start_time: string;
  end_time: string;
  language: string;
  format: string;
  rows_count: number;
  cols_count: number;
  pricing: Record<string, number>;
  seats: SeatItem[];
  total_available: number;
  total_held: number;
  total_booked: number;
}

export interface SeatHoldResponse {
  show_id: string;
  hold_token: string;
  holds: {
    hold_id: string;
    seat_id: string;
    row: string;
    number: number;
    seat_type: string;
    price: number;
    expires_at: string;
  }[];
  expires_at: string;
  remaining_seconds: number;
  subtotal: number;
  message: string;
  telemetry?: {
    layer1_redis_lock: string;
    layer2_acid_isolation: string;
    atomic_rollback_supported: boolean;
    lock_ttl_seconds: number;
    idempotency_key?: string;
  };
}

export interface BookingSeat {
  id: string;
  seat_id: string;
  row: string;
  number: number;
  seat_type: string;
  price: number;
}

export interface BookingDetail {
  id: string;
  booking_code: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'PAYMENT_FAILED';
  show_id: string;
  subtotal: number;
  tax_amount: number;
  convenience_fee: number;
  discount_amount: number;
  total_amount: number;
  promotion_code?: string;
  created_at: string;
  cancelled_at?: string;
  movie_title: string;
  poster_url: string;
  theater_name: string;
  theater_address: string;
  screen_name: string;
  screen_type: string;
  start_time: string;
  end_time: string;
  language: string;
  format: string;
  seats: BookingSeat[];
  ticket_number?: string;
  qr_code_data?: string;
  payment_status?: string;
  is_cancellable: boolean;
}

export interface TicketDetail {
  id: string;
  booking_id: string;
  booking_code: string;
  ticket_number: string;
  qr_code_data: string;
  qr_code_image_base64?: string;
  verification_hash: string;
  status: string;
  movie_title: string;
  theater_name: string;
  screen_name: string;
  start_time: string;
  seats: string[];
  total_amount: number;
  created_at: string;
}

export interface GroupMovieRecommendation {
  movie_id: string;
  title: string;
  genres: string[];
  language: string;
  duration_minutes: number;
  poster_url: string;
  rating: number;
  compatibility_score: number;
  price_fit: string;
  consensus_reasons: string[];
  min_show_price?: number;
}

export interface GroupPlannerResult {
  group_name: string;
  recommendations: GroupMovieRecommendation[];
  insights: string;
  compromise_notes: string;
}

export interface AdminAnalytics {
  total_revenue: number;
  total_bookings: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  total_movies: number;
  total_theaters: number;
  total_shows: number;
  average_occupancy_rate: number;
  recent_occupancies: {
    show_id: string;
    movie_title: string;
    theater_name: string;
    screen_name: string;
    start_time: string;
    total_seats: number;
    booked_seats: number;
    held_seats: number;
    occupancy_rate: number;
    total_revenue: number;
  }[];
  revenue_by_genre: Record<string, number>;
}

export interface InternetMovieSuggestion {
  title: string;
  year?: number;
  genres: string[];
  language?: string;
  rating: number;
  duration?: string;
  director?: string;
  synopsis: string;
  where_to_watch: string;
  streaming_platform: string;
  poster_url?: string;
  matched_local_movie_id?: string;
}

export interface MovieDiscoveryResult {
  query: string;
  explanation: string;
  extracted_filters: {
    genre?: string;
    language?: string;
    city?: string;
    max_price?: number;
    max_duration_minutes?: number;
    time_of_day?: string;
    target_date?: string;
  };
  movies: Movie[];
  internet_suggestions: InternetMovieSuggestion[];
  matched_show_count: number;
}
