from inference_worker.confirmation import ConfirmationBuffer


def test_no_alert_below_threshold():
    buf = ConfirmationBuffer(window=5, threshold=3)
    assert buf.update(1, True) is False
    assert buf.update(1, True) is False


def test_alert_at_threshold():
    buf = ConfirmationBuffer(window=5, threshold=3)
    buf.update(1, True)
    buf.update(1, True)
    assert buf.update(1, True) is True


def test_false_resets_buffer():
    buf = ConfirmationBuffer(window=5, threshold=3)
    buf.update(1, True)
    buf.update(1, True)
    buf.update(1, True)
    # Window slides — add 5 falses to push all trues out
    for _ in range(5):
        buf.update(1, False)
    assert buf.update(1, True) is False


def test_independent_cameras():
    buf = ConfirmationBuffer(window=5, threshold=3)
    for _ in range(3):
        buf.update(1, True)
    # Camera 2 has its own buffer
    assert buf.update(2, True) is False
