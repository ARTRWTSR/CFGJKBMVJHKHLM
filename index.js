import express from 'express';
import { spawn } from 'child_process';
import { google } from 'googleapis';
import { PassThrough } from 'stream';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// הגדרת CORS בצורה רחבה כדי לאפשר לאתר שלך ב-lovable לגשת לשרת
app.use(cors({
    origin: '*', // מאפשר גישה מכל מקור, פותר את שגיאת ה-CORS שראית
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const FOLDER_ID = '1lsQxAHgIJcugQpo5eho-TDO6vVb2ukl5';

app.get('/', (req, res) => {
    res.send('Server is running');
});

// שיניתי את הנתיב ל-/upload כדי שיתאים למה שהאתר שלך מחפש בלוגים
app.get('/upload', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).send('Missing video URL');
    }

    // שליחת אישור מיידי לדפדפן כדי למנוע Timeout
    res.json({ message: 'Process started', url: videoUrl });
    
    try {
        await processVideo(videoUrl);
    } catch (error) {
        console.error("Error in process:", error);
    }
});

async function processVideo(videoUrl) {
    console.log(`Starting processing for: ${videoUrl}`);
    const bridgeStream = new PassThrough();

    const ytdlp = spawn('yt-dlp', [
        '-f', 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--cookies', '/etc/secrets/cookies.txt', 
        '-o', '-', 
        videoUrl
    ]);

    ytdlp.stdout.pipe(bridgeStream);

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: './service-account.json', 
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        const drive = google.drive({ version: 'v3', auth });

        await drive.files.create({
            requestBody: {
                name: `video_${Date.now()}.mp4`,
                parents: [FOLDER_ID], 
            },
            media: {
                mimeType: 'video/mp4',
                body: bridgeStream,
            },
            fields: 'id',
        });

        console.log(`✅ Upload finished successfully.`);
    } catch (error) {
        console.error("❌ Drive API Error:", error.message);
    }
}

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
