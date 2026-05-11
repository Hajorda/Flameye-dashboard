FROM python:3.11-slim

# ffmpeg required by yt-dlp for stream muxing; libgl1 + libglib2.0 for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONPATH=/app/src

COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir -e .

CMD ["camera-agent"]
