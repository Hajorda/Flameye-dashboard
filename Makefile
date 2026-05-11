.PHONY: up down logs restart build ps psql redis test smoke seed clean help

# ── Dev ───────────────────────────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

logs-%:           ## logs-api_server, logs-inference_worker, etc.
	docker compose logs -f $*

restart-%:
	docker compose restart $*

build:
	docker compose build --no-cache

ps:
	docker compose ps

# ── Database ──────────────────────────────────────────────────────────────────
psql:
	docker compose exec postgres psql -U $${POSTGRES_USER:-wildfire} -d $${POSTGRES_DB:-wildfire}

# ── Redis ─────────────────────────────────────────────────────────────────────
redis:
	docker compose exec redis redis-cli

redis-monitor:
	docker compose exec redis redis-cli monitor

frames-len:
	docker compose exec redis redis-cli XLEN frames:1

# ── Testing ───────────────────────────────────────────────────────────────────
smoke:
	@echo "Running RTSP/YouTube smoke test..."
	python scripts/test_stream.py

seed:
	@echo "Seeding camera rows into DB..."
	python scripts/seed_cameras.py

test:
	cd services/camera_agent    && python -m pytest tests/ -v
	cd services/inference_worker && python -m pytest tests/ -v
	cd services/api_server       && python -m pytest tests/ -v

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean:
	docker compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

clean-images:
	rm -f images/*.jpg images/tmp_* 2>/dev/null || true

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  make up            Start all services"
	@echo "  make down          Stop all services"
	@echo "  make logs          Follow all logs"
	@echo "  make build         Rebuild Docker images"
	@echo "  make psql          Open PostgreSQL shell"
	@echo "  make redis         Open Redis CLI"
	@echo "  make frames-len    Check Redis stream frame backlog"
	@echo "  make smoke         Test stream connection (no Docker)"
	@echo "  make seed          Insert test camera into DB"
	@echo "  make clean         Tear down containers + volumes"
	@echo ""
