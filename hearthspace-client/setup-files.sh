#!/bin/bash
# setup-files.sh
# This script creates all source files for the "hearthspace-full" React project.
# It includes full functionality: pages, components, centralized socket, and library code.
# It uses string concatenation (instead of template literals) to avoid Unicode escape errors.
# Your server (server.js) remains unchanged.

set -e

echo "Creating folders for components, pages, lib, and utils..."
mkdir -p src/components src/pages src/lib src/utils

########################################
# src/index.js (React 18 entry point)
########################################
cat > src/index.js << 'EOF'
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Add any global styles here

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

########################################
# src/App.js (Routing with React Router v6)
########################################
cat > src/App.js << 'EOF'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Lobby from './pages/Lobby';
import Room from './pages/Room';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/index.html" element={<Lobby />} />
        <Route path="/room" element={<Room />} />
      </Routes>
    </Router>
  );
}

export default App;
EOF

########################################
# src/socket.js (Centralized Socket.io instance)
########################################
cat > src/socket.js << 'EOF'
import { io } from 'socket.io-client';

// Change the URL if your server is hosted elsewhere
const socket = io("http://localhost:4000");

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});
socket.on('reconnect_error', (err) => {
  console.error('Socket reconnect error:', err);
});
socket.on('reconnect_failed', () => {
  console.error('Socket failed to reconnect.');
});

export default socket;
EOF

########################################
# src/utils/logger.js (Logging Helper)
########################################
cat > src/utils/logger.js << 'EOF'
export function log(emoji, message, ...data) {
  const timestamp = new Date().toISOString();
  if (data.length > 0) {
    console.log("[" + timestamp + "] " + emoji + " " + message, ...data);
  } else {
    console.log("[" + timestamp + "] " + emoji + " " + message);
  }
}

export function logError(emoji, message, ...data) {
  const timestamp = new Date().toISOString();
  if (data.length > 0) {
    console.error("[" + timestamp + "] " + emoji + " " + message, ...data);
  } else {
    console.error("[" + timestamp + "] " + emoji + " " + message);
  }
}
EOF

########################################
# src/components/LocalVideoPreview.js (Local Video Preview Component)
########################################
cat > src/components/LocalVideoPreview.js << 'EOF'
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
EOF

########################################
# src/components/LocalVideoPreview.css (Styling)
########################################
cat > src/components/LocalVideoPreview.css << 'EOF'
.local-video-preview {
  position: fixed;
  bottom: 10px;
  right: 10px;
  width: 220px;
  background: rgba(0, 0, 0, 0.1);
  border: 4px solid #FFFFFF;
  border-radius: 15px;
  overflow: hidden;
  z-index: 1000;
}

#localVideo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.8;
  display: block;
}

.mute-button {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background: rgba(255,255,255,0.7);
  color: #000;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  z-index: 1010;
}
EOF

########################################
# src/components/ClusterLayoutWrapper.js (Wraps clusterLayout.js)
########################################
cat > src/components/ClusterLayoutWrapper.js << 'EOF'
import React, { useEffect, useRef } from 'react';
import ClusterLayout from '../lib/clusterLayout';
import { log } from '../utils/logger';

function ClusterLayoutWrapper({ options, nodes = [] }) {
  const containerRef = useRef(null);
  const clusterLayoutRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && !clusterLayoutRef.current) {
      clusterLayoutRef.current = new ClusterLayout(containerRef.current, options);
      log("\uD83E\uDDE9", "ClusterLayoutWrapper: Initialized ClusterLayout", options);
    }
    if (clusterLayoutRef.current) {
      // Clear and update nodes based on the nodes prop
      clusterLayoutRef.current.nodes = [];
      nodes.forEach(nodeData => {
        clusterLayoutRef.current.addNode(nodeData);
      });
      clusterLayoutRef.current.simulation.alphaTarget(0.6).restart();
      log("\uD83E\uDDE9", "ClusterLayoutWrapper: Updated nodes", nodes);
    }
  }, [options, nodes]);

  return <div ref={containerRef} id="clusterContainer" style={{ width: '100vw', height: '100vh' }} />;
}

export default ClusterLayoutWrapper;
EOF

########################################
# src/lib/clusterLayout.js (Original D3 Layout Library)
########################################
cat > src/lib/clusterLayout.js << 'EOF'
import * as d3 from 'd3';

