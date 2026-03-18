"""
News / Event filter service.

Checks whether a high-impact economic event is within the configurable
exclusion window. Uses a pluggable provider architecture — start with
a static schedule, replace with a live API later.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class NewsEvent:
    """Represents a scheduled economic news event."""

    def __init__(
        self,
        name: str,
        time: datetime,
        impact: str = "HIGH",
        currency: str = "USD",
    ):
        self.name = name
        self.time = time if time.tzinfo else time.replace(tzinfo=timezone.utc)
        self.impact = impact
        self.currency = currency


class NewsService:
    """
    Determines whether trading should be blocked due to upcoming news.
    """

    def __init__(self):
        self._events: List[NewsEvent] = []
        self._last_fetch: Optional[datetime] = None

    def set_events(self, events: List[NewsEvent]) -> None:
        """Manually set news events (for testing or static schedule)."""
        self._events = sorted(events, key=lambda e: e.time)
        self._last_fetch = datetime.now(tz=timezone.utc)

    def check_news_window(self) -> Dict[str, Any]:
        """
        Check if the current time is within a news exclusion window.

        Returns:
            Dict with keys:
            - news_upcoming: bool
            - news_minutes_away: int (positive=before, negative=after)
            - event_name: str
            - is_blocked: bool
        """
        cfg = get_settings()
        now = datetime.now(tz=timezone.utc)
        before_minutes = cfg.NEWS_BLOCK_BEFORE_MINUTES
        after_minutes = cfg.NEWS_BLOCK_AFTER_MINUTES

        for event in self._events:
            delta = (event.time - now).total_seconds() / 60.0  # minutes
            # Event is upcoming (within block window before)
            if 0 <= delta <= before_minutes:
                return {
                    "news_upcoming": True,
                    "news_minutes_away": int(delta),
                    "event_name": event.name,
                    "is_blocked": True,
                }
            # Event just happened (within block window after)
            if -after_minutes <= delta < 0:
                return {
                    "news_upcoming": True,
                    "news_minutes_away": int(delta),
                    "event_name": event.name,
                    "is_blocked": True,
                }

        return {
            "news_upcoming": False,
            "news_minutes_away": None,
            "event_name": None,
            "is_blocked": False,
        }

    async def fetch_events(self) -> None:
        """
        Fetch upcoming events from external provider.
        TODO: Implement live API integration (Forex Factory, Investing.com, etc.)
        """
        # Placeholder — in production, call a news API
        logger.debug("News fetch: using static/cached events (%d loaded)", len(self._events))
