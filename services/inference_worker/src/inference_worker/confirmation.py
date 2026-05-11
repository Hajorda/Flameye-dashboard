from collections import deque


class ConfirmationBuffer:
    """
    Requires fire to appear in at least `threshold` of the last `window`
    frames before triggering an alert. Eliminates single-frame false positives.
    """

    def __init__(self, window: int = 5, threshold: int = 3) -> None:
        self.window = window
        self.threshold = threshold
        self._buffers: dict[int, deque[int]] = {}

    def update(self, camera_id: int, detected: bool) -> bool:
        if camera_id not in self._buffers:
            self._buffers[camera_id] = deque(maxlen=self.window)
        self._buffers[camera_id].append(1 if detected else 0)
        return sum(self._buffers[camera_id]) >= self.threshold

    def clear(self, camera_id: int) -> None:
        self._buffers.pop(camera_id, None)
