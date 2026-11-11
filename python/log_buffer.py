"""
Journalisation du service Python : console + tampon mémoire circulaire exposé par GET /logs.
Next.js interroge /logs?after=<id> et réinjecte les entrées dans ses propres logs (page /logs).
"""
import contextvars
import logging
import threading
import traceback
import uuid
from collections import deque
from datetime import datetime, timezone

# ANCHOR: requestId transmis par Next (en-tête X-Request-Id) pour corréler les logs des deux côtés.
current_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_request_id", default=None)

BOOT_ID = uuid.uuid4().hex[:12]
MAX_ENTRIES = 1000


class RingBufferHandler(logging.Handler):
    def __init__(self, capacity: int = MAX_ENTRIES):
        super().__init__()
        self._entries: deque[dict] = deque(maxlen=capacity)
        self._next_id = 1
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            exception = None
            if record.exc_info:
                exception = "".join(traceback.format_exception(*record.exc_info))
            with self._lock:
                self._entries.append({
                    "id": self._next_id,
                    "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                    "level": record.levelname,
                    "logger": record.name.split(".")[-1],
                    "message": record.getMessage(),
                    "exception": exception,
                    "request_id": getattr(record, "request_id", None) or current_request_id.get(),
                })
                self._next_id += 1
        except Exception:
            self.handleError(record)

    def entries_after(self, after_id: int) -> list[dict]:
        with self._lock:
            return [entry for entry in self._entries if entry["id"] > after_id]


ring_buffer_handler = RingBufferHandler()


def setup_logging() -> None:
    root = logging.getLogger("etcetera")
    if root.handlers:
        return
    root.setLevel(logging.DEBUG)
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter("[%(name)s] %(levelname)s %(message)s"))
    root.addHandler(console)
    root.addHandler(ring_buffer_handler)


def get_logger(name: str) -> logging.Logger:
    """Loggers attendus : etcetera.system, etcetera.chatterbox, etcetera.whisper."""
    setup_logging()
    return logging.getLogger(f"etcetera.{name}")
