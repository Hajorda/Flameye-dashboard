import cv2
import numpy as np


def has_motion(
    prev_frame: np.ndarray | None,
    curr_frame: np.ndarray,
    threshold: float = 1.5,
) -> bool:
    """Return True if mean pixel difference between frames exceeds threshold."""
    if prev_frame is None:
        return True
    diff = cv2.absdiff(prev_frame, curr_frame)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    return float(gray.mean()) > threshold
