from typing import Any, Optional


class AppException(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: str = "BAD_REQUEST",
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details


class ResourceNotFoundException(AppException):
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            message=f"{resource} with identifier '{identifier}' was not found.",
            status_code=404,
            error_code="RESOURCE_NOT_FOUND",
            details={"resource": resource, "identifier": str(identifier)},
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Could not validate credentials"):
        super().__init__(
            message=message,
            status_code=401,
            error_code="UNAUTHORIZED",
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "You do not have permission to access this resource"):
        super().__init__(
            message=message,
            status_code=403,
            error_code="FORBIDDEN",
        )


class SeatAlreadyReservedException(AppException):
    def __init__(self, seat_ids: list, message: Optional[str] = None):
        msg = message or f"One or more seats ({', '.join(str(s) for s in seat_ids)}) are already held or confirmed by another user."
        super().__init__(
            message=msg,
            status_code=409,
            error_code="SEATS_ALREADY_RESERVED",
            details={"conflicted_seats": seat_ids},
        )


class SeatHoldExpiredException(AppException):
    def __init__(self, hold_id: str):
        super().__init__(
            message=f"Seat hold '{hold_id}' has expired. Please select your seats again.",
            status_code=410,
            error_code="SEAT_HOLD_EXPIRED",
            details={"hold_id": hold_id},
        )


class InvalidStateTransitionException(AppException):
    def __init__(self, entity: str, current_state: str, attempted_state: str):
        super().__init__(
            message=f"Cannot transition {entity} from '{current_state}' to '{attempted_state}'.",
            status_code=400,
            error_code="INVALID_STATE_TRANSITION",
            details={"entity": entity, "current_state": current_state, "attempted_state": attempted_state},
        )


class PaymentFailedException(AppException):
    def __init__(self, message: str, payment_id: Optional[str] = None):
        super().__init__(
            message=message,
            status_code=402,
            error_code="PAYMENT_FAILED",
            details={"payment_id": payment_id},
        )


class CancellationNotAllowedException(AppException):
    def __init__(self, reason: str):
        super().__init__(
            message=f"Booking cancellation is not permitted: {reason}",
            status_code=400,
            error_code="CANCELLATION_NOT_ALLOWED",
            details={"reason": reason},
        )


class IdempotencyConflictException(AppException):
    def __init__(self, idempotency_key: str):
        super().__init__(
            message=f"A request with idempotency key '{idempotency_key}' is already currently processing.",
            status_code=409,
            error_code="IDEMPOTENCY_IN_PROGRESS",
            details={"idempotency_key": idempotency_key},
        )
