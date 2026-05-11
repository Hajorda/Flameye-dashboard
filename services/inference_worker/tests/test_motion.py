import numpy as np
from inference_worker.motion import has_motion


def test_none_prev_always_motion():
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    assert has_motion(None, frame) is True


def test_identical_frames_no_motion():
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    assert has_motion(frame, frame) is False


def test_different_frames_motion():
    prev = np.zeros((480, 640, 3), dtype=np.uint8)
    curr = np.full((480, 640, 3), 50, dtype=np.uint8)
    assert has_motion(prev, curr, threshold=5.0) is True
