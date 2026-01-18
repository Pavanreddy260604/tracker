# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Production Stage
FROM node:18-alpine

WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "dist/index.js"]