/**
 * ClusterLayout - A reusable client‑side JavaScript library for creating dynamic,
 * force‑directed, clustered layouts.
 * (Original functionality and nuances are preserved.)
 */
class ClusterLayout {
  constructor(container, options = {}) {
    if (!container) {
      throw new Error("Container element or selector is required.");
    }
    this.container =
      typeof container === "string" ? document.querySelector(container) : container;
    if (!(this.container instanceof HTMLElement)) {
      throw new Error("Container must be a valid HTMLElement or selector.");
    }
    this.initialNodes = options.initialNodes || [];
    this.onSelect = options.onSelect || function () {};
    this.baseSize = 30;
    this.selectedWidthPercent = 0.2;
    this.selectedMinWidth = 100;
    this.transitionDuration = options.transitionDuration || 500;
    this.movementSpeed = options.movementSpeed || 1;
    this.removalTransitionDuration = options.removalTransitionDuration || 500;
    this.clusterScale = (typeof options.clusterScale === "number") ? options.clusterScale : 0.6;
    this.layoutOnViewport = !!options.layoutOnViewport;
    this.nodes = [];
    this.nodeMap = new Map();
    this.simulation = null;
    this.factor = 1;
    if (this.layoutOnViewport) {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      Object.assign(this.container.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        pointerEvents: "none"
      });
    } else {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
    }
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.nextId = this.initialNodes.length ? this.initialNodes.length + 1 : 1;
    if (!this.layoutOnViewport) {
      this.container.style.position = "relative";
    }
    this._initSimulation();
    this.initialNodes.forEach(nodeData => this.addNode(nodeData));
    this._render();
    window.addEventListener("resize", () => this._onResize());
  }

  getSelectedDimensions() {
    const baseSelWidth = Math.max(this.width * this.selectedWidthPercent, this.selectedMinWidth);
    const adjustment = 0.75;
    const selectedScale = Math.min(1, this.factor * adjustment);
    const selWidth = baseSelWidth * selectedScale;
    return { width: selWidth, height: selWidth * 0.75 };
  }

  getUnselectedDimensions() {
    const computedWidth = (this.baseSize * this.factor) * 2;
    const computedHeight = (this.baseSize * this.factor) * 1.5;
    const maxWidth = 100;
    const maxHeight = 75;
    return {
      width: Math.min(computedWidth, maxWidth),
      height: Math.min(computedHeight, maxHeight)
    };
  }

  _initSimulation() {
    this.simulation = d3.forceSimulation(this.nodes)
      .force("x", d3.forceX(this.centerX).strength(0.15 * this.movementSpeed))
      .force("y", d3.forceY(this.centerY).strength(0.15 * this.movementSpeed))
      .force("charge", d3.forceManyBody().strength(-1 * this.movementSpeed))
      .force("collide", d3.forceCollide().radius(d => {
        return d.isSelected ?
          this.getSelectedDimensions().width / 2 + 2 :
          this.getUnselectedDimensions().width / 2 + 2;
      }).iterations(10))
      .alphaDecay(0.05)
      .on("tick", () => this._ticked());
    this.simulation.velocityDecay(0.9);
  }

  _render() {
    this.containerSelection = d3.select(this.container)
      .selectAll(".cluster-node")
      .data(this.nodes, d => d.id);
    this.containerSelection.exit().remove();
    const enterSelection = this.containerSelection.enter()
      .append("div")
      .attr("class", "cluster-node")
      .style("border-color", d => d.borderColor)
      .each((d, i, nodes) => {
        const nodeEl = nodes[i];
        const dims = d.isSelected ? this.getSelectedDimensions() : this.getUnselectedDimensions();
        nodeEl.style.width = dims.width + "px";
        nodeEl.style.height = dims.height + "px";
        nodeEl.style.transform = "translate(" + (d.x - dims.width / 2) + "px, " + (d.y - dims.height / 2) + "px)";
        if (d.contentType === "videoStream") {
          // Peer streams will be added via React updates.
        } else if (d.contentType === "text") {
          const div = document.createElement("div");
          div.className = "initials";
          div.textContent = d.content;
          nodeEl.appendChild(div);
        } else if (d.contentType === "image") {
          const img = document.createElement("img");
          img.src = d.content;
          nodeEl.appendChild(img);
        } else if (d.contentType === "html") {
          const div = document.createElement("div");
          div.innerHTML = d.content;
          nodeEl.appendChild(div);
        } else if (d.contentType === "avataaars") {
          const img = document.createElement("img");
          img.src = d.content || "";
          nodeEl.appendChild(img);
        }
        nodeEl.addEventListener("click", () => this._toggleNode(d.id));
      });
    this.containerSelection = enterSelection.merge(this.containerSelection);
  }

  _ticked() {
    if (!this.containerSelection) return;
    this.containerSelection
      .style("transform", d => {
        const dims = d.isSelected ? this.getSelectedDimensions() : this.getUnselectedDimensions();
        return "translate(" + (d.x - dims.width / 2) + "px, " + (d.y - dims.height / 2) + "px)";
      });
  }

  _toggleNode(id) {
    const node = this.nodes.find(n => n.id === id);
    if (!node) return;
    node.isSelected = !node.isSelected;
    this.simulation.force("collide", d3.forceCollide().radius(d => {
      return d.isSelected ?
        this.getSelectedDimensions().width / 2 + 2 :
        this.getUnselectedDimensions().width / 2 + 2;
    }).iterations(10));
    this.simulation.alphaTarget(0.6).restart();
    this._render();
  }

  addNode(nodeData) {
    if (!nodeData || typeof nodeData.id !== "string") {
      throw new Error("addNode: nodeData with a unique string 'id' is required.");
    }
    const validTypes = ["text", "video", "image", "html", "videoStream", "avataaars"];
    if (!validTypes.includes(nodeData.contentType)) {
      throw new Error("addNode: contentType must be one of " + validTypes.join(", ") + ".");
    }
    let startX, startY;
    if (nodeData.startPosition) {
      if (nodeData.startPosition instanceof HTMLElement) {
        const containerRect = this.container.getBoundingClientRect();
        const elementRect = nodeData.startPosition.getBoundingClientRect();
        startX = elementRect.left + elementRect.width / 2 - containerRect.left;
        startY = elementRect.top + elementRect.height / 2 - containerRect.top;
      } else if (typeof nodeData.startPosition.x === "number" && typeof nodeData.startPosition.y === "number") {
        startX = nodeData.startPosition.x;
        startY = nodeData.startPosition.y;
      } else {
        startX = Math.random() * this.width;
        startY = Math.random() * this.height;
      }
    } else {
      startX = Math.random() * this.width;
      startY = Math.random() * this.height;
    }
    const newNode = {
      id: nodeData.id,
      contentType: nodeData.contentType,
      content: nodeData.content,
      borderColor: nodeData.borderColor || this._getRandomColor(),
      displayName: nodeData.displayName || "",
      isSelected: false,
      x: startX,
      y: startY
    };
    this.nodes.push(newNode);
    this.nodeMap.set(newNode.id, newNode);
    this._render();
    this.simulation.nodes(this.nodes);
    this.simulation.alphaTarget(0.6).restart();
  }

  removeNode(nodeId) {
    if (typeof nodeId !== "string") {
      throw new Error("removeNode: nodeId must be a string.");
    }
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.nodeMap.delete(nodeId);
    this._render();
    this.simulation.nodes(this.nodes);
    this.simulation.alphaTarget(0.6).restart();
  }

  _getRandomColor() {
    return "hsl(" + (Math.random() * 360) + ", 70%, 60%)";
  }
}

