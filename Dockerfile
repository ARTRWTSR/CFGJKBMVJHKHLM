FROM node:18-slim

# התקנת כלי בסיס, FFmpeg ו-Deno
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg curl unzip
RUN curl -fsSL https://deno.land/x/install/install.sh | sh

# הגדרת נתיבים עבור Deno
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# התקנת yt-dlp בגרסה האחרונה
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
