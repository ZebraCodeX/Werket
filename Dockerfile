FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    PORT=8765
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
EXPOSE 8765
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers 2 --timeout 120"]