const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const execPromise = promisify(exec);
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/exports', express.static('exports'));

// Ensure directories exist
async function ensureDirectories() {
    await fs.mkdir('uploads', { recursive: true });
    await fs.mkdir('exports', { recursive: true });
    await fs.mkdir('temp', { recursive: true });
}

// Get audio duration using ffprobe
async function getAudioDuration(audioPath) {
    try {
        const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
        const { stdout } = await execPromise(
            `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
        );
        return parseFloat(stdout.trim());
    } catch (error) {
        console.error('Error getting audio duration:', error);
        return 3; // Default to 3 seconds
    }
}

// Escape text for FFmpeg drawtext filter
function escapeDrawtext(text) {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\\\'")
        .replace(/:/g, '\\:')
        .replace(/\n/g, ' ');
}

// Generate video from scenes
app.post('/generate-video', async (req, res) => {
    let tempFiles = [];

    try {
        const { scenes, includeSubtitles } = req.body;

        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
            return res.status(400).json({ error: 'No scenes provided' });
        }

        console.log(`Generating video with ${scenes.length} scenes, subtitles: ${includeSubtitles}`);

        // Process each scene
        const videoSegments = [];
        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const sceneId = `scene_${i}_${Date.now()}`;

            // Save image
            const imageData = scene.image.replace(/^data:image\/\w+;base64,/, '');
            const imagePath = path.join('temp', `${sceneId}.png`);
            await fs.writeFile(imagePath, Buffer.from(imageData, 'base64'));
            tempFiles.push(imagePath);

            // Save audio
            const audioData = scene.audio.replace(/^data:audio\/\w+;base64,/, '');
            const audioPath = path.join('temp', `${sceneId}.mp3`);
            await fs.writeFile(audioPath, Buffer.from(audioData, 'base64'));
            tempFiles.push(audioPath);

            // Get audio duration
            const duration = await getAudioDuration(audioPath);

            // Create video segment for this scene
            const segmentPath = path.join('temp', `${sceneId}_segment.mp4`);
            tempFiles.push(segmentPath);

            let filterComplex = `[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[scaled]`;

            // Add subtitles using drawtext filter if needed
            if (includeSubtitles && scene.text) {
                const escapedText = escapeDrawtext(scene.text);
                filterComplex += `;[scaled]drawtext=text='${escapedText}':fontsize=32:fontcolor=white:bordercolor=black:borderw=2:x=(w-text_w)/2:y=h-th-40[vout]`;
            } else {
                filterComplex += `;[scaled]copy[vout]`;
            }

            const segmentCmd = `"${ffmpegPath}" -loop 1 -framerate 30 -t ${duration} -i "${imagePath}" -i "${audioPath}" -filter_complex "${filterComplex}" -map "[vout]" -map 1:a -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k -shortest "${segmentPath}" -y`;

            console.log(`Processing scene ${i + 1}/${scenes.length}...`);
            await execPromise(segmentCmd, { maxBuffer: 1024 * 1024 * 100 });

            videoSegments.push(segmentPath);
        }

        // Create concat file for FFmpeg
        const concatFilePath = path.join('temp', `concat_${Date.now()}.txt`);
        const concatContent = videoSegments.map(seg => `file '${path.resolve(seg)}'`).join('\n');
        await fs.writeFile(concatFilePath, concatContent);
        tempFiles.push(concatFilePath);

        // Concatenate all segments
        const outputPath = path.join('exports', `video_${Date.now()}.mp4`);
        const concatCmd = `"${ffmpegPath}" -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}" -y`;

        console.log('Concatenating video segments...');
        await execPromise(concatCmd, { maxBuffer: 1024 * 1024 * 100 });
        console.log('Video generated successfully');

        // Clean up temp files
        for (const file of tempFiles) {
            try {
                await fs.unlink(file);
            } catch (err) {
                console.error(`Error deleting temp file ${file}:`, err);
            }
        }

        res.json({
            success: true,
            videoUrl: `/exports/${path.basename(outputPath)}`,
            filename: path.basename(outputPath)
        });

    } catch (error) {
        console.error('Error generating video:', error);

        // Clean up temp files on error
        for (const file of tempFiles) {
            try {
                await fs.unlink(file);
            } catch (err) {
                // Ignore cleanup errors
            }
        }

        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', ffmpeg: ffmpegPath });
});

// Start server
const PORT = process.env.PORT || 3100;
ensureDirectories().then(() => {
    app.listen(PORT, () => {
        console.log(`Video export server running on http://localhost:${PORT}`);
        console.log(`FFmpeg path: ${ffmpegPath}`);
    });
});
