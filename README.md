# CineMate AI — Production-Grade Movie Ticket Reservation System

[![CI Workflow](https://github.com/cinemate/cinemate-ai/actions/workflows/ci.yml/badge.svg)](https://github.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19_TypeScript-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?style=flat&logo=PostgreSQL&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D.svg?style=flat&logo=Redis&logoColor=white)](https://redis.io)

**CineMate AI** is a production-engineered movie ticket reservation platform designed to demonstrate strong backend engineering skills for software developer placements. It solves the critical distributed systems challenge of **high-concurrency seat reservation**, preventing double-bookings with a dual-layer concurrency control engine, reliable booking & payment state machines, Redis caching, Celery background workers, and an AI movie discovery & group consensus planner.

---

## 1. System Architecture

```
                                  +---------------------------------------+
                                  |     React 19 + TypeScript + Vite      |
                                  |    Cinematic Glassmorphism Client     |
                                  +-------------------+-------------------+
                                                      |
                                                      | HTTP / REST (X-Request-ID, JWT)
                                                      v
+---------------------------------------------------------------------------------------------------------+
|                                        FastAPI Application Server                                       |
|                                                                                                         |
|  [ Middleware: Correlation ID | Structured Logging | Execution Timing | Global Exception Handlers ]      |
|                                                                                                         |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
|  |    Auth Service    |  |   Catalog Service  |  |  Show & Inventory  |  |  Reservation Service      |  |
|  |  JWT / bcrypt / RBAC|  | Redis Invalidation |  | Seat Layout Map   |  | Dual-Layer Concurrency    |  |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
|                                                                                                         |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
|  |  Booking Service   |  |  Payment Gateway   |  |   Ticket Service   |  |  AI Discovery & Group     |  |
|  |   State Machine    |  | HMAC Webhooks / Sbx|  | QR Code / Crypto   |  | Multi-Criteria Scoring    |  |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
+------------------------------------+------------------------------------------------+-------------------+
                                     |                                                |
              Fast-Lock & Cache      v                                                v  ACID Storage
         +---------------------------------------+                       +---------------------------------------+
         |                Redis 7                |                       |             PostgreSQL 16             |
         | - Temporary seat hold coordinate locks|                       | - Normalized Relational Schema        |
         | - Distributed TTL eviction            |                       | - Row-Level Conflict Constraints      |
         | - Read-heavy catalog caching          |                       | - Transactional Outbox Events         |
         | - Idempotency response caching        |                       | - Alembic Database Migrations         |
         +-------------------+-------------------+                       +-------------------+-------------------+
                             |                                                               |
                             | Task Queue & Broker                                           |
                             v                                                               v
         +-----------------------------------------------------------------------------------+
         |                               Celery Workers & Beat Scheduler                     |
         | - Expired seat hold sweeps                                                        |
         | - Transactional Outbox processor                                                  |
         | - Digital ticket notifications                                                    |
         +-----------------------------------------------------------------------------------+
```

---

## 2. The Critical Concurrency Challenge

### The Problem
When two or more users simultaneously submit checkout requests for the exact same seat at the exact same millisecond, a naive booking engine suffers from race conditions leading to **double bookings**, customer disputes, and financial reconciliation nightmares.

### The Solution: Dual-Layer Concurrency Architecture

CineMate implements a robust two-tier defense:

```
                  User A Request                       User B Request
                 (Seat C4, Show S1)                   (Seat C4, Show S1)
                         |                                    |
                         v                                    v
          +----------------------------------------------------------+
          |             LAYER 1: Redis Distributed Lock              |
          |             SETNX seat_hold:S1:C4 User_ID EX 600         |
          +----------------------------------------------------------+
                         |                                    |
                Acquired: True                       Acquired: False
                         |                                    |
                         v                                    v
          +------------------------------+             +---------------------------+
          | LAYER 2: PostgreSQL          |             | HTTP 409 Conflict         |
          | ACID Transaction             |             | Code: SEATS_ALREADY_RESERVED
          | 1. SELECT FOR UPDATE         |             | Conflicted: [C4]          |
          | 2. Verify active holds &     |             +---------------------------+
          |    confirmed bookings        |
          | 3. INSERT seat_holds (HELD)  |
          | 4. COMMIT                    |
          +--------------+---------------+
                         |
                         v
          +------------------------------+
          | HTTP 201 Created             |
          | hold_token: hld_xxx          |
          | TTL: 600s (10 min countdown) |
          +------------------------------+
```

1. **Layer 1 (Redis Fast-Lock Coordination)**:
   - Uses atomic Redis key creation: `SET seat_hold:{show_id}:{seat_id} {user_id} NX EX 600`.
   - Competing concurrent requests are rejected in sub-milliseconds without creating database lock contention.
   - If a batch of 3 seats is requested and only 2 are free, the acquired locks are immediately released (all-or-nothing rollback).

2. **Layer 2 (PostgreSQL ACID Transaction & Integrity Safekeeping)**:
   - Within an isolated transaction, the backend verifies that no active confirmed booking (`status = 'CONFIRMED'`) or active unexpired hold (`expires_at > NOW()`) exists.
   - Inserts `seat_holds` record with a unique cryptographic `hold_token` and explicit TTL timestamp.

3. **Late-Payment After Hold Expiration Recovery**:
   - If a customer's payment succeeds *after* their temporary hold expired and another customer booked the seat:
   - The backend checks for seat conflicts during the payment webhook.
   - It **never** blindly confirms an invalid booking. Instead, it marks the booking `EXPIRED`, automatically initiates a 100% `REFUND`, and generates an audit log entry.

---

## 3. Booking and Payment State Machine

```
              [ HOLD SEATS ]
                     |
                     v
             +---------------+
             |    PENDING    | <------- Initial State (Pricing Calculated)
             +-------+-------+
                     |
         +-----------+-----------+--------------------+
         | (Payment Success)     | (Payment Failed)   | (Hold Expired)
         v                       v                    v
+-----------------+     +-----------------+  +-----------------+
|    CONFIRMED    |     | PAYMENT_FAILED  |  |     EXPIRED     |
+--------+--------+     +-----------------+  +-----------------+
         |
         | (Customer Cancelled > 2 hrs before show)
         v
+-----------------+
|    CANCELLED    | ---> Automatic Refund Initiated
+-----------------+
```

---

## 4. AI Engine: Discovery & Group Consensus

1. **Natural Language Movie Discovery**:
   - Parses complex queries (e.g., *"Find a Hindi comedy near me tomorrow evening, under ₹300 per ticket, lasting less than two hours"*).
   - Extracts structured parameters (`genre`, `language`, `max_price`, `max_duration_minutes`, `time_of_day`) with LLM and intelligent rule-based heuristic fallbacks.
   - Directly executes database queries against real cinema inventory.

2. **Group Movie Planner (Consensus Algorithm)**:
   - Allows friends to input individual genre affinities, language comfort, and maximum individual budgets.
   - Calculates a multi-criteria compatibility score:
     $$\text{Score} = 0.40(\text{Genre Match}) + 0.25(\text{Language}) + 0.20(\text{Budget Fit}) + 0.15(\text{Rating})$$
   - Explains the exact consensus reasons and compromise recommendations.

3. **Conversational Assistant with Tool Calling**:
   - Exposes controlled tools (`search_movies`, `get_showtimes`, `check_seat_availability`, `plan_group_movie`).
   - The AI never executes raw SQL, alters seat states, or overrides pricing directly.

---

## 5. Automated Test Suite

The test suite validates concurrency race conditions, edge cases, and end-to-end flows.

```bash
pytest backend/tests -v
```

### Verified Test Cases:
| Test File | Test Case | Status | Description |
|-----------|-----------|--------|-------------|
| `test_concurrency.py` | `test_concurrent_seat_holds` | ✅ PASSED | 5 simultaneous competing requests for same seat; exactly 1 succeeds, 4 get 409 |
| `test_concurrency.py` | `test_hold_release_and_rebooking` | ✅ PASSED | Verifies inventory releases and re-booking availability |
| `test_bookings.py` | `test_booking_price_calculation_and_idempotency` | ✅ PASSED | Validates server-side pricing, tax, convenience fee, and duplicate idempotency keys |
| `test_bookings.py` | `test_cancel_booking_workflow` | ✅ PASSED | Tests cancellation window, seat release, and invalid state transition safeguards |
| `test_payments.py` | `test_checkout_and_webhook_confirmation` | ✅ PASSED | Tests sandbox checkout and HMAC-SHA256 signature webhook verification |
| `test_payments.py` | `test_simulated_payment_failure` | ✅ PASSED | Simulates bank decline; verifies 402 status and booking failure transition |
| `test_ai.py` | `test_natural_language_movie_discovery` | ✅ PASSED | Tests NLP entity extraction and catalog retrieval |
| `test_ai.py` | `test_group_movie_planner_scoring` | ✅ PASSED | Tests weighted compatibility algorithm across group preferences |
| `test_ai.py` | `test_ai_conversational_chat` | ✅ PASSED | Tests assistant conversational tool calling |
| `test_auth.py` | `test_register_and_login_flow` | ✅ PASSED | Tests registration, bcrypt hash, JWT, duplicate rejection, and refresh |
| `test_e2e.py` | `test_full_end_to_end_booking_journey` | ✅ PASSED | **Full E2E**: Register → Search → Select Show → Hold Seats → Checkout → Webhook Pay → Digital QR Ticket → Gate Verify → Booking History |

---

## 6. Local Quickstart Guide

### Option A: Running Directly with Local Python & Node

#### 1. Setup Backend
```bash
# In project root:
.\.venv\Scripts\Activate.ps1   # (or source .venv/bin/activate on Unix)

# Apply Alembic database migrations
cd backend
alembic upgrade head

# Seed realistic demo catalog
python scripts/seed_data.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
- API Documentation (Swagger UI): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

#### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
- Open `http://localhost:5173` in your browser.

#### Demo Credentials:
- **Customer Demo**: `customer@cinemate.ai` / `Customer@123456`
- **Admin Demo**: `admin@cinemate.ai` / `Admin@123456`
*(Both available via one-click fill buttons in the Sign In modal)*

---

### Option B: Running via Docker Compose

```bash
docker compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend API & Docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
