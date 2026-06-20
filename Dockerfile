FROM node:20-slim

# התקנת כלי מערכת בסיסיים, FFmpeg ו-Python (הנחוץ עבור yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# התקנת המנוע yt-dlp בצורה גלובלית
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# התקנת Deno עבור פתרון אתגרי ה-JavaScript של יוטיוב
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# הגדרת תיקיית העבודה של השרת
WORKDIR /app

# העתקת קבצי הפרויקט והתקנת חבילות ה-Node
COPY package*.json ./
RUN npm install

# העתקת שאר הקוד
COPY . .

# הפורט עליו רצה המערכת
EXPOSE 3000

# פקודת ההרצה
CMD ["node", "index.js"]
