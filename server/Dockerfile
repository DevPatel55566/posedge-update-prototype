FROM node:20-alpine

WORKDIR /app

# Install curl and unzip to download rclone
RUN apk add --no-cache curl unzip

# Download and install rclone directly into the system
RUN curl -O https://downloads.rclone.org/rclone-current-linux-amd64.zip && \
    unzip rclone-current-linux-amd64.zip && \
    mv rclone-*/rclone /usr/local/bin/ && \
    chmod +x /usr/local/bin/rclone && \
    rm -rf rclone-*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the server code
COPY . .

# Expose port and start
EXPOSE 10000
CMD ["node", "server.js"]