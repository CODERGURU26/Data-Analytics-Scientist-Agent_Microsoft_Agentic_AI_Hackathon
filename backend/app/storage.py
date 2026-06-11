from __future__ import annotations

from threading import Lock

from .models import AnalysisStatus


class AnalysisStore:
    def __init__(self) -> None:
        self._items: dict[str, AnalysisStatus] = {}
        self._lock = Lock()

    def save(self, status: AnalysisStatus) -> AnalysisStatus:
        with self._lock:
            self._items[status.analysis_id] = status
        return status

    def get(self, analysis_id: str) -> AnalysisStatus | None:
        with self._lock:
            return self._items.get(analysis_id)

    def update(self, analysis_id: str, **changes) -> AnalysisStatus:
        with self._lock:
            current = self._items[analysis_id]
            updated = current.model_copy(update=changes)
            self._items[analysis_id] = updated
            return updated


analysis_store = AnalysisStore()
