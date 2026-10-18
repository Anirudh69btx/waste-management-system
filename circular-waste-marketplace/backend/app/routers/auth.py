"""
Circular Waste Marketplace — Auth Router
========================================
Authentication endpoints:
- POST /register         (rate-limited, returns {user, tokens})
- POST /login            (rate-limited, accepts JSON or OAuth2 form)
- POST /refresh          (rate-limited with user/ip key)
- POST /logout           (idempotent 204)
- GET /me                (current user profile)
- PATCH /me              (update name, org, phone)
- POST /change-password  (revokes all refresh tokens)
"""
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import get_user_or_ip_key, limiter
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.dependencies.auth import get_current_active_user
from app.models import User
from app.schemas.auth import (
    ChangePasswordRequest,
    RefreshRequest,
    RegisterResponse,
    TokenPairResponse,
    UserLoginRequest,
    UserReadResponse,
    UserRegisterRequest,
    UserUpdateRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user account",
)
@limiter.limit(settings.auth_rate_limit_register)
async def register(
    request: Request,
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_async_session),
) -> RegisterResponse:
    """Register a new user with role (GENERATOR, RECYCLER, LOGISTICS) and issue initial tokens."""
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await AuthService(db, settings).register(
        payload=payload,
        user_agent=user_agent,
        ip_address=ip_address,
    )


@router.post(
    "/login",
    response_model=TokenPairResponse,
    summary="Authenticate with email/phone and password",
)
@limiter.limit(settings.auth_rate_limit_login)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_async_session),
) -> TokenPairResponse:
    """
    Authenticate credentials and issue JWT access and refresh tokens.
    Accepts standard application/json or application/x-www-form-urlencoded
    for OAuth2 Swagger UI compatibility.
    """
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        username = str(form.get("username", "")).strip()
        password = str(form.get("password", ""))
        from pydantic import ValidationError
        from fastapi.exceptions import RequestValidationError
        try:
            if "@" in username:
                login_req = UserLoginRequest(email=username, password=password)
            else:
                login_req = UserLoginRequest(phone_number=username, password=password)
        except ValidationError as exc:
            raise RequestValidationError(exc.errors())
    else:
        body = await request.json()
        from pydantic import ValidationError
        from fastapi.exceptions import RequestValidationError
        try:
            login_req = UserLoginRequest.model_validate(body)
        except ValidationError as exc:
            raise RequestValidationError(exc.errors())

    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await AuthService(db, settings).login(
        payload=login_req,
        user_agent=user_agent,
        ip_address=ip_address,
    )


@router.post(
    "/refresh",
    response_model=TokenPairResponse,
    summary="Rotate refresh token and get new token pair",
)
@limiter.limit(settings.auth_rate_limit_refresh, key_func=get_user_or_ip_key)
async def refresh_tokens(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_async_session),
) -> TokenPairResponse:
    """Rotate an existing refresh token for a newly issued access and refresh token pair."""
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return await AuthService(db, settings).refresh(
        refresh_token_str=payload.refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke refresh token and logout session",
)
async def logout(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_async_session),
) -> Response:
    """Revoke the presented refresh token. Idempotent: returns 204 even if already revoked."""
    await AuthService(db, settings).logout(payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserReadResponse,
    summary="Get current user profile",
)
async def get_me(
    user: User = Depends(get_current_active_user),
) -> UserReadResponse:
    """Return the profile of the currently authenticated user."""
    return UserReadResponse.model_validate(user)


@router.patch(
    "/me",
    response_model=UserReadResponse,
    summary="Update current user profile",
)
async def update_me(
    payload: UserUpdateRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> UserReadResponse:
    """Update profile attributes (full_name, organization_name, phone_number)."""
    return await AuthService(db, settings).update_me(user.id, payload)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change password and revoke all active sessions",
)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> Response:
    """Verify current password, set new password, and invalidate all existing refresh tokens."""
    await AuthService(db, settings).change_password(
        user_id=user.id,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
