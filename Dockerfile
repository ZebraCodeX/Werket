# ---- Frontend build stage ----
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund
COPY frontend/ ./frontend/
RUN cd frontend && npm run build
# Output lands in /build/staticfiles (vite outDir '../staticfiles')

# ---- Python app stage ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.prod
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Bring in the container-built frontend bundle (host staticfiles/ is dockerignored)
COPY --from=frontend /build/staticfiles ./staticfiles
RUN python manage.py collectstatic --noinput
EXPOSE 10000
CMD ["sh", "-c", "python -c \"import os,sys; url=os.environ.get('DATABASE_URL',''); print(f'DATABASE_URL={url[:30]}...' if len(url)>30 else f'DATABASE_URL={url}')\" && python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers 2 --timeout 120"]