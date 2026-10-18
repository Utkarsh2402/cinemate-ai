import json
import logging
from typing import Any, Optional
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger("cinemate.redis")


class RedisService:
    def __init__(self):
        self.client: Optional[aioredis.Redis] = None
        self._is_fake: bool = False

    async def connect(self):
        try:
            client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            # Test ping
            await client.ping()
            self.client = client
            self._is_fake = False
            logger.info("Connected to Redis at %s", settings.REDIS_URL)
        except Exception as e:
            if settings.USE_FAKEREDIS_FALLBACK:
                import fakeredis.aioredis as fake_aioredis
                logger.warning("Real Redis unreachable (%s). Initializing async FakeRedis in-memory store for development/testing.", e)
                self.client = fake_aioredis.FakeRedis(decode_responses=True)
                self._is_fake = True
            else:
                logger.error("Failed to connect to Redis: %s", e)
                raise e

    async def close(self):
        if self.client:
            await self.client.aclose()
            logger.info("Redis connection closed")

    async def get(self, key: str) -> Optional[str]:
        if not self.client:
            return None
        try:
            return await self.client.get(key)
        except Exception as e:
            logger.warning("Redis GET failed for %s: %s", key, e)
            return None

    async def get_json(self, key: str) -> Optional[Any]:
        val = await self.get(key)
        if val is not None:
            try:
                return json.loads(val)
            except Exception:
                return None
        return None

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        if not self.client:
            return False
        try:
            await self.client.set(key, value, ex=ex)
            return True
        except Exception as e:
            logger.warning("Redis SET failed for %s: %s", key, e)
            return False

    async def set_json(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        return await self.set(key, json.dumps(value, default=str), ex=ex)

    async def delete(self, key: str) -> bool:
        if not self.client:
            return False
        try:
            await self.client.delete(key)
            return True
        except Exception as e:
            logger.warning("Redis DELETE failed for %s: %s", key, e)
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern (e.g. 'movie:*')"""
        if not self.client:
            return 0
        try:
            keys = await self.client.keys(pattern)
            if keys:
                return await self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning("Redis DELETE_PATTERN failed for %s: %s", pattern, e)
            return 0

    # Distributed Coordination for Seat Holds
    async def acquire_seat_hold(self, show_id: str, seat_id: str, user_id: str, ttl_seconds: int) -> bool:
        """
        Fast Redis-level coordination lock.
        Key: seat_hold:{show_id}:{seat_id} -> user_id
        Returns True if acquired, False if already held.
        """
        if not self.client:
            return True  # fallback to DB-level enforcement
        key = f"seat_hold:{show_id}:{seat_id}"
        try:
            # SET key val NX EX ttl
            result = await self.client.set(key, user_id, nx=True, ex=ttl_seconds)
            return bool(result)
        except Exception as e:
            logger.warning("Redis acquire_seat_hold failed for %s: %s", key, e)
            return True  # Fallback to DB row lock

    async def release_seat_hold(self, show_id: str, seat_id: str, user_id: Optional[str] = None) -> bool:
        """Release Redis seat hold key if owned by user (or force if user_id is None)"""
        if not self.client:
            return True
        key = f"seat_hold:{show_id}:{seat_id}"
        try:
            if user_id is None:
                await self.client.delete(key)
                return True
            curr = await self.client.get(key)
            if curr == str(user_id):
                await self.client.delete(key)
                return True
            return False
        except Exception as e:
            logger.warning("Redis release_seat_hold failed for %s: %s", key, e)
            return False

    async def is_seat_held_in_redis(self, show_id: str, seat_id: str) -> Optional[str]:
        """Returns the user_id holding the seat, or None"""
        if not self.client:
            return None
        key = f"seat_hold:{show_id}:{seat_id}"
        try:
            return await self.client.get(key)
        except Exception:
            return None


redis_service = RedisService()
