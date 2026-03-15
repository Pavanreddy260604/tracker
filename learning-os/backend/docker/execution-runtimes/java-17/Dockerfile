# Java 17 Runtime for Interview Simulator
FROM openjdk:17-alpine

WORKDIR /app

# Add non-root user
RUN addgroup -g 1001 -S runner && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G runner -g runner runner

RUN mkdir -p /tmp && chmod 1777 /tmp

COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh && chown -R runner:runner /app

USER runner

CMD ["/app/runner.sh"]
