FROM node:22-bookworm-slim

WORKDIR /app

# Install ExifTool versi Linux
RUN apt-get update \
    && apt-get install -y --no-install-recommends libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*

# Install dependency backend
COPY package*.json ./
RUN npm ci --omit=dev

# Salin kode backend
COPY api.js ./

# Siapkan folder upload
RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=3999
ENV EXIFTOOL_PATH=exiftool

EXPOSE 3999
# Running ya cihuy
CMD ["node", "api.js"]