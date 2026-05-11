FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONPATH=/app/src

COPY pyproject.toml .

# Pre-install CPU-only torch before ultralytics so pip won't pull CUDA wheels.
# This is critical on Apple Silicon (M-series) and any CPU-only host.
RUN pip install --no-cache-dir \
    torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

COPY src/ src/
RUN pip install --no-cache-dir -e .

RUN mkdir -p /app/images

CMD ["inference-worker"]
