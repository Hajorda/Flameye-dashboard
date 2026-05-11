from unittest.mock import MagicMock, patch
from camera_agent.publisher import publish_frame


def test_publish_frame_calls_xadd():
    mock_redis = MagicMock()
    publish_frame(mock_redis, "frames:1", "1", b"fakejpeg", max_len=50)
    mock_redis.xadd.assert_called_once()
    call_kwargs = mock_redis.xadd.call_args
    assert call_kwargs[0][0] == "frames:1"
    fields = call_kwargs[0][1]
    assert fields["camera_id"] == "1"
    assert fields["frame"] == b"fakejpeg"
    assert "timestamp" in fields
