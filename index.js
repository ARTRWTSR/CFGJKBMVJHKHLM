import express from 'express';
import { spawn } from 'child_process';
import { google } from 'googleapis';
import { PassThrough } from 'stream';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// מאפשר לאתר ב-lovable לבצע את הפנייה ללא חסימות CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ה-ID של התיקייה שלך ב-Google Drive כפי שחולץ מהקישור
const FOLDER_ID = '1lsQxAHgIJcugQpo5eho-TDO6vVb2ukl5';

app.get('/', (req, res) => {
    res.send('המנוע פועל וממתין לפקודות...');
});

// הנתיב המקור שהאתר שלך מבקש
app.get('/upload', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing video URL' });
    }

    // החזרת תשובה מיידית לאתר כדי שלא יציג שגיאה של זמן המתנה (Timeout)
    res.json({ message: 'Process started successfully', url: videoUrl });
    
    // הרצת תהליך ההורדה וההעלאה ברקע
    try {
        await processVideo(videoUrl);
    } catch (error) {
        console.error("❌ התהליך נכשל ברקע:", error);
    }
});

async function processVideo(videoUrl) {
    console.log(`🚀 מתחיל הזרמת וידאו עבור: ${videoUrl}`);

    // יצירת צינור להעברת הנתונים בזמן אמת לענן
    const bridgeStream = new PassThrough();

    // הפעלת yt-dlp במצב הזרמה (Output מופנה ל-'-')
    const ytdlp = spawn('yt-dlp', [
        '-f', 'bestvideo+bestaudio/best',
        '--merge-output-format', 'mp4',
        '--cookies', '/etc/secrets/cookies.txt', 
        '-o', '-', 
        videoUrl
    ]);

    // חיבור יציאת הנתונים של המנוע אל צינור ההעלאה
    ytdlp.stdout.pipe(bridgeStream);

    // הדפסת לוגי ההתקדמות (שם ראינו את ה-100% בהצלחה)
    ytdlp.stderr.on('data', (data) => {
        console.log(`דיווח: ${data.toString().trim()}`);
    });

    try {
        // התחברות ל-Google Drive באמצעות Service Account
        const auth = new google.auth.GoogleAuth({
            keyFile: './service-account.json', 
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        const drive = google.drive({ version: 'v3', auth });

        console.log("☁️ הצינור פתוח. מעביר נתונים ישירות ל-Google Drive...");

        // יצירת הקובץ בדרייב מתוך זרם הנתונים
        const response = await drive.files.create({
            requestBody: {
                name: `video_${Date.now()}.mp4`,
                parents: [FOLDER_ID], 
            },
            media: {
                mimeType: 'video/mp4',
                body: bridgeStream, // הזרמה ישירה ללא תפיסת מקום בשרת
            },
            fields: 'id, name',
        });

        console.log(`✅ הצלחה מלאה! הקובץ הועלה לדרייב. ID: ${response.data.id}`);

    } catch (error) {
        console.error("❌ שגיאה חמורה מול ה-API של גוגל דרייב:", error.message);
        if (error.response) {
            console.error("פרטי השגיאה מגוגל:", JSON.stringify(error.response.data));
        }
    }
}

app.listen(port, () => {
    console.log(`🚀 השרת מאזין בהצלחה בפורט ${port}`);
});
