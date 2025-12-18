'use client';

import { useState, useEffect } from 'react';
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
  const [recordUrl, setRecordUrl] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [channelLoading, setChannelLoading] = useState<boolean>(true);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [destinationOption, setDestinationOption] = useState<'default' | 'other'>('default');
  const [customDestination, setCustomDestination] = useState('');
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [ogData, setOgData] = useState<{
    image: string | null;
    title: string | null;
    description: string | null;
  } | null>(null);

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
  }, []);

  // Set the current URL for QR code and detect mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRecordUrl(window.location.href);
      // Detect if device is mobile
      const checkIsMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(checkIsMobile);
    }
  }, []);

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
            console.log('Saving video metadata with channelId:', channelId);
            const saveRes = await fetch('/api/videos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                playbackId,
                thumbnailUrl,
                channelId: channelId, // Associate with channel from subdomain
                altDestination: destinationOption === 'other' ? customDestination : null,
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
  }, [isPreparing, uploadId, channelId]);

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

  const handleSaveDestination = async () => {
    // Update link preview visibility based on selection
    if (destinationOption === 'other' && customDestination) {
      setShowLinkPreview(true);

      // Fetch OpenGraph data for the custom destination
      try {
        const ogResponse = await fetch('/api/opengraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: customDestination }),
        });

        if (ogResponse.ok) {
          const ogData = await ogResponse.json();
          setOgData(ogData);
        }
      } catch (err) {
        console.error('Error fetching OpenGraph data:', err);
      }
    } else {
      setShowLinkPreview(false);
      setOgData(null);
    }

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
              Record a Fast Video
            </span>
            <span className="md:hidden inline">
              Record a<br />Fast Video
            </span>
          </h1>
          {channelName && (
            <div className="bg-white rounded-lg p-6 md:p-8 flex flex-col items-center gap-4">
              <p className="text-gray-600 text-center text-base md:text-2xl">
                A Fast Video is a quick video you can record here, it's uploaded to the cloud and you get a link to share with others. When it has been shared, at the end of the video, it will automatically take the viewer to this content:
              </p>
              {showLinkPreview ? (
                <div className="w-full border border-gray-300 rounded-lg overflow-hidden bg-white">
                  {ogData?.image && (
                    <img
                      src={ogData.image}
                      alt={ogData.title || 'Link preview'}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="p-4">
                    {ogData?.title && (
                      <h3 className="text-black font-semibold text-lg mb-2">
                        {ogData.title}
                      </h3>
                    )}
                    {ogData?.description && (
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                        {ogData.description}
                      </p>
                    )}
                    <a
                      href={customDestination}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 break-all text-xs"
                    >
                      {customDestination}
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {channelThumbnail && (
                    <img
                      src={getThumbnailUrl(channelThumbnail)}
                      alt={channelName}
                      className="w-24 h-24 rounded-full"
                    />
                  )}
                  <strong className="text-black text-2xl md:text-4xl text-center">
                    {channelName.split('|').map((part, index, array) => (
                      <span key={index}>
                        {part}
                        {index < array.length - 1 && <br />}
                      </span>
                    ))}
                  </strong>
                </>
              )}
              <button
                onClick={() => setShowDestinationModal(true)}
                className="text-blue-600 hover:text-blue-800 underline text-lg md:text-xl mt-2"
              >
                Change end of video redirect address
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!playbackUrl && !isPreparing && (
          <div className="bg-gray-900 rounded-lg p-8">
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
            {!isMobile && (
              <div className="mt-6 text-center">
                <p className="text-gray-300 text-xl mb-4">
                  Record using your mobile phone using this QR Code
                </p>
                {recordUrl && (
                  <div className="inline-block p-4 bg-white rounded-lg">
                    <QRCodeSVG
                      value={recordUrl}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                )}
              </div>
            )}
            {isUploading && (
              <div className="mt-4 text-center">
                <p className="text-lg">Uploading your video...</p>
              </div>
            )}
          </div>
        )}

        {isPreparing && (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg">Processing your video...</p>
            <p className="text-gray-400 text-sm mt-2">This may take a minute</p>
          </div>
        )}

        {playbackUrl && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              <MuxPlayer
                playbackId={playbackUrl.split('/').pop()?.replace('.m3u8', '') || ''}
                metadata={{
                  video_title: 'Hello Video',
                }}
              />
            </div>

            <div className="text-center">
              <button
                onClick={copyShareLink}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-lg"
              >
                Copy Video Link for Sharing
              </button>
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
                  <span className="text-gray-900">Default destination</span>
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
