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
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [ogData, setOgData] = useState<{
    image: string | null;
    title: string | null;
    description: string | null;
  } | null>(null);
  const [showVideoEndedOverlay, setShowVideoEndedOverlay] = useState(false);
  const [overrideVideoThumbnail, setOverrideVideoThumbnail] = useState(false);
  const [videoKey, setVideoKey] = useState(0);
  const playerRef = useRef<any>(null);

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

            // If there's an external link and no URL param override, fetch OpenGraph data
            if (data.externalLink && !new URLSearchParams(window.location.search).get('dest')) {
              setShowLinkPreview(true);
              try {
                const ogResponse = await fetch('/api/opengraph', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: data.externalLink }),
                });

                if (ogResponse.ok) {
                  const ogData = await ogResponse.json();
                  setOgData(ogData);
                  setCustomDestination(data.externalLink);
                }
              } catch (err) {
                console.error('Error fetching OpenGraph data for external link:', err);
              }
            }
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
              if (data.externalLink) {
                // Clear old preview data before fetching new one
                setOgData(null);
                setShowLinkPreview(true);

                // Fetch OpenGraph data for the external link
                const ogResponse = await fetch('/api/opengraph', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: data.externalLink }),
                });

                if (ogResponse.ok) {
                  const ogData = await ogResponse.json();
                  setOgData(ogData);
                  setCustomDestination(data.externalLink);
                }
              } else {
                setShowLinkPreview(false);
                setOgData(null);
              }
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
        setShowLinkPreview(true);

        // Fetch OpenGraph data for the destination
        fetch('/api/opengraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: altDest }),
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) setOgData(data);
          })
          .catch(err => console.error('Error fetching OpenGraph data:', err));
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
              <div className="text-center">
                <span className="text-gray-900 font-medium text-base md:text-lg">
                  {destinationOption === 'other' && customDestination
                    ? customDestination
                    : channelExternalLinkName || 'Channel page'}
                </span>
                {' '}
                <button
                  onClick={() => setShowDestinationModal(true)}
                  className="text-blue-600 hover:text-blue-800 underline text-base md:text-lg"
                >
                  (change)
                </button>
              </div>
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

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={toggleVideoThumbnail}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-lg"
              >
                Toggle Video Thumbnail
              </button>
              <button
                onClick={copyShareLink}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-lg"
              >
                Copy Video Link for Sharing
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
