"""
Circular Waste Marketplace — Authentication Service
===================================================
Production-grade business logic for registration, authentication,
token refresh rotation with replay attack defense, logout, profile
management, and password change operations.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import (
    AuthError,
    ExpiredTokenError,
    InvalidTokenError,
    TokenTypeMismatchError,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    dummy_verify_password,
    hash_password,
    hash_token,
    verify_password,
    verify_token_hash,
)
from app.core.settings import Settings, get_settings
from app.models import RefreshToken, RewardWallet, User
from app.repositories.refresh_token_repo import RefreshTokenRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import (
    RegisterResponse,
    TokenPairResponse,
    UserLoginRequest,
    UserReadResponse,
    UserRegisterRequest,
    UserUpdateRequest,
)
from app.services.exceptions import (
    AccountDeactivatedError,
    ForbiddenRoleError,
    InvalidCredentialsError,
    InvalidTokenServiceError,
    TokenExpiredError,
    TokenReplayError,
    UserAlreadyExistsError,
    UserNotFoundError,
)

logger = get_logger(__name__)


class AuthService:
    """Authentication and identity service orchestration."""

    def __init__(
        self,
        db: AsyncSession,
        settings: Settings | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()
        self._user_repo = UserRepository(db)
        self._refresh_repo = RefreshTokenRepository(db)

    async def register(
        self,
        payload: UserRegisterRequest,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> RegisterResponse:
        """
        Create a new user account, initialize reward wallet, issue initial tokens,
        and store refresh token record for rotation.

        Raises:
            ForbiddenRoleError: If self-registration attempts to assign ADMIN.
            UserAlreadyExistsError: If email or phone already registered.
        """
        # Service-level defense against ADMIN self-registration
        role_str = str(payload.role).strip().upper()
        if role_str == "ADMIN":
            raise ForbiddenRoleError("Self-registration for the ADMIN role is strictly forbidden.")

        # Check email uniqueness (case-insensitive)
        clean_email = payload.email.strip().lower()
        if await self._user_repo.get_by_email(clean_email):
            raise UserAlreadyExistsError("An account with this email address already exists.")

        # Check phone uniqueness if provided
        if payload.phone_number:
            clean_phone = payload.phone_number.strip()
            if await self._user_repo.get_by_phone(clean_phone):
                raise UserAlreadyExistsError("An account with this phone number already exists.")

        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email=clean_email,
            hashed_password=hash_password(payload.password),
            full_name=payload.full_name.strip(),
            role=role_str,
            organization_name=payload.organization_name.strip() if payload.organization_name else None,
            phone_number=payload.phone_number.strip() if payload.phone_number else None,
            is_active=True,
            is_verified=False,
            failed_login_count=0,
            last_login_at=datetime.now(tz=timezone.utc),
        )
        await self._user_repo.create(user)

        # Provision initial reward wallet
        wallet = RewardWallet(
            id=uuid.uuid4(),
            user_id=user.id,
            available_points=0,
            lifetime_earned=0,
            lifetime_redeemed=0,
            updated_at=datetime.now(tz=timezone.utc),
        )
        self._db.add(wallet)
        await self._db.flush()

        # Issue access & refresh token pair
        tokens = await self._issue_token_pair(
            user=user,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        logger.info("user_registered", user_id=str(user.id), role=role_str)
        return RegisterResponse(
            user=UserReadResponse.model_validate(user),
            tokens=tokens,
        )

    async def login(
        self,
        payload: UserLoginRequest,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> TokenPairResponse:
        """
        Authenticate user by email OR phone.
        Includes timing attack mitigation via dummy password verification.

        Raises:
            InvalidCredentialsError: If credentials do not match.
            AccountDeactivatedError: If user is inactive.
        """
        user: Optional[User] = None
        if payload.email:
            user = await self._user_repo.get_by_email(payload.email)
        elif payload.phone_number:
            user = await self._user_repo.get_by_phone(payload.phone_number)

        # Timing attack defense: perform dummy bcrypt check if user does not exist
        if not user:
            dummy_verify_password()
            raise InvalidCredentialsError("Invalid credentials.")

        # Check password
        if not verify_password(payload.password, user.hashed_password):
            await self._user_repo.increment_failed_login(user)
            raise InvalidCredentialsError("Invalid credentials.")

        # Check active status
        if not user.is_active:
            raise AccountDeactivatedError("Account is deactivated. Please contact support.")

        # Update last login and reset failed count
        await self._user_repo.touch_last_login(user)

        tokens = await self._issue_token_pair(
            user=user,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        logger.info("user_logged_in", user_id=str(user.id))
        return tokens

    async def refresh(
        self,
        refresh_token_str: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> TokenPairResponse:
        """
        Rotate refresh token and issue new token pair.
        Enforces replay attack defense: presenting an already-revoked token
        revokes all active sessions for that user.

        Raises:
            TokenExpiredError: If token expired.
            InvalidTokenServiceError: If token signature or structure invalid.
            TokenReplayError: If token was already revoked (triggers session wipe).
            AccountDeactivatedError: If user inactive.
        """
        try:
            payload = decode_refresh_token(refresh_token_str, self._settings)
        except ExpiredTokenError as exc:
            raise TokenExpiredError("Refresh token has expired.") from exc
        except (TokenTypeMismatchError, InvalidTokenError, AuthError) as exc:
            raise InvalidTokenServiceError(f"Invalid token: {exc}") from exc

        jti = payload.get("jti")
        sub = payload.get("sub")
        if not jti or not sub:
            raise InvalidTokenServiceError("Missing required claims in refresh token.")

        db_token = await self._refresh_repo.get_by_jti(jti)
        if not db_token:
            raise InvalidTokenServiceError("Refresh token session not found.")

        # REPLAY ATTACK DEFENSE:
        # If the token is already revoked, an attacker or race is reusing a rotated token.
        # Invalidate all user sessions immediately.
        if db_token.revoked_at is not None:
            logger.warning(
                "refresh_token_replay_detected",
                user_id=sub,
                jti=jti,
                revoked_at=str(db_token.revoked_at),
            )
            await self._refresh_repo.revoke_all_for_user(db_token.user_id)
            await self._db.commit()
            raise TokenReplayError(
                "Refresh token has already been revoked. All active sessions have been invalidated for security."
            )

        # Check DB expiration
        now = datetime.now(tz=timezone.utc)
        if db_token.expires_at <= now:
            raise TokenExpiredError("Refresh token has expired.")

        # Constant-time verify against stored SHA-256 hash
        if not verify_token_hash(refresh_token_str, db_token.token_hash):
            raise InvalidTokenServiceError("Token verification failed.")

        # Verify user state
        user = await self._user_repo.get_by_id(db_token.user_id)
        if not user or not user.is_active:
            raise AccountDeactivatedError("User account not found or deactivated.")

        # Generate new refresh token
        new_jti = uuid.uuid4().hex
        role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
        new_refresh_str = create_refresh_token(
            subject=str(user.id),
            role=role_val,
            email=user.email,
            is_verified=user.is_verified,
            jti=new_jti,
            settings=self._settings,
        )
        new_refresh_hash = hash_token(new_refresh_str)
        new_expires_at = now + timedelta(days=self._settings.refresh_token_expire_days)

        new_db_token = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            jti=new_jti,
            token_hash=new_refresh_hash,
            expires_at=new_expires_at,
            user_agent=user_agent or db_token.user_agent,
            ip_address=ip_address or db_token.ip_address,
        )
        await self._refresh_repo.create(new_db_token)

        # Revoke the current token and record replacement link
        await self._refresh_repo.revoke(db_token, replaced_by_jti=new_jti)

        # Generate new access token
        new_access_str = create_access_token(
            subject=str(user.id),
            role=role_val,
            email=user.email,
            is_verified=user.is_verified,
            settings=self._settings,
        )

        logger.info("token_refreshed", user_id=str(user.id), old_jti=jti, new_jti=new_jti)
        return TokenPairResponse(
            access_token=new_access_str,
            refresh_token=new_refresh_str,
            token_type="bearer",
            expires_in=self._settings.access_token_expire_minutes * 60,
        )

    async def logout(self, refresh_token_str: str) -> None:
        """
        Revoke the presented refresh token.
        Idempotent operation: does not raise error if token is already revoked or invalid.
        """
        try:
            payload = decode_refresh_token(refresh_token_str, self._settings)
            jti = payload.get("jti")
            if jti:
                db_token = await self._refresh_repo.get_by_jti(jti)
                if db_token and db_token.revoked_at is None:
                    await self._refresh_repo.revoke(db_token)
                    logger.info("user_logged_out", jti=jti, user_id=payload.get("sub"))
        except Exception:
            # Idempotent logout — invalid or expired tokens still result in 204
            pass

    async def change_password(
        self,
        user_id: uuid.UUID | str,
        current_password: str,
        new_password: str,
    ) -> None:
        """
        Verify existing password, hash and store new password,
        and revoke ALL existing refresh tokens for the user.

        Raises:
            UserNotFoundError: If user not found.
            InvalidCredentialsError: If current password does not match.
        """
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("User not found.")

        if not verify_password(current_password, user.hashed_password):
            raise InvalidCredentialsError("Current password is incorrect.")

        user.hashed_password = hash_password(new_password)
        await self._user_repo.update(user)

        # Invalidate all existing sessions
        revoked_count = await self._refresh_repo.revoke_all_for_user(user.id)
        logger.info("password_changed", user_id=str(user.id), sessions_revoked=revoked_count)

    async def get_by_id(self, user_id: uuid.UUID | str) -> UserReadResponse:
        """
        Retrieve user profile by ID.

        Raises:
            UserNotFoundError: If user not found.
        """
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("User not found.")
        return UserReadResponse.model_validate(user)

    async def update_me(
        self,
        user_id: uuid.UUID | str,
        payload: UserUpdateRequest,
    ) -> UserReadResponse:
        """
        Update user's full_name, organization_name, or phone_number.

        Raises:
            UserNotFoundError: If user not found.
            UserAlreadyExistsError: If new phone number is taken.
        """
        user = await self._user_repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError("User not found.")

        updates = payload.model_dump(exclude_unset=True)
        if "phone_number" in updates and updates["phone_number"]:
            phone = updates["phone_number"].strip()
            existing = await self._user_repo.get_by_phone(phone)
            if existing and existing.id != user.id:
                raise UserAlreadyExistsError("Phone number is already associated with another account.")
            updates["phone_number"] = phone

        await self._user_repo.update(user, **updates)
        return UserReadResponse.model_validate(user)

    async def _issue_token_pair(
        self,
        user: User,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> TokenPairResponse:
        """Helper to create and persist access and refresh token pair."""
        role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
        refresh_jti = uuid.uuid4().hex

        access_token = create_access_token(
            subject=str(user.id),
            role=role_val,
            email=user.email,
            is_verified=user.is_verified,
            settings=self._settings,
        )
        refresh_token = create_refresh_token(
            subject=str(user.id),
            role=role_val,
            email=user.email,
            is_verified=user.is_verified,
            jti=refresh_jti,
            settings=self._settings,
        )

        now = datetime.now(tz=timezone.utc)
        token_record = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            jti=refresh_jti,
            token_hash=hash_token(refresh_token),
            expires_at=now + timedelta(days=self._settings.refresh_token_expire_days),
            user_agent=user_agent,
            ip_address=ip_address,
        )
        await self._refresh_repo.create(token_record)

        return TokenPairResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self._settings.access_token_expire_minutes * 60,
        )
