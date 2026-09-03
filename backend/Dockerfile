# Python 3.12: mature prebuilt wheels for pydantic-core/etc — avoids the
# build-from-source issues newer Python versions hit with those packages.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh && mkdir -p /app/data

ENV PYTHONUNBUFFERED=1 \
    DATABASE_URL=sqlite:////app/data/team_pulse.db

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
