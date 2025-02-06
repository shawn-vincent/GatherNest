import React, { useEffect, useRef } from 'react';
import './LocalVideoPreview.css';
import { log } from '../utils/logger';

function LocalVideoPreview({ stream, isMuted, onToggleMute, avatar, name }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      log("\uD83C\uDFA5", "LocalVideoPreview: Assigned stream to video element");
    }
  }, [stream]);

  return (
    <div className="local-video-preview" id="localVideoWrapper">
      <video id="localVideo" ref={videoRef} autoPlay playsInline muted={!isMuted} />
      <div className="mute-button" id="muteBtn" onClick={onToggleMute}>
        {isMuted ? 'Unmute' : 'Mute'}
      </div>
      {avatar && <img className="avatar" src={avatar} alt="Avatar" />}
      {name && <div className="name-label">{name}</div>}
    </div>
  );
}

export default LocalVideoPreview;
