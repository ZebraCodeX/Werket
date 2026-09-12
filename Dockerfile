FROM python:3.12-slim
# cache bust 2026-09-12-8
ENV CACHE_BUST=2026-09-12-8
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN DJANGO_SETTINGS_MODULE=config.settings.prod DJANGO_SECRET_KEY=build-secret ALLOWED_HOSTS=localhost python manage.py collectstatic --noinput
EXPOSE 10000
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers 2 --timeout 120"]