import express from 'express';
import { spawn } from 'child_process';
import { google } from 'googleapis';
import { PassThrough } from 'stream';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// === הגדרות ===
const FOLDER_ID = '1lsQxAHgIJcugQpo5eho-TDO6vVb2ukl5';
// ===============

app.use(cors()); // מאפשר לאתר שלך לשלוח בקשות לשרת הזה
app.use(express.json());

app.get('/', (req, res) => {
    res.send('המערכת מוכנה לעבודה.');
});

app.get('/download', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).send('חסר קישור.');
    }

    res.send(`התהליך החל עבור: ${videoUrl}`);
    
    try {
        await processVideo(videoUrl);
    } catch (error) {
        console.error("שגיאה בעיבוד:", error);
    }
});

async function processVideo(videoUrl) {
    console.log(`מפעיל עיבוד עבור: ${videoUrl}`);

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
        console.log(`דיווח מנוע: ${data.toString()}`);
    });

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: './service-account.json', 
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        const drive = google.drive({ version: 'v3', auth });

        console.log("מתחיל הזרמה לדרייב...");

        const response = await drive.files.create({
            requestBody: {
                name: `file_${Date.now()}.mp4`,
                parents: [FOLDER_ID], 
            },
            media: {
                mimeType: 'video/mp4',
                body: bridgeStream,
            },
            fields: 'id, name',
        });

        console.log(`✅ הושלם. ID: ${response.data.id}`);

    } catch (error) {
        console.error("❌ שגיאת API:", error.message);
    }
}

app.listen(port, () => {
    console.log(`השרת מאזין בפורט ${port}`);
});
