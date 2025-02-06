import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import LocalVideoPreview from '../components/LocalVideoPreview';
import './Lobby.css';
import { log, logError } from '../utils/logger';

function Lobby() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    socket.on('roomsList', (roomsList) => {
      log("\uD83D\uDCBB", "Lobby: Received roomsList", roomsList);
      setRooms(roomsList);
    });

    // Request local media
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true
    })
      .then(stream => {
        log("\uD83C\uDFA5", "Lobby: Got local media stream");
        setLocalStream(stream);
      })
      .catch(err => {
        logError("\uD83D\uDEAE", "Lobby: Error accessing camera", err);
        alert("Error accessing camera: " + err.message);
      });

    return () => {
      socket.off('roomsList');
    };
  }, []);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted; // toggle audio state
      });
      log("\uD83D\uDD07", "Lobby: " + (isMuted ? "Muted" : "Unmuted") + " local audio");
    }
  };

  const createRoom = () => {
    if (!roomName.trim()) {
      log("\u26A0\uFE0F", "Lobby: Room Name is required.");
      alert("Room Name is required.");
      return;
    }
    log("\uD83C\uDFD7\uFE0F", "Lobby: Creating room", roomName.trim());
    socket.emit('createRoom', { roomName: roomName.trim() });
  };

  const joinRoom = (safeName) => {
    log("\uD83D\uDC49", "Lobby: Joining room", safeName);
    navigate("/room?url=" + encodeURIComponent(safeName));
  };

  return (
    <div className="lobby">
      <header id="header">
        <h1>HearthSpace - Lobby</h1>
      </header>
      <div className="lobby-controls">
        <h2>Existing Rooms</h2>
        <div id="roomList">
          {rooms.length === 0 ? (
            <p>(No rooms available)</p>
          ) : (
            rooms.map((r) => (
              <div key={r.safeName} className="roomRow" onClick={() => joinRoom(r.safeName)}>
                {r.displayName} - {r.count} {r.count === 1 ? 'user' : 'users'}
              </div>
            ))
          )}
        </div>
        <input
          id="newRoomName"
          type="text"
          placeholder="New Room Name"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <button id="createRoomBtn" onClick={createRoom}>＋</button>
      </div>

      {/* New "Misc" section with extra links */}
      <div className="misc-links">
        <h2>Misc</h2>
        <p className="roomRow">
          <a href="http://0.0.0.0:7860/" target="_blank" rel="noopener noreferrer">
            Stable Diffusion UI (local only)
          </a>
        </p>
        <p className="roomRow">
          <a href="live-force-directed-demo.html" target="_blank" rel="noopener noreferrer">
            Cluster demo
          </a>
        </p>
      </div>

      {localStream && (
        <LocalVideoPreview
          stream={localStream}
          isMuted={isMuted}
          onToggleMute={handleMuteToggle}
        />
      )}
    </div>
  );
}

export default Lobby;
