# Python 3.11 Runtime for Interview Simulator
FROM python:3.11-alpine

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    gcc \
    musl-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S runner && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G runner -g runner runner

RUN mkdir -p /tmp && chmod 1777 /tmp

COPY runner.py /app/runner.py
RUN chown -R runner:runner /app

USER runner

CMD ["python", "/app/runner.py"]
