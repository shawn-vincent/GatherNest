import React, { useEffect, useRef, useState } from 'react';
import { Microphone, MicrophoneSlash, VideoCamera, VideoCameraSlash } from '@phosphor-icons/react';
import './Avatar.css';

function Avatar({ stream, name, showControls=true, style = {}, additionalIcons = [] }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      stream.getAudioTracks().forEach(track => (track.enabled = !isMuted));
      stream.getVideoTracks().forEach(track => (track.enabled = !isVideoMuted));
    }
  }, [stream, isMuted, isVideoMuted]);

  const toggleMute = () => setIsMuted(prev => !prev);
  const toggleVideo = () => setIsVideoMuted(prev => !prev);

  return (
      <div className="avatar-container" style={style}>
	  {/* Floating Icons (Left Side) */}
      {showControls && (
	  <div className="avatar-icons">
	      {/* Mute/Unmute Toggle */}
	      <div className="avatar-icon" onClick={toggleMute}
		   title={isMuted ? "Unmute" : "Mute"}>
		  {isMuted ? <MicrophoneSlash size={24} /> : <Microphone size={24} />}
	      </div>
	      
	      {/* Video On/Off Toggle */}
	      <div className="avatar-icon" onClick={toggleVideo}
		   title={isVideoMuted ? "Turn Video On" : "Turn Video Off"}>
		  {isVideoMuted ? <VideoCameraSlash size={24} /> : <VideoCamera size={24} />}
	      </div>
	      
	      {/* Additional Icons */}
	      {additionalIcons.map((icon, index) => (
		  <div key={index} className="avatar-icon">{icon}</div>
	      ))}
	  </div>
      )}

      {/* Avatar Frame */}
      <div className={`avatar ${isMuted ? 'muted' : 'active'}`}>
          {!isVideoMuted && stream
	   ? (
               <video ref={videoRef} autoPlay playsInline muted={isMuted} />
           )
	   : isVideoMuted
	   ? (
               <div className="video-off-placeholder">Video Off</div>
           )
	   : ( // no stream but not muted.
               <div className="video-off-placeholder">Loading...</div>
           )
	  }
      </div>

      {/* Name Label */}
      {name && <div className="name-label">{name}</div>}
    </div>
  );
}

export default Avatar;
