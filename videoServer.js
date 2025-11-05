const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

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
    if (!audioPath) return 3; // Default duration if no audio

    try {
        const { stdout } = await execPromise(
            `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
        );
        return parseFloat(stdout.trim());
    } catch (error) {
        console.error('Error getting audio duration:', error);
        return 3; // Default to 3 seconds
    }
}

// Wrap text to multiple lines (for subtitles)
function wrapText(text, maxCharsPerLine = 50) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine = currentLine ? currentLine + ' ' + word : word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines.join('\n');
}

// Escape text for FFmpeg drawtext filter
function escapeDrawtext(text) {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\\\'")
        .replace(/:/g, '\\:')
        .replace(/\n/g, '\\n'); // Preserve line breaks for wrapped text
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
            let imageData, imagePath;
            if (scene.image.startsWith('data:')) {
                // Base64 data URL
                imageData = scene.image.replace(/^data:image\/\w+;base64,/, '');
                imagePath = path.join('temp', `${sceneId}.png`);
                await fs.writeFile(imagePath, Buffer.from(imageData, 'base64'));
            } else {
                // External URL - download it
                const response = await fetch(scene.image);
                const buffer = await response.arrayBuffer();
                imagePath = path.join('temp', `${sceneId}.png`);
                await fs.writeFile(imagePath, Buffer.from(buffer));
            }
            tempFiles.push(imagePath);

            // Save audio (if present)
            let audioPath = null;
            if (scene.audio) {
                if (scene.audio.startsWith('data:')) {
                    // Base64 data URL
                    const audioData = scene.audio.replace(/^data:audio\/\w+;base64,/, '');
                    audioPath = path.join('temp', `${sceneId}.mp3`);
                    await fs.writeFile(audioPath, Buffer.from(audioData, 'base64'));
                } else if (scene.audio.startsWith('blob:')) {
                    // Blob URL - can't fetch from server, skip audio
                    console.warn('Blob URL audio not supported, skipping audio for scene', i);
                    audioPath = null;
                } else {
                    // External URL - download it
                    const response = await fetch(scene.audio);
                    const buffer = await response.arrayBuffer();
                    audioPath = path.join('temp', `${sceneId}.mp3`);
                    await fs.writeFile(audioPath, Buffer.from(buffer));
                }
                if (audioPath) tempFiles.push(audioPath);
            }

            // Save SFX audio (if present)
            let sfxPath = null;
            if (scene.sfx) {
                if (scene.sfx.startsWith('data:')) {
                    // Base64 data URL
                    const sfxData = scene.sfx.replace(/^data:audio\/\w+;base64,/, '');
                    sfxPath = path.join('temp', `${sceneId}_sfx.mp3`);
                    await fs.writeFile(sfxPath, Buffer.from(sfxData, 'base64'));
                } else if (scene.sfx.startsWith('blob:')) {
                    // Blob URL - can't fetch from server, skip SFX
                    console.warn('Blob URL SFX not supported, skipping SFX for scene', i);
                    sfxPath = null;
                } else {
                    // External URL - download it
                    const response = await fetch(scene.sfx);
                    const buffer = await response.arrayBuffer();
                    sfxPath = path.join('temp', `${sceneId}_sfx.mp3`);
                    await fs.writeFile(sfxPath, Buffer.from(buffer));
                }
                if (sfxPath) tempFiles.push(sfxPath);
            }

            // Get audio duration
            const duration = await getAudioDuration(audioPath);

            // Create video segment for this scene
            const segmentPath = path.join('temp', `${sceneId}_segment.mp4`);
            tempFiles.push(segmentPath);

            let filterComplex = `[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[scaled]`;

            // Add subtitles using drawtext filter if needed
            if (includeSubtitles && scene.text) {
                const wrappedText = wrapText(scene.text, 45); // Shorter line length for better fit
                const escapedText = escapeDrawtext(wrappedText);
                // Use text alignment and line spacing for multi-line subtitles
                filterComplex += `;[scaled]drawtext=text='${escapedText}':fontsize=28:fontcolor=white:bordercolor=black:borderw=2:x=(w-text_w)/2:y=h-th-60:line_spacing=5[vout]`;
            } else {
                filterComplex += `;[scaled]copy[vout]`;
            }

            // Build FFmpeg command based on whether audio exists
            let segmentCmd;
            if (audioPath && sfxPath) {
                // With both narration and SFX - mix them
                const audioFilterComplex = `${filterComplex};[1:a]volume=1.0[narration];[2:a]volume=0.3[sfx];[narration][sfx]amix=inputs=2:duration=shortest[aout]`;
                segmentCmd = `"${ffmpegPath}" -loop 1 -framerate 30 -t ${duration} -i "${imagePath}" -i "${audioPath}" -i "${sfxPath}" -filter_complex "${audioFilterComplex}" -map "[vout]" -map "[aout]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k -shortest "${segmentPath}" -y`;
            } else if (audioPath) {
                // With only narration audio
                segmentCmd = `"${ffmpegPath}" -loop 1 -framerate 30 -t ${duration} -i "${imagePath}" -i "${audioPath}" -filter_complex "${filterComplex}" -map "[vout]" -map 1:a -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k -shortest "${segmentPath}" -y`;
            } else if (sfxPath) {
                // With only SFX audio
                segmentCmd = `"${ffmpegPath}" -loop 1 -framerate 30 -t ${duration} -i "${imagePath}" -i "${sfxPath}" -filter_complex "${filterComplex}" -map "[vout]" -map 1:a -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 192k -shortest "${segmentPath}" -y`;
            } else {
                // Without audio (video only)
                segmentCmd = `"${ffmpegPath}" -loop 1 -framerate 30 -t ${duration} -i "${imagePath}" -filter_complex "${filterComplex}" -map "[vout]" -c:v libx264 -preset ultrafast -crf 23 "${segmentPath}" -y`;
            }

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
