import logging
import sys
from functools import lru_cache

from app.core.config import settings


@lru_cache()
def get_logger(name: str = "app") -> logging.Logger:
    """
    Get a configured logger instance.

    Uses lru_cache to ensure we always get the same logger instance for a given name.
    Configures the logger with a standard format and output to stdout.

    Args:
        name: The name of the logger, defaults to "app"

    Returns:
        Configured logging.Logger instance
    """
    logger = logging.getLogger(name)

    # Only configure if handlers haven't been added yet to avoid duplicate logs
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
        # Set log level based on environment or default to INFO
        # You might want to add LOG_LEVEL to your settings in the future
        logger.setLevel(logging.INFO)

    return logger
