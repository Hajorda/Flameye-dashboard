FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app/src

COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["api-server"]
