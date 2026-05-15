# Stage 1: Build the application
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Stage 2: Production environment
FROM node:20-slim

WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app .

# Expose port (Cloud Run sets PORT env var)
EXPOSE 3000

# Start server
CMD ["npm", "start"]
