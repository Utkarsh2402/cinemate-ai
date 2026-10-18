import type {
  Movie,
  Theater,
  Show,
  ShowSeatAvailability,
  SeatHoldResponse,
  BookingDetail,
  TicketDetail,
  GroupPlannerResult,
  AdminAnalytics,
} from './types';

const API_BASE = 'http://localhost:8000/api/v1';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('cinemate_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function generateIdempotencyKey(): string {
  return 'idemp_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || data.detail || 'An unexpected error occurred';
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Movies
  getMovies: (params: { search?: string; genre?: string; language?: string; city?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.genre) query.append('genre', params.genre);
    if (params.language) query.append('language', params.language);
    if (params.city) query.append('city', params.city);
    return request<{ items: Movie[]; total: number; page: number; pages: number }>(`/movies?${query.toString()}`);
  },

  getMovie: (id: string) => request<Movie>(`/movies/${id}`),

  // Theaters & Shows
  getTheaters: (city?: string) => {
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    return request<Theater[]>(`/theaters${query}`);
  },

  getShows: (params: { movie_id?: string; theater_id?: string; city?: string; target_date?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.movie_id) query.append('movie_id', params.movie_id);
    if (params.theater_id) query.append('theater_id', params.theater_id);
    if (params.city) query.append('city', params.city);
    if (params.target_date) query.append('target_date', params.target_date);
    return request<Show[]>(`/shows?${query.toString()}`);
  },

  getShowSeats: (showId: string, holdToken?: string) => {
    const query = holdToken ? `?hold_token=${encodeURIComponent(holdToken)}` : '';
    return request<ShowSeatAvailability>(`/shows/${showId}/seats${query}`);
  },

  // Seat Holds (Concurrency Control)
  holdSeats: (showId: string, seatIds: string[]) => {
    return request<SeatHoldResponse>('/seat-holds', {
      method: 'POST',
      body: JSON.stringify({ show_id: showId, seat_ids: seatIds }),
    });
  },

  releaseHold: (holdToken: string) => {
    return request<{ success: boolean; message: string }>(`/seat-holds/${holdToken}`, {
      method: 'DELETE',
    });
  },

  // Bookings
  createBooking: (showId: string, holdToken: string, promotionCode?: string) => {
    return request<{ id: string; booking_code: string; total_amount: number; status: string }>('/bookings', {
      method: 'POST',
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
      body: JSON.stringify({
        show_id: showId,
        hold_token: holdToken,
        promotion_code: promotionCode || undefined,
      }),
    });
  },

  getUserBookings: () => request<BookingDetail[]>('/bookings'),

  getBooking: (id: string) => request<BookingDetail>(`/bookings/${id}`),

  cancelBooking: (bookingId: string, reason?: string) => {
    return request<{ booking_id: string; status: string; refund_amount: number; message: string }>(
      `/bookings/${bookingId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Customer requested cancellation' }),
      }
    );
  },

  // Payments Sandbox
  checkout: (bookingId: string, paymentMethod = 'UPI', simulateFailure = false) => {
    return request<{
      payment_id: string;
      booking_id: string;
      amount: number;
      currency: string;
      status: string;
      client_secret: string;
    }>('/payments/checkout', {
      method: 'POST',
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
      body: JSON.stringify({
        booking_id: bookingId,
        payment_method: paymentMethod,
        simulate_failure: simulateFailure,
      }),
    });
  },

  simulatePaymentWebhookSuccess: (paymentId: string, bookingId: string, amount: number) => {
    // Calling backend webhook
    return request<{ status: string; booking_id: string }>('/payments/webhook', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'payment.succeeded',
        payment_id: paymentId,
        booking_id: bookingId,
        transaction_id: 'txn_sbx_' + Date.now(),
        amount: amount,
      }),
    });
  },

  // Tickets
  getTicket: (ticketIdOrNumber: string) => request<TicketDetail>(`/tickets/${ticketIdOrNumber}`),

  verifyTicket: (ticketNumber: string) => {
    return request<{
      is_valid: boolean;
      status: string;
      message: string;
      ticket_number?: string;
      movie_title?: string;
      theater_name?: string;
      start_time?: string;
      seats?: string[];
    }>('/tickets/verify', {
      method: 'POST',
      body: JSON.stringify({ ticket_number: ticketNumber }),
    });
  },

  // AI Features
  discoverMovies: (query: string, city = 'Delhi') => {
    return request<{
      query: string;
      extracted_filters: any;
      movies: Movie[];
      matched_show_count: number;
      explanation: string;
    }>('/ai/discover', {
      method: 'POST',
      body: JSON.stringify({ query, city }),
    });
  },

  planGroupMovie: (groupName: string, members: any[], city = 'Delhi') => {
    return request<GroupPlannerResult>('/ai/group-planner', {
      method: 'POST',
      body: JSON.stringify({ group_name: groupName, members, city }),
    });
  },

  chatAI: (message: string, history: any[] = [], city = 'Delhi') => {
    return request<{
      reply: string;
      tools_called: string[];
      structured_data?: any;
    }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history, city }),
    });
  },

  // Admin
  getAdminAnalytics: () => request<AdminAnalytics>('/admin/analytics'),

  // Collaborative Group Sessions
  createGroupSession: (name: string, hostName = 'Host') => {
    return request<any>('/groups/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, host_name: hostName }),
    });
  },

  getGroupSession: (inviteCode: string) => {
    return request<any>(`/groups/sessions/${inviteCode}`);
  },

  joinGroupSession: (inviteCode: string, memberData: { name: string; preferred_genres: string[]; preferred_languages: string[]; max_budget: number }) => {
    return request<any>(`/groups/sessions/${inviteCode}/join`, {
      method: 'POST',
      body: JSON.stringify(memberData),
    });
  },

  decideGroupSession: (inviteCode: string) => {
    return request<any>(`/groups/sessions/${inviteCode}/decide`, {
      method: 'POST',
    });
  },
};
