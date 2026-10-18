"""
Circular Waste Marketplace — Structured Logging Configuration
=============================================================
Uses structlog for structured JSON or console output with request-ID injection.
Redacts sensitive PII (passwords, tokens, authorization headers, cookies).
"""
from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any

import structlog
from structlog.types import EventDict, WrappedLogger

# Context variable that carries the request ID for the current async context.
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

SENSITIVE_KEYS = (
    "password",
    "token",
    "authorization",
    "cookie",
    "secret",
    "access_token",
    "refresh_token",
)


def get_request_id() -> str:
    """Return the request ID for the current async context, or generate a new one."""
    rid = request_id_var.get()
    return rid if rid else str(uuid.uuid4())


def add_request_id(
    logger: WrappedLogger,
    method_name: str,
    event_dict: EventDict,
) -> EventDict:
    """Structlog processor: inject request_id from context var."""
    rid = request_id_var.get()
    if rid:
        event_dict["request_id"] = rid
    elif "request_id" not in event_dict:
        event_dict["request_id"] = "-"
    return event_dict


def redact_pii(
    logger: WrappedLogger,
    method_name: str,
    event_dict: EventDict,
) -> EventDict:
    """Structlog processor: redact sensitive keys."""
    for key in list(event_dict.keys()):
        lower_key = key.lower()
        if any(sensitive in lower_key for sensitive in SENSITIVE_KEYS):
            event_dict[key] = "***"
    return event_dict


def drop_color_message_key(
    logger: WrappedLogger,
    method_name: str,
    event_dict: EventDict,
) -> EventDict:
    """Remove uvicorn's ``color_message`` key to keep logs clean."""
    event_dict.pop("color_message", None)
    return event_dict


def configure_logging(log_level: str = "INFO", log_format: str = "json") -> None:
    """
    Configure structlog for the entire application.

    Args:
        log_level: Python log level string (INFO, DEBUG, etc.)
        log_format: ``json`` for production JSON logs; ``console`` for dev pretty-print.
    """
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        add_request_id,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso", key="timestamp"),
        structlog.processors.StackInfoRenderer(),
        redact_pii,
        drop_color_message_key,
    ]

    if log_format == "json":
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level.upper())

    # Reduce noise from third-party libraries
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "alembic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str = __name__) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger for the given module name."""
    return structlog.get_logger(name)