export default ClusterLayout;
EOF

########################################
# Write src/pages/Lobby.js (Lobby Page)
########################################
cat > src/pages/Lobby.js << 'EOF'
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
EOF

########################################
# Write src/pages/Lobby.css (Lobby Styling)
########################################
cat > src/pages/Lobby.css << 'EOF'
.lobby {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  color: white;
  background: gray;
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  min-height: 100vh;
}

#header {
  background: rgba(0,0,0,0.4);
  padding: 10px;
  text-align: center;
}

.lobby-controls {
  margin: 10px auto;
  display: inline-block;
  background: rgba(0,0,0,0.4);
  border-radius: 6px;
  padding: 10px;
  max-width: 600px;
  text-align: left;
}

.roomRow {
  margin: 4px;
  padding: 4px;
  cursor: pointer;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
}

.roomRow:hover {
  background: rgba(255,255,255,0.2);
}

input#newRoomName {
  width: 180px;
  padding: 4px;
  margin-top: 8px;
}

button#createRoomBtn {
  padding: 4px 8px;
  margin-left: 4px;
}
EOF

########################################
# Write src/pages/Room.js (Room Page)
########################################
cat > src/pages/Room.js << 'EOF'
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import socket from '../socket';
import SimplePeer from 'simple-peer';
import LocalVideoPreview from '../components/LocalVideoPreview';
import ClusterLayoutWrapper from '../components/ClusterLayoutWrapper';
import './Room.css';
import { log, logError } from '../utils/logger';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Room() {
  const query = useQuery();
  const safeName = query.get('url');
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [peerNodes, setPeerNodes] = useState([]);
  const [peers, setPeers] = useState({});

  useEffect(() => {
    if (!safeName) {
      alert("No room specified.");
      return;
    }
    log("\uD83D\uDEAA", "Room: Emitting joinRoom for", safeName);
    socket.emit('joinRoom', safeName);

    // Request local media
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true
    })
      .then(stream => {
        log("\uD83C\uDFA5", "Room: Got local media stream");
        setLocalStream(stream);
      })
      .catch(err => {
        logError("\uD83D\uDEAE", "Room: Error accessing camera", err);
        alert("Error accessing camera: " + err.message);
      });

    socket.on('peerConnect', (data) => {
      const { peerId, name } = data;
      log("\uD83D\uDC49", "Room: Received peerConnect from", peerId);
      if (!localStream) {
        log("\u23F3", "Room: Local stream not ready; ignoring peerConnect", peerId);
        return;
      }
      if (!peers[peerId]) {
        const isInitiator = (socket.id > peerId);
        const peer = new SimplePeer({
          initiator: isInitiator,
          trickle: false,
          stream: localStream
        });
        peer.on('signal', (signalData) => {
          log("\uD83D\uDCF1", "Room: Peer signal event for", peerId, signalData);
          socket.emit('signal', { signal: signalData, peerId });
        });
        peer.on('stream', (remoteStream) => {
          log("\uD83D\uDCFA", "Room: Received remote stream for peer", peerId);
          setPeerNodes(prev => {
            const filtered = prev.filter(n => n.id !== peerId);
            return [
              ...filtered,
              {
                id: peerId,
                contentType: "videoStream",
                content: remoteStream,
                borderColor: "#FFFFFF",
                displayName: name || "Anonymous",
                startPosition: { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight }
              }
            ];
          });
        });
        peer.on('close', () => {
          log("\uD83D\uDD12", "Room: Peer connection closed for", peerId);
          setPeerNodes(prev => prev.filter(n => n.id !== peerId));
          setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[peerId];
            return newPeers;
          });
        });
        setPeers(prev => ({ ...prev, [peerId]: peer }));
      }
    });

    socket.on('signal', (data) => {
      const { peerId, signal } = data;
      log("\uD83D\uDCF1", "Room: Received signal for peer", peerId, signal);
      if (peers[peerId]) {
        peers[peerId].signal(signal);
      }
    });

    socket.on('peerDisconnect', ({ peerId }) => {
      log("\uD83D\uDC4B", "Room: Peer disconnected", peerId);
      if (peers[peerId]) {
        peers[peerId].destroy();
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[peerId];
          return newPeers;
        });
        setPeerNodes(prev => prev.filter(n => n.id !== peerId));
      }
    });

    return () => {
      socket.off('peerConnect');
      socket.off('signal');
      socket.off('peerDisconnect');
    };
  }, [safeName, localStream, peers]);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      log("\uD83D\uDD07", "Room: " + (isMuted ? "Muted" : "Unmuted") + " local audio");
    }
  };

  return (
    <div className="room">
      <header id="header">
        <h1>HearthSpace - Room</h1>
      </header>
      <ClusterLayoutWrapper options={{ layoutOnViewport: true }} nodes={peerNodes} />
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

export default Room;
EOF

########################################
# Write src/pages/Room.css (Room Styling)
########################################
cat > src/pages/Room.css << 'EOF'
.room {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  color: white;
  background: black;
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  min-height: 100vh;
}

#header {
  background: rgba(0,0,0,0.4);
  padding: 10px;
  text-align: center;
}

#clusterContainer {
  position: relative;
  width: 100vw;
  height: 100vh;
  z-index: 10;
}
EOF

echo "Project setup complete."
echo "To run the project, navigate to the 'hearthspace-full' directory and run 'npm start'."
