FROM python:3.12-slim
WORKDIR /app
COPY . .
ENV PORT=8765
EXPOSE 8765
CMD ["python", "app.py"]
