# SQL Evaluator Runtime for Interview Simulator
FROM python:3.11-alpine

# Install SQLite
RUN apk update && apk add --no-cache sqlite

WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S runner && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G runner -g runner runner

RUN mkdir -p /tmp && chmod 1777 /tmp

COPY evaluator.py /app/evaluator.py
RUN chown -R runner:runner /app

USER runner

CMD ["python", "/app/evaluator.py"]
