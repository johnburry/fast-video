import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let audioPath: string | null = null;
  let imagePath: string | null = null;
  let outputPath: string | null = null;

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const imageUrl = formData.get('imageUrl') as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Create temporary file paths
    const tempDir = tmpdir();
    const timestamp = Date.now();
    audioPath = path.join(tempDir, `audio-${timestamp}.webm`);
    imagePath = path.join(tempDir, `image-${timestamp}.jpg`);
    outputPath = path.join(tempDir, `output-${timestamp}.mp4`);

    // Save audio file
    const audioBuffer = await audioFile.arrayBuffer();
    await writeFile(audioPath, Buffer.from(audioBuffer));

    // Download and save thumbnail image
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      await writeFile(imagePath, Buffer.from(imageBuffer));
    } else {
      // Create a default black image if no thumbnail
      await execAsync(
        `ffmpeg -f lavfi -i color=c=black:s=1280x720:d=1 -frames:v 1 "${imagePath}"`
      );
    }

    // Use FFmpeg to combine audio and image into video
    // -loop 1: loop the image
    // -i: input image
    // -i: input audio
    // -c:v libx264: use H.264 video codec
    // -tune stillimage: optimize for still image
    // -c:a aac: use AAC audio codec
    // -b:a 192k: audio bitrate
    // -pix_fmt yuv420p: pixel format for compatibility
    // -shortest: end video when audio ends
    const ffmpegCommand = `ffmpeg -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -y "${outputPath}"`;

    console.log('Running FFmpeg command:', ffmpegCommand);
    await execAsync(ffmpegCommand);

    // Read the output video file
    const videoBuffer = await readFile(outputPath);

    // Clean up temporary files
    await Promise.all([
      unlink(audioPath).catch(() => {}),
      unlink(imagePath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);

    // Return the video file
    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="audio-video.mp4"',
      },
    });
  } catch (error) {
    console.error('Error converting audio to video:', error);

    // Clean up files on error
    if (audioPath) await unlink(audioPath).catch(() => {});
    if (imagePath) await unlink(imagePath).catch(() => {});
    if (outputPath) await unlink(outputPath).catch(() => {});

    return NextResponse.json(
      { error: 'Failed to convert audio to video', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
