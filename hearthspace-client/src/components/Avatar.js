import React, { useEffect, useRef } from 'react';
import './Avatar.css';
import { log } from '../utils/logger';

function Avatar({
  type = 'video', // 'video', 'svg', 'initials', 'image'
  stream,
  isMuted,
  onToggleMute,
  avatarSrc,  // For static images or svg URLs
  initials,   // For user initials
  name,
  style = {}
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    // If type is video and we have a stream, assign it
    if (type === 'video' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      log("\uD83C\uDFA5", "Avatar: Assigned stream to video element");
    }
  }, [stream, type]);

  // Render based on the type prop
  const renderContent = () => {
    switch (type) {
      case 'video':
        return stream ? (
          <video ref={videoRef} autoPlay playsInline muted={isMuted} />
        ) : (
          <div className="placeholder">Connecting...</div>
        );
      case 'svg':
        return avatarSrc ? (
          <img src={avatarSrc} alt="SVG Avatar" className="avatar-content" />
        ) : (
          <div className="placeholder">No Avatar</div>
        );
      case 'initials':
        return (
          <div className="avatar-initials">
            {initials || (name ? name.charAt(0).toUpperCase() : '')}
          </div>
        );
      case 'image':
        return avatarSrc ? (
          <img src={avatarSrc} alt="User Avatar" className="avatar-content" />
        ) : (
          <div className="placeholder">No Avatar</div>
        );
      default:
        return <div className="placeholder">No Content</div>;
    }
  };

  return (
    <div className="avatar" style={style}>
      {renderContent()}
      {type === 'video' && onToggleMute && (
        <div className="mute-button" onClick={onToggleMute}>
          {isMuted ? 'Unmute' : 'Mute'}
        </div>
      )}
      {name && <div className="name-label">{name}</div>}
    </div>
  );
}

export default Avatar;
