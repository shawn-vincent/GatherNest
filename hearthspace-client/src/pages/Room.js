import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socket from '../socket';
import SimplePeer from 'simple-peer';
import Avatar from '../components/Avatar';
import ClusterLayout from '../components/ClusterLayout';
import './Room.css';
import { log, logError } from '../utils/logger';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Room() {
  const query = useQuery();
  const safeName = query.get('url');
  const navigate = useNavigate();
  const [roomConfig, setRoomConfig] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [peerNodes, setPeerNodes] = useState([]);
  const [peers, setPeers] = useState({});
  const joinEmittedRef = useRef(false);
    
  // Request local media once on mount
  useEffect(() => {
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
  }, []);

  // Emit joinRoom event once when safeName and localStream are available
  useEffect(() => {
    if (safeName && localStream && !joinEmittedRef.current) {
      log("\uD83D\uDEAA", "Room: Emitting joinRoom for", safeName);
      socket.emit('joinRoom', safeName);
      joinEmittedRef.current = true;
    }
  }, [safeName, localStream]);

    // Handle incoming peer events

    
  useEffect(() => {
    if (!safeName) {
      alert("No room specified.");
      return;
    }

    const handleRoomJoined = (data) => {
	log("\uD83D\uDC49", "Room: Joined Event", data);
	// Save the room configuration in state.
	setRoomConfig(data);

	// Optionally, update the document body background.
	if (data.imageURL) {
	    log("\uD83D\uDC49", "Room: got background image", data.imageURL);
	    document.body.style.backgroundImage = `url(${data.imageURL})`;
	    document.body.style.backgroundSize = "cover";
	    document.body.style.backgroundRepeat = "no-repeat";
	    document.body.style.backgroundPosition = "center";
	}
    }

    const handlePeerConnect = (data) => {
	const { peerId, name } = data;
	log("\uD83D\uDC49", "Room: Received peerConnect from", peerId);

	// Immediately add a placeholder node for the peer if it doesn't exist.
	setPeerNodes(prev => {
	    if (!prev.some(n => n.id === peerId)) {
		return [
		    ...prev,
		    {
			id: peerId,
			contentType: "videoStream",
			content: null, // no stream yet
			borderColor: "#FFFFFF",
			displayName: name || "Anonymous",
			startPosition: { 
			    x: Math.random() * window.innerWidth, 
			    y: Math.random() * window.innerHeight 
			}
		    }
		];
	    }
	    return prev;
	});
	
	// If the local stream isn't ready, do nothing else.
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

	    peer.on('error', (err) => {
		if (err && err.message && err.message.includes("Close called")) {
		    // Suppress the error.
		    log("\uD83D\uDEA7", `Peer ${peerId}: Suppressed error: ${err.message}`);
		} else {
		    // For other errors, you might log them.
		    logError("\uD83D\uDEA7", `Peer ${peerId}: Error occurred:`, err);
		}
	    });
	    
	    peer.on('signal', (signalData) => {
		log("\uD83D\uDCF1", "Room: Peer signal event for", peerId, signalData);
		socket.emit('signal', { signal: signalData, peerId });
	    });
	    peer.on('stream', (remoteStream) => {
		log("\uD83D\uDCFA", "Room: Received remote stream for peer "+remoteStream, peerId);
		// Update the peer node with the remote stream
		setPeerNodes(prev => {
		    return prev.map(node =>
			node.id === peerId ? { ...node, content: remoteStream } : node
		    );
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
    };

    const handleSignal = (data) => {
      const { peerId, signal } = data;
      log("\uD83D\uDCF1", "Room: Received signal for peer", peerId, signal);
      if (peers[peerId]) {
        peers[peerId].signal(signal);
      }
    };

    const handlePeerDisconnect = ({ peerId }) => {
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
    };

    socket.on('roomJoined', handleRoomJoined);
    socket.on('peerConnect', handlePeerConnect);
    socket.on('signal', handleSignal);
    socket.on('peerDisconnect', handlePeerDisconnect);

    return () => {
      socket.off('roomJoined', handleRoomJoined);
      socket.off('peerConnect', handlePeerConnect);
      socket.off('signal', handleSignal);
      socket.off('peerDisconnect', handlePeerDisconnect);
    };
  }, [safeName, localStream, peers]);

    /*
      
    // Create a ref to store the latest peers
    const peersRef = useRef({});
    useEffect(() => {
	peersRef.current = peers;
    }, [peers]);
    
    // --- Cleanup on unload (registered once) ---
    useEffect(() => {
	const handleBeforeUnload = () => {
	    log("\uD83D\uDEA7", "Room: Handling beforeunload cleanup");
	    // Disconnect the socket
	    socket.disconnect();
	    // Destroy all active peer connections from the ref
	    Object.values(peersRef.current).forEach(peer => {
		if (peer.destroy) {
		    peer.destroy();
		}
	    });
	};
	
	window.addEventListener('beforeunload', handleBeforeUnload);
	
	return () => {
	    window.removeEventListener('beforeunload', handleBeforeUnload);
	    // Optionally, clean up on unmount as well
	};
    }, []);
    */
    
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      log("\uD83D\uDD07", "Room: " + (isMuted ? "Muted" : "Unmuted") + " local audio");
    }
  };

  // Handler for "Back to Lobby" button
  const handleBackToLobby = () => {
    log("\uD83D\uDC4B", "Room: Back to Lobby clicked");
    navigate("/");
  };

  // (Optional) Handlers for other controls such as adding or removing nodes
  const handleAddNodes = () => {
    // Example: add dummy nodes to the ClusterLayout; implement as needed.
    log("\uD83D\uDC4B", "Room: Add nodes clicked");
  };

  const handleRemoveNodes = () => {
    // Example: remove dummy nodes from the ClusterLayout; implement as needed.
    log("\uD83D\uDC4B", "Room: Remove nodes clicked");
  };

  return (
    <div className="room">
      <header id="header">
        <h1>HearthSpace - Room</h1>
        <div className="control-buttons">
          <button onClick={handleBackToLobby}>Back to Lobby</button>
          <button onClick={handleAddNodes}>Add Nodes</button>
          <button onClick={handleRemoveNodes}>Remove Nodes</button>
        </div>
      </header>
	<ClusterLayout options={{ layoutOnViewport: true }} nodes={peerNodes} />
	{localStream && (
	    <div className="local-avatar-container">
		<Avatar
		    stream={localStream}
		    name="You"
		    style={{ width: '220px', height: '150px' }}
		/>
	    </div>
	)}

    </div>
  );
}

export default Room;
