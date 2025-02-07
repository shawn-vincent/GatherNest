import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import Avatar from '../components/Avatar';
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
      log("💻", "Lobby: Received roomsList", roomsList);
      setRooms(roomsList);
    });

    // Request local media
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true
    })
      .then(stream => {
        log("🎥", "Lobby: Got local media stream");
        setLocalStream(stream);
      })
      .catch(err => {
        logError("🚫", "Lobby: Error accessing camera", err);
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
        track.enabled = isMuted;
      });
      log("🔇", "Lobby: " + (isMuted ? "Muted" : "Unmuted") + " local audio");
    }
  };

  const createRoom = () => {
    if (!roomName.trim()) {
      alert("Room Name is required.");
      return;
    }
    socket.emit('createRoom', { roomName: roomName.trim() });
  };

  const joinRoom = (safeName) => {
    navigate("/room?url=" + encodeURIComponent(safeName));
  };

  return (
    <div className="lobby">
      <header id="header">
        <h1>Welcome to GatherNest</h1>
      </header>

      <div className="lobby-controls">
        <h2>Available Gathering Spaces</h2>
        <div id="roomList">
          {rooms.length === 0 ? (
            <p>(No spaces available)</p>
          ) : (
            rooms.map((r) => (
              <div key={r.safeName} className="roomRow" onClick={() => joinRoom(r.safeName)}>
                {r.displayName} - {r.count} {r.count === 1 ? 'guest' : 'guests'}
              </div>
            ))
          )}
        </div>

        <input
          id="newRoomName"
          type="text"
          placeholder="Name your Gathering Space"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <button id="createRoomBtn" onClick={createRoom}>＋ Create Space</button>
      </div>

      {/* Local Video Preview in lower-left corner, matching Room.js */}
      {localStream && (
        <div className="local-avatar">
          <Avatar
              name="You"
	      stream={localStream}
              style={{ width: '220px', height: '150px' }}
          />
        </div>
      )}
    </div>
  );
}

export default Lobby;
