'use client';

import { useState, useEffect, useRef } from 'react';
import MuxUploader from '@mux/mux-uploader-react';
import MuxPlayer from '@mux/mux-player-react';
import { QRCodeSVG } from 'qrcode.react';
import { getThumbnailUrl } from '@/lib/thumbnail';

export default function RecordPage() {
  const [uploadId, setUploadId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelHandle, setChannelHandle] = useState<string | null>(null);
  const [channelThumbnail, setChannelThumbnail] = useState<string | null>(null);
  const [channelExternalLink, setChannelExternalLink] = useState<string | null>(null);
  const [channelExternalLinkName, setChannelExternalLinkName] = useState<string | null>(null);
  const [recordUrl, setRecordUrl] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [channelLoading, setChannelLoading] = useState<boolean>(true);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationOption, setDestinationOption] = useState<'default' | 'other'>('default');
  const [customDestination, setCustomDestination] = useState('');
  const [showVideoEndedOverlay, setShowVideoEndedOverlay] = useState(false);
  const [overrideVideoThumbnail, setOverrideVideoThumbnail] = useState(false);
  const [videoKey, setVideoKey] = useState(0);
  const playerRef = useRef<any>(null);
  const [recordingMode, setRecordingMode] = useState<'video' | 'audio'>('video');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect subdomain and fetch channel info
  useEffect(() => {
    const getChannelFromSubdomain = async () => {
      try {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        let subdomain: string | null = null;

        if (hostname.includes('localhost')) {
          if (parts.length >= 2 && parts[0] !== 'localhost') {
            subdomain = parts[0];
          }
        } else {
          if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'all') {
            subdomain = parts[0];
          }
        }

        if (subdomain) {
          console.log('Detected subdomain:', subdomain);
          setChannelHandle(subdomain);
          const res = await fetch(`/api/channels/handle/${subdomain}`);
          if (res.ok) {
            const data = await res.json();
            console.log('Channel found:', data);
            setChannelId(data.id);
            setChannelName(data.name);
            setChannelThumbnail(data.thumbnail);
            setChannelExternalLink(data.externalLink || null);
            setChannelExternalLinkName(data.externalLinkName || null);
          } else {
            console.error('Channel not found for subdomain:', subdomain, 'Status:', res.status);
          }
        } else {
          console.log('No subdomain detected');
        }
      } catch (e) {
        console.error('Error fetching channel from subdomain:', e);
      } finally {
        setChannelLoading(false);
      }
    };

    getChannelFromSubdomain();

    // Refresh channel data when window regains focus (e.g., user returns from update page)
    const handleFocus = async () => {
      await getChannelFromSubdomain();

      // If using default destination and there's an external link, fetch OpenGraph data
      if (destinationOption === 'default') {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        let subdomain: string | null = null;

        if (hostname.includes('localhost')) {
          if (parts.length >= 2 && parts[0] !== 'localhost') {
            subdomain = parts[0];
          }
        } else {
          if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'all') {
            subdomain = parts[0];
          }
        }

        if (subdomain) {
          try {
            const res = await fetch(`/api/channels/handle/${subdomain}`);
            if (res.ok) {
              const data = await res.json();
              // No need to fetch OpenGraph data anymore
            }
          } catch (err) {
            console.error('Error refreshing external link preview:', err);
          }
        }
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [destinationOption]);

  // Parse URL parameters on load and set destination
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const altDest = urlParams.get('dest');

      if (altDest) {
        setDestinationOption('other');
        setCustomDestination(altDest);
      }

      // Detect if device is iOS or Android (to hide QR code and enable mobile uploader)
      // Include touch capability check for iPads that report desktop user agents
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isUserAgentMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isMacWithTouch = /Macintosh/i.test(navigator.userAgent) && isTouchDevice;

      const checkIsMobile = isUserAgentMobile || isMacWithTouch;
      setIsMobile(checkIsMobile);
    }
  }, []);

  // Update QR code URL when destination changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin + window.location.pathname;

      if (destinationOption === 'other' && customDestination) {
        // Add dest parameter to URL
        const url = new URL(baseUrl);
        url.searchParams.set('dest', customDestination);
        setRecordUrl(url.toString());
      } else {
        // Use base URL without parameters
        setRecordUrl(baseUrl);
      }
    }
  }, [destinationOption, customDestination]);

  const createUpload = async () => {
    try {
      const res = await fetch('/api/mux/upload', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to create upload');
      }
      const { id, url } = await res.json();
      setUploadId(id);
      return url;
    } catch (e) {
      console.error('Error in createUpload', e);
      setError('Error creating upload. Please check your Mux credentials.');
      return null;
    }
  };

  const handleUploadStart = () => {
    setIsUploading(true);
    setError('');
  };

  const handleSuccess = () => {
    setIsPreparing(true);
    setIsUploading(false);
  };

  const handleError = (event: any) => {
    setIsUploading(false);
    setError(event.detail?.message || 'Upload failed');
  };

  // Poll for upload status
  useEffect(() => {
    if (!isPreparing || !uploadId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mux/upload/${uploadId}`);
        const data = await res.json();

        if (data.playbackUrl) {
          setPlaybackUrl(data.playbackUrl);
          setIsPreparing(false);
          clearInterval(pollInterval);

          // Save video metadata to database
          const playbackId = data.playbackUrl.split('/').pop()?.replace('.m3u8', '') || '';
          const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;

          try {
            console.log('Saving video metadata with channelId:', channelId, 'overrideVideoThumbnail:', overrideVideoThumbnail);
            const saveRes = await fetch('/api/videos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playbackId,
                thumbnailUrl,
                channelId: channelId, // Associate with channel from subdomain
                altDestination: destinationOption === 'other' ? customDestination : null,
                overrideVideoThumbnail: overrideVideoThumbnail,
              }),
            });

            if (!saveRes.ok) {
              const errorText = await saveRes.text();
              console.error('Failed to save video metadata:', errorText);
              setError(`Failed to save video: ${errorText}`);
            } else {
              console.log('Video metadata saved successfully');
            }
          } catch (saveError) {
            console.error('Error saving video metadata:', saveError);
            setError('Error saving video metadata');
          }
        }
      } catch (e) {
        console.error('Error polling upload status:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isPreparing, uploadId, channelId, destinationOption, customDestination, overrideVideoThumbnail]);

  const getShareableUrl = () => {
    // Extract playback ID from Mux URL (e.g., https://stream.mux.com/PLAYBACK_ID.m3u8)
    const playbackId = playbackUrl.split('/').pop()?.replace('.m3u8', '') || '';
    // Get current hostname to construct the shareable URL
    const hostname = window.location.hostname;
    return `${window.location.protocol}//${hostname}/v/${playbackId}`;
  };

  const copyShareLink = () => {
    const shareUrl = getShareableUrl();
    navigator.clipboard.writeText(shareUrl);
    alert('Video link copied to clipboard!');
  };

  const toggleVideoThumbnail = async () => {
    const newOverrideValue = !overrideVideoThumbnail;

    // Save to database
    const playbackId = playbackUrl.split('/').pop()?.replace('.m3u8', '') || '';

    try {
      const response = await fetch('/api/videos/thumbnail-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbackId,
          overrideVideoThumbnail: newOverrideValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update thumbnail override');
      }

      // Update state and force video player to remount with new poster
      setOverrideVideoThumbnail(newOverrideValue);
      setVideoKey(prev => prev + 1);
    } catch (err) {
      console.error('Error updating thumbnail override:', err);
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine the best supported audio format
      let mimeType = 'audio/webm';
      let options: MediaRecorderOptions | undefined = undefined;

      // Safari supports audio/mp4 but not audio/webm
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        options = { mimeType: 'audio/mp4' };
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
        options = { mimeType: 'audio/webm' };
      }

      console.log('Using audio MIME type:', mimeType);
      setAudioMimeType(mimeType);

      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);

        // Convert blob to data URL for Safari compatibility
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBlobUrl(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting audio recording:', err);
      setError('Failed to access microphone. Please allow microphone access.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const uploadAudioRecording = async () => {
    if (!audioBlob) return;

    try {
      setIsUploading(true);
      setError('');

      // For audio recordings, set thumbnail override to true by default
      setOverrideVideoThumbnail(true);

      // Create upload URL
      const uploadUrlRes = await fetch('/api/mux/upload', { method: 'POST' });
      if (!uploadUrlRes.ok) {
        throw new Error('Failed to create upload URL');
      }
      const { id, url } = await uploadUrlRes.json();
      setUploadId(id);

      // Upload audio file directly to Mux
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: audioBlob,
        headers: {
          'Content-Type': audioMimeType,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload audio');
      }

      setIsPreparing(true);
      setIsUploading(false);

      // Clear audio data after upload (data URLs don't need revocation)
      setAudioBlob(null);
      setAudioBlobUrl(null);
    } catch (err) {
      console.error('Error uploading audio:', err);
      setError('Failed to upload audio recording');
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetRecording = () => {
    // Clear all recording-related state (data URLs don't need revocation)
    setPlaybackUrl('');
    setAudioBlob(null);
    setAudioBlobUrl(null);
    setUploadId('');
    setIsUploading(false);
    setIsPreparing(false);
    setRecordingTime(0);
    setShowVideoEndedOverlay(false);
    setOverrideVideoThumbnail(false);
    setVideoKey(prev => prev + 1);
    setError('');
  };

  const handleSaveDestination = async () => {

    // If video is already uploaded, save immediately
    if (playbackUrl) {
      const playbackId = playbackUrl.split('/').pop()?.replace('.m3u8', '') || '';

      try {
        const response = await fetch('/api/videos/destination', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playbackId,
            altDestination: destinationOption === 'other' ? customDestination : null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save destination');
        }

        setShowDestinationModal(false);
        alert('Destination saved successfully!');
      } catch (err) {
        console.error('Error saving destination:', err);
        alert('Failed to save destination');
      }
    } else {
      // Video not uploaded yet, just close the modal
      // The destination will be saved when the video is uploaded
      setShowDestinationModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto p-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              if (channelHandle) {
                window.location.href = `/${channelHandle}`;
              } else {
                window.history.back();
              }
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <svg className="w-20 h-20 flex-shrink-0" viewBox="0 0 530 510" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="530" height="510" rx="100" fill="#E02020"/>
              <path d="M80 180C80 152.386 102.386 130 130 130H330C357.614 130 380 152.386 380 180V330C380 357.614 357.614 380 330 380H130C102.386 380 80 357.614 80 330V180Z" fill="white"/>
              <path d="M380 210L450 160V350L380 300V210Z" fill="white"/>
            </svg>
            <span className="hidden md:inline">
              Record a Fast {recordingMode === 'video' ? 'Video' : 'Audio'}
            </span>
            <span className="md:hidden inline">
              Record a<br />Fast {recordingMode === 'video' ? 'Video' : 'Audio'}
            </span>
          </h1>

          {/* Recording Mode Tabs */}
          <div className="mb-6">
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setRecordingMode('video')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                  recordingMode === 'video'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                📹 Video
              </button>
              <button
                onClick={() => setRecordingMode('audio')}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                  recordingMode === 'audio'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                🎙️ Audio Only
              </button>
            </div>
          </div>
          {channelName && (
            <>
              <div className="bg-white rounded-lg p-6 md:p-8 flex flex-col items-center gap-4 mb-4">
                <p className="text-gray-600 text-center text-base md:text-2xl">
                  A Fast Video is a quick video (or audio recording) you can record here, it's uploaded to the cloud and you get a link to share with others.
                </p>
              </div>
              <div className="bg-yellow-200 rounded-lg p-6 md:p-8 relative">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                  <div className="flex-1 flex flex-col items-center gap-4 w-full">
                    <p className="text-gray-600 text-center text-base md:text-2xl">
                      When it has been shared, at the end of the video, it will automatically take the viewer to this content:
                    </p>
                    <div className="text-center">
                      {destinationOption === 'other' && customDestination ? (
                        <a
                          href={customDestination}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-blue-600 underline text-base md:text-2xl"
                        >
                          {customDestination}
                        </a>
                      ) : channelExternalLink && channelExternalLinkName ? (
                        <a
                          href={channelExternalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-blue-600 underline text-base md:text-2xl"
                        >
                          {channelExternalLinkName}
                        </a>
                      ) : (
                        <a
                          href={channelHandle ? `/${channelHandle}` : '/'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-blue-600 underline text-base md:text-2xl"
                        >
                          Fast.Video Channel Page
                        </a>
                      )}
                      {' '}
                      <button
                        onClick={() => setShowDestinationModal(true)}
                        className="text-blue-600 hover:text-blue-800 underline text-base md:text-2xl"
                      >
                        (change)
                      </button>
                    </div>
                  </div>
                  <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 opacity-30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="black" viewBox="0 0 16 16">
                      <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                      <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!playbackUrl && !isPreparing && (
          <div className="bg-gray-900 rounded-lg p-8 border-2 border-gray-700">
            {recordingMode === 'video' ? (
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start justify-center">
                {/* Upload Section */}
                <div className={isMobile ? 'w-auto' : 'flex-1 w-full'}>
                  <MuxUploader
                    endpoint={createUpload}
                    onUploadStart={handleUploadStart}
                    onSuccess={handleSuccess}
                    onUploadError={handleError}
                    noDrop={isMobile}
                  >
                    {!isMobile && (
                      <span slot="heading">Drop a video file here to upload, or</span>
                    )}
                    <button slot="file-select" type="button" className="px-6 py-3 rounded font-medium transition-colors cursor-pointer" style={{ backgroundColor: '#FF0000' }}>
                      {isMobile ? 'Record or Upload Video' : 'Upload Video'}
                    </button>
                  </MuxUploader>
                  {isUploading && (
                    <div className="mt-4 text-center">
                      <p className="text-lg">Uploading your video...</p>
                    </div>
                  )}
                </div>

                {/* QR Code Section */}
                {!isMobile && (
                  <div className="flex-1 w-full text-center flex flex-col items-center justify-center">
                    <p className="text-gray-300 mb-4" style={{ fontSize: '1.75rem' }}>
                      Scan to record with a phone
                    </p>
                    {recordUrl && (
                      <div className="inline-block p-4 bg-white rounded-lg">
                        <QRCodeSVG
                          value={recordUrl}
                          size={150}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Audio Recording Section */
              <div className="flex flex-col items-center justify-center space-y-6">
                {!audioBlob ? (
                  <>
                    <div className="text-center">
                      {isRecording && (
                        <div className="mb-6">
                          <div className="inline-flex items-center gap-3 bg-red-600 px-6 py-3 rounded-lg">
                            <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
                            <span className="text-2xl font-bold">{formatTime(recordingTime)}</span>
                          </div>
                        </div>
                      )}
                      {!isRecording ? (
                        <button
                          onClick={startAudioRecording}
                          className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-xl transition-colors flex items-center gap-3"
                        >
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                          </svg>
                          Start Recording
                        </button>
                      ) : (
                        <button
                          onClick={stopAudioRecording}
                          className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-xl transition-colors"
                        >
                          Stop Recording
                        </button>
                      )}
                    </div>
                    {!isRecording && (
                      <p className="text-gray-400 text-center">
                        Click the button to start recording your audio message
                      </p>
                    )}
                  </>
                ) : (
                  <div className="relative bg-gray-800 rounded-lg border-2 border-gray-700 p-6">
                    {/* Close Button */}
                    <button
                      onClick={resetRecording}
                      className="absolute top-4 right-4 z-10 bg-gray-900 hover:bg-red-600 rounded-full p-2 transition-colors"
                      title="Reset and record new"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <div className="text-center space-y-4">
                      <div className="bg-green-900 border border-green-700 rounded-lg p-6">
                        <p className="text-green-300 text-lg mb-2">✓ Audio recorded successfully!</p>
                        <p className="text-gray-300 mb-4">Duration: {formatTime(recordingTime)}</p>
                        {audioBlobUrl && (
                          <audio
                            controls
                            src={audioBlobUrl}
                            className="w-full max-w-md mx-auto"
                            style={{ marginTop: '1rem' }}
                          />
                        )}
                      </div>
                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={() => {
                            // Clear audio data (data URLs don't need revocation)
                            setAudioBlob(null);
                            setAudioBlobUrl(null);
                            setRecordingTime(0);
                          }}
                          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                        >
                          Re-record
                        </button>
                        <button
                          onClick={uploadAudioRecording}
                          disabled={isUploading}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          {isUploading ? 'Uploading...' : 'Upload Audio'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isPreparing && (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg">Processing your {recordingMode === 'video' ? 'video' : 'audio'}...</p>
            <p className="text-gray-400 text-sm mt-2">This may take a minute</p>
          </div>
        )}

        {playbackUrl && (
          <div className="relative bg-gray-800 rounded-lg border-2 border-gray-700 p-6">
            {/* Close Button */}
            <button
              onClick={resetRecording}
              className="absolute top-4 right-4 z-10 bg-gray-900 hover:bg-red-600 rounded-full p-2 transition-colors"
              title="Reset and record new"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="space-y-6">
              {/* Channel Thumbnail for Audio-Only */}
              {recordingMode === 'audio' && channelThumbnail && (
                <div className="flex justify-center mb-4">
                  <img
                    src={getThumbnailUrl(channelThumbnail)}
                    alt={channelName || 'Channel'}
                    className="rounded-lg max-w-md w-full"
                  />
                </div>
              )}
              {recordingMode === 'audio' ? (
              /* Audio Player for Audio-Only Mode */
              <div className="bg-gray-900 rounded-lg p-8 flex justify-center">
                <MuxPlayer
                  playbackId={playbackUrl.split('/').pop()?.replace('.m3u8', '') || ''}
                  streamType="on-demand"
                  autoPlay
                  audio
                  onEnded={() => setShowVideoEndedOverlay(true)}
                  style={{ width: '100%', maxWidth: '700px' }}
                />
              </div>
            ) : (
              /* Video Player for Video Mode */
              <div className="bg-gray-900 rounded-lg overflow-hidden relative">
                <MuxPlayer
                  key={videoKey}
                  ref={playerRef}
                  playbackId={playbackUrl.split('/').pop()?.replace('.m3u8', '') || ''}
                  poster={
                    overrideVideoThumbnail && channelThumbnail
                      ? getThumbnailUrl(channelThumbnail)
                      : `https://image.mux.com/${playbackUrl.split('/').pop()?.replace('.m3u8', '')}/thumbnail.jpg?width=1200&height=675&fit_mode=smartcrop`
                  }
                  metadata={{
                    video_title: 'Hello Video',
                  }}
                  onPlay={() => setShowVideoEndedOverlay(false)}
                  onEnded={() => setShowVideoEndedOverlay(true)}
                />
                {showVideoEndedOverlay && (
                  <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-white text-xl md:text-2xl max-w-2xl">
                      When it has been shared, at the end of the video, it will automatically take the viewer to the content specified above.
                    </p>
                  </div>
                )}
              </div>
            )}
            {showVideoEndedOverlay && recordingMode === 'audio' && (
              <div className="bg-black bg-opacity-90 rounded-lg p-8 text-center">
                <p className="text-white text-xl md:text-2xl max-w-2xl mx-auto">
                  When it has been shared, at the end of the audio, it will automatically take the viewer to the content specified above.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {/* Temporarily hidden - uncomment to enable Toggle Video Thumbnail button */}
              {/* {recordingMode === 'video' && (
                <button
                  onClick={toggleVideoThumbnail}
                  className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-lg"
                >
                  Toggle Video Thumbnail
                </button>
              )} */}
              <button
                onClick={copyShareLink}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-lg"
              >
                {recordingMode === 'video' ? 'Copy Video Link for Sharing' : 'Copy Link for Sharing'}
              </button>
              <button
                onClick={() => {
                  const shareUrl = getShareableUrl();
                  window.open(shareUrl, '_blank');
                }}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors text-lg"
              >
                Test in new tab
              </button>
            </div>
            </div>
          </div>
        )}

        {/* Destination Modal */}
        {showDestinationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Change End of Video Destination
              </h2>

              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="destination"
                    checked={destinationOption === 'default'}
                    onChange={() => setDestinationOption('default')}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-900">
                    Default destination
                    {channelExternalLinkName && (
                      <span className="text-gray-600 ml-2">
                        ({channelExternalLinkName}{' '}
                        <a
                          href={`/update`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          change
                        </a>
                        )
                      </span>
                    )}
                  </span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="destination"
                    checked={destinationOption === 'other'}
                    onChange={() => setDestinationOption('other')}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-900">Other</span>
                </label>

                <input
                  type="text"
                  placeholder="Enter any web URL"
                  value={customDestination}
                  onChange={(e) => setCustomDestination(e.target.value)}
                  disabled={destinationOption !== 'other'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveDestination}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ok
                </button>
                <button
                  onClick={() => setShowDestinationModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
