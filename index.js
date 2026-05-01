import express from 'express';
import { spawn } from 'child_process';
import { google } from 'googleapis';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const queue = new PQueue({ concurrency: 1 });
const jobs = new Map();

// 1. הגדרת החיבור (המפתח)
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/drive.file']
);

// 2. הגדרת ה"דרייב" - השורה הזו הייתה חסרה או במקום לא נכון!
const drive = google.drive({ version: 'v3', auth });

const processTransfer = async (jobId, url, folderId) => {
  const job = jobs.get(jobId);
  job.status = 'processing';

  return new Promise((resolve, reject) => {

const ytdlp = spawn('yt-dlp', [
  '--newline',
  '--cookies', 'cookies.txt.txt', // הוספת השורה הזו
  '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  '-o', '-', 
  url
]);

    // שימוש ב-drive שהגדרנו למעלה
    drive.files.create({
      requestBody: { name: `video_${jobId}.mp4`, parents: [folderId] },
      media: { mimeType: 'video/mp4', body: ytdlp.stdout },
    }, {
      onUploadProgress: (evt) => {
        job.progress = Math.round((evt.bytesRead / 1024 / 1024) * 100) / 100;
      }
    }).then(() => {
      job.status = 'completed';
      job.progress = 100;
      resolve();
    }).catch(err => {
      ytdlp.kill('SIGKILL');
      reject(err);
    });

    ytdlp.stderr.on('data', (data) => console.log(`דיווח: ${data}`));
  });
};

app.post('/upload', (req, res) => {
  const { url, folderId } = req.body;
  const jobId = uuidv4();
  jobs.set(jobId, { status: 'queued', progress: 0 });
  queue.add(() => processTransfer(jobId, url, folderId).catch(err => {
    const j = jobs.get(jobId);
    if (j) { j.status = 'failed'; j.error = err.message; }
  }));
  res.status(202).json({ jobId });
});

app.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Not found" });
  res.json(job);
});

app.listen(3000, () => console.log('🚀 המנוע פועל על פורט 3000'));
