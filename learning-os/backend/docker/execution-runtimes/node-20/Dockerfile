# Node.js 20 Runtime for Interview Simulator
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Add a non-root user for security
RUN addgroup -g 1001 -S runner && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G runner -g runner runner

# Create tmp directory with proper permissions
RUN mkdir -p /tmp && chmod 1777 /tmp

# Copy the execution wrapper script
COPY runner.js /app/runner.js

# Set ownership
RUN chown -R runner:runner /app

# Switch to non-root user
USER runner

# Default command reads code from environment and executes
CMD ["node", "/app/runner.js"]
