const express = require('express');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const { PassThrough } = require('stream');

const app = express();
const port = process.env.PORT || 3000; // הפורט ש-Render דורש

// === הגדרות ===
const FOLDER_ID = '1lsQxAHgIJcugQpo5eho-TDO6vVb2ukl5'; // התיקייה שלך בדרייב
// ===============

app.use(express.json());

// דף בית פשוט כדי ש-Render יראה שהשרת חי
app.get('/', (req, res) => {
    res.send('המנוע פועל וממתין לפקודות...');
});

// נקודת הקצה שמקבלת את הקישור ומתחילה את התהליך
app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).send('חובה לספק קישור (url)');
    }

    // שולחים תשובה מיידית לאתר שהתהליך התחיל, כדי שהבקשה לא תיתקע
    res.send(`התחיל תהליך הורדה והעלאה עבור: ${videoUrl}`);
    
    // מפעילים את הפונקציה ברקע
    try {
        await processVideo(videoUrl);
    } catch (error) {
        console.error("התהליך נכשל:", error);
    }
});

// הפונקציה המרכזית (הורדה + הזרמה לדרייב)
async function processVideo(videoUrl) {
    console.log(`🚀 מתחיל עיבוד עבור: ${videoUrl}`);

    const bridgeStream = new PassThrough();

    const ytdlp = spawn('yt-dlp', [
        '-f', 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--cookies', '/etc/secrets/cookies.txt', 
        '-o', '-', 
        videoUrl
    ]);

    ytdlp.stdout.pipe(bridgeStream);

    ytdlp.stderr.on('data', (data) => {
        console.log(`דיווח: ${data.toString().trim()}`);
    });

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: './service-account.json', 
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        const drive = google.drive({ version: 'v3', auth });

        console.log("☁️ הזרמה החלה. שולח נתונים ל-Google Drive...");

        const response = await drive.files.create({
            requestBody: {
                name: `video_${Date.now()}.mp4`,
                parents: [FOLDER_ID], 
            },
            media: {
                mimeType: 'video/mp4',
                body: bridgeStream,
            },
            fields: 'id, name',
        });

        console.log(`✅ הצלחה! הקובץ הועלה לדרייב. ID: ${response.data.id}`);

    } catch (error) {
        console.error("❌ שגיאת העלאה מול גוגל:", error.message);
    }
}

// הפעלת השרת
app.listen(port, () => {
    console.log(`🚀 השרת פועל ומאזין על פורט ${port}`);
});
