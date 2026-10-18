"""
Circular Waste Marketplace — Domain Exceptions
==============================================
Domain service exceptions representing business and authentication failures.
Mapped to RFC-7807 problem details in global exception handling.
"""
from __future__ import annotations


class ServiceError(Exception):
    """Base exception for all domain service errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__


class UserAlreadyExistsError(ServiceError):
    """Raised when an email or phone number is already registered."""

    def __init__(self, message: str = "An account with this email address already exists.") -> None:
        super().__init__(message, status_code=409, error_code="USER_ALREADY_EXISTS")


class InvalidCredentialsError(ServiceError):
    """Raised when email/phone or password authentication fails."""

    def __init__(self, message: str = "Invalid email or password.") -> None:
        super().__init__(message, status_code=401, error_code="INVALID_CREDENTIALS")


class AccountDeactivatedError(ServiceError):
    """Raised when an account is marked inactive."""

    def __init__(self, message: str = "Account is deactivated. Please contact support.") -> None:
        super().__init__(message, status_code=403, error_code="ACCOUNT_DEACTIVATED")


class UserNotFoundError(ServiceError):
    """Raised when a requested user does not exist."""

    def __init__(self, message: str = "User not found.") -> None:
        super().__init__(message, status_code=404, error_code="USER_NOT_FOUND")


class TokenReplayError(ServiceError):
    """Raised when an already revoked refresh token is presented, indicating possible theft."""

    def __init__(
        self,
        message: str = "Refresh token has already been revoked. All active sessions have been invalidated for security.",
    ) -> None:
        super().__init__(message, status_code=401, error_code="TOKEN_REPLAY_DETECTED")


class TokenRevokedError(ServiceError):
    """Raised when a single refresh token is marked revoked."""

    def __init__(self, message: str = "Refresh token has been revoked.") -> None:
        super().__init__(message, status_code=401, error_code="TOKEN_REVOKED")


class TokenExpiredError(ServiceError):
    """Raised when a refresh token has passed its expiration time."""

    def __init__(self, message: str = "Refresh token has expired.") -> None:
        super().__init__(message, status_code=401, error_code="TOKEN_EXPIRED")


class InvalidTokenServiceError(ServiceError):
    """Raised when a token fails decoding, signature, or claim checks."""

    def __init__(self, message: str = "Invalid token.") -> None:
        super().__init__(message, status_code=401, error_code="INVALID_TOKEN")


class ForbiddenRoleError(ServiceError):
    """Raised when an unauthorized role is requested during registration."""

    def __init__(self, message: str = "Registration for requested role is not permitted.") -> None:
        super().__init__(message, status_code=422, error_code="FORBIDDEN_ROLE")
