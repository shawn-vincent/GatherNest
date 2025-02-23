/*
 * server.js
 * HearthSpace - Multi-Room w/ Stable Diffusion & Persistent Rooms
 * 2025 Shawn Vincent <svincent@svincent.com>
 */

const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
const os = require("os");
const fs = require("fs");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// -----------------------------
// Logging Helpers
// -----------------------------
function log(emoji, message, ...data) {
  const timestamp = new Date().toISOString();
  if (data.length > 0) {
    console.log(`[${timestamp}] ${emoji} ${message}`, ...data);
  } else {
    console.log(`[${timestamp}] ${emoji} ${message}`);
  }
}

function logError(emoji, message, ...data) {
  const timestamp = new Date().toISOString();
  if (data.length > 0) {
    console.error(`[${timestamp}] ${emoji} ${message}`, ...data);
  } else {
    console.error(`[${timestamp}] ${emoji} ${message}`);
  }
}

// =============================================
// === Configuration ===
// =============================================

// Directory where we store persistent room data, each as ./rooms/<safeName>/
const ROOMS_DIR = path.join(__dirname, "rooms");
if (!fs.existsSync(ROOMS_DIR)) {
  fs.mkdirSync(ROOMS_DIR);
  log("📁", `Created rooms directory at ${ROOMS_DIR}`);
}

// stable-diffusion server endpoint
const STABLE_DIFFUSION_URL = "http://127.0.0.1:7860/sdapi/v1/txt2img";

// In-memory "clients" dictionary: who is connected, what room they're in, etc.
let clients = {};
// e.g. clients[socketId] = { socket, name, room: null }

// "rooms" in memory, keyed by safeName
// rooms[safeName] = { displayName, prompt, userIds: [socketId...] }
let rooms = {};

// =============================================
// === Helper: generate a unique, filesystem-
// === safe directory name from the user’s
// === original room name.
// =============================================
function makeSafeDirName(originalName) {
  // 1) Lowercase
  // 2) Replace spaces with underscores
  // 3) Remove other weird chars except [a-z0-9-_]
  // 4) Append a timestamp so no collisions.
  const base = originalName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9-_]/g, "");
  const timestamp = Date.now();
  const safeName = `${base}_${timestamp}`;
  log("📝", `Generated safe directory name: ${safeName}`);
  return safeName;
}

// =============================================
// === Load existing rooms from disk        ===
// === Each subdirectory is named "safeName"
// === We read room.json to get displayName
// === and prompt. 
// =============================================
function loadRoomsFromDisk() {
  const subdirs = fs.readdirSync(ROOMS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  subdirs.forEach(safeName => {
    const roomJsonPath = path.join(ROOMS_DIR, safeName, "room.json");
    if (fs.existsSync(roomJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(roomJsonPath, "utf8"));
        // data = { displayName, prompt }
        rooms[safeName] = {
          displayName: data.displayName || safeName,
          prompt: data.prompt || "",
          userIds: []
        };
        log("✅", `Loaded room [safeName="${safeName}"] from disk.`);
      } catch (err) {
        logError("🚨", `Error reading room.json for ${safeName}:`, err);
      }
    }
  });
  log("📂", "Rooms loaded from disk:", Object.keys(rooms));
}

// =============================================
// === Save room metadata to disk           ===
// === The directory name is safeName,
// === and we store { displayName, prompt }
// =============================================
function saveRoomToDisk(safeName) {
  const roomObj = rooms[safeName];
  if (!roomObj) return;

  const roomPath = path.join(ROOMS_DIR, safeName);
  if (!fs.existsSync(roomPath)) {
    fs.mkdirSync(roomPath);
    log("📁", `Created directory for room: ${roomPath}`);
  }
  const dataToWrite = {
    displayName: roomObj.displayName,
    prompt: roomObj.prompt
  };
  const roomJsonPath = path.join(roomPath, "room.json");
  fs.writeFileSync(roomJsonPath, JSON.stringify(dataToWrite, null, 2), "utf8");
  log("💾", `Room [${safeName}] saved to disk at ${roomJsonPath}.`);
}

// =============================================
// === Helper: get background image path    ===
// === by safeName
// =============================================
function getBackgroundImagePath(safeName) {
  return path.join(ROOMS_DIR, safeName, "background.png");
}

// =============================================
// === Build array for client: each room has
// === safeName, displayName, user count
// =============================================
function buildRoomsList() {
  return Object.entries(rooms).map(([safeName, info]) => ({
    safeName,
    displayName: info.displayName,
    count: info.userIds.length
  }));
}

// =============================================
// === Build user list for a specific room  ===
// =============================================
function buildUserList(safeName) {
  if (!rooms[safeName]) return [];
  return rooms[safeName].userIds.map((id) => ({
    id,
    name: clients[id]?.name || "Anonymous"
  }));
}

// =============================================
// === stable-diffusion logic to generate   ===
// === an image from prompt                ===
// =============================================
async function generateImageFromPrompt(prompt) {
  try {
    const response = await axios.post(STABLE_DIFFUSION_URL, {
      prompt,
      steps: 20
    });
    log("🖼️", `Image generated for prompt: "${prompt}"`);
    // Return the first image from the array
    return response.data.images[0]; 
  } catch (error) {
    logError("🚨", "Error generating image:", error);
    throw error;
  }
}

// =============================================
// === Express + Socket.io Setup            ===
// =============================================
app.use(express.static(__dirname));
app.use("/rooms", express.static(path.join(__dirname, "rooms")));

app.use((req, res, next) => {
  log("📥", `Received request: ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Load existing rooms from disk on startup
loadRoomsFromDisk();

// =============================================
// === Socket.io Connection Handler         ===
// =============================================
io.on("connection", (socket) => {
  log("🔌", "New client connected:", socket.id);

  clients[socket.id] = { socket, name: "", room: null };

  // Immediately send them the current list of rooms
  socket.emit("roomsList", buildRoomsList());

  // Handle "signal" event for P2P
  socket.on("signal", (data) => {
    if (clients[data.peerId]) {
      clients[data.peerId].socket.emit("signal", {
        signal: data.signal,
        peerId: socket.id
      });
      log("📡", `Forwarded signal from ${socket.id} to ${data.peerId}`);
    }
  });

  // Let the user set their display name
  socket.on("setName", (name) => {
    if (clients[socket.id]) {
      clients[socket.id].name = name;
      log("✏️", `Set name for ${socket.id} to "${name}"`);
      const currentRoom = clients[socket.id].room;
      if (currentRoom) {
        broadcastUserList(currentRoom);
      }
    }
  });

  // Show a preview of who is in the room (by safeName) before joining
  socket.on("getRoomUserList", (safeName) => {
    log("👀", `Preview requested for room: ${safeName}`);
    if (rooms[safeName]) {
      socket.emit("roomUserPreview", buildUserList(safeName));
    } else {
      socket.emit("roomUserPreview", []);
    }
  });

  // ========================================
  // === Create a new room                ===
  // ========================================
  socket.on("createRoom", async ({ roomName, prompt }) => {
    log("🛠️", `Creating room with name "${roomName}" and prompt "${prompt || ""}"`);

    // We create a filesystem-safe directory name
    const safeName = makeSafeDirName(roomName);

    // If for some reason the safeName already exists (very unlikely),
    // we could bail or generate a second safe name. 
    // For simplicity, let's just check:
    if (rooms[safeName]) {
      logError("❌", `Room creation failed: Room with safe name "${safeName}" already exists.`);
      socket.emit("roomCreationFailed", "A room with that name already exists (collision).");
      return;
    }

    // Let the client know we are generating the image
    socket.emit("roomCreationPending", safeName);
    log("⏳", `Room creation pending for safeName: ${safeName}`);

    try {
      // 2) Make the directory for the new room
      const roomPath = path.join(ROOMS_DIR, safeName);
      fs.mkdirSync(roomPath);
      log("📁", `Created directory for room: ${roomPath}`);

      // 4) Create the room object in memory
      rooms[safeName] = {
        displayName: roomName,
        prompt: "",
        userIds: []
      };
      log("📝", `Created room object in memory for: ${safeName}`);

      // 5) Save the room metadata to disk
      saveRoomToDisk(safeName);

      // 6) Let all clients see the new room in the room list
      io.emit("roomsList", buildRoomsList());
      log("📢", "Broadcasted updated rooms list.");

      // 7) Notify the creator that creation is done
      socket.emit("roomCreationDone", safeName);
      log("✅", `Room creation done for safeName: ${safeName}`);
      
    } catch (err) {
      logError("🚨", "Room creation / image generation failed:", err);
      socket.emit("roomCreationFailed", "Image generation error: " + err.message);
    }
  });

  // ========================================
  // === Join an existing room by safeName===
  // ========================================
  socket.on("joinRoom", (safeName) => {
    if (!rooms[safeName]) {
      logError("❌", `Client ${socket.id} tried to join non-existent room: "${safeName}"`);
      return;
    }
    
    // If user was in another room, remove them from that
    const oldRoom = clients[socket.id].room;
    if (oldRoom && rooms[oldRoom]) {
      removeUserFromRoom(socket.id, oldRoom);
    }
    
    // Add them to the new room
    rooms[safeName].userIds.push(socket.id);
    clients[socket.id].room = safeName;
    
    log("🚪", `Client ${socket.id} joined room [${safeName}]`);
    
    // Build the userList
    const userList = buildUserList(safeName);
    
    // Check for the room's background image.
    const bgPath = path.join(ROOMS_DIR, safeName, "background.png");
    let imageURL;
    if (fs.existsSync(bgPath)) {
      imageURL = `/rooms/${safeName}/background.png`;
      log("🖼️", `Found background image for room: ${safeName}`);
    } else {
      // If no background image file is present, use the default background.
      imageURL = `/default_background.png`;
      log("🖼️", `No background image for room: ${safeName}, using default.`);
    }
    
    // Send room information to the client.
    socket.emit("roomJoined", {
      roomName: safeName,
      imageURL,
      userList
    });
    log("📬", `Sent roomJoined event to ${socket.id} for room ${safeName}`);

    // Notify existing users in the room about the new peer.
    const inRoomIds = rooms[safeName].userIds.filter(id => id !== socket.id);
    inRoomIds.forEach(id => {
      clients[id].socket.emit("peerConnect", {
        peerId: socket.id,
        name: clients[socket.id].name
      });
      log("🤝", `Notified ${id} of new peer ${socket.id}`);
    });

    // Also tell the new user to connect to the existing users.
    inRoomIds.forEach(id => {
      socket.emit("peerConnect", {
        peerId: id,
        name: clients[id].name
      });
      log("🤝", `Informed ${socket.id} to connect with existing peer ${id}`);
    });
    
    broadcastUserList(safeName);
    
    // Update user counts for everyone.
    io.emit("roomsList", buildRoomsList());
    log("📢", "Broadcasted updated rooms list after joinRoom.");
  });
  
  // ========================================
  // === Disconnect logic                 ===
  // ========================================
  socket.on("disconnect", () => {
    log("🔒", "Client disconnected:", socket.id);

    const oldRoom = clients[socket.id]?.room;
    if (oldRoom && rooms[oldRoom]) {
      removeUserFromRoom(socket.id, oldRoom);
    }
    delete clients[socket.id];

    // Let others know this peer is gone
    io.emit("peerDisconnect", { peerId: socket.id });
    log("👋", `Emitted peerDisconnect for ${socket.id}`);

    // Update the rooms list for everyone
    io.emit("roomsList", buildRoomsList());
    log("📢", "Broadcasted updated rooms list after disconnect.");
  });

});

// =============================================
// === Helper: remove user from a room      ===
// =============================================
function removeUserFromRoom(socketId, safeName) {
  const idx = rooms[safeName].userIds.indexOf(socketId);
  if (idx !== -1) {
    rooms[safeName].userIds.splice(idx, 1);
  }
  log("🚪", `Removed user ${socketId} from room [${safeName}].`);
  broadcastUserList(safeName);
  saveRoomToDisk(safeName); // to keep metadata updated
}

// =============================================
// === Helper: broadcast updated userList   ===
// =============================================
function broadcastUserList(safeName) {
  if (!rooms[safeName]) return;
  const updatedList = buildUserList(safeName);
  rooms[safeName].userIds.forEach(id => {
    clients[id].socket.emit("userList", updatedList);
  });
  log("👥", `Broadcasted updated user list for room: ${safeName}`);
}

// =============================================
// === Start the server                     ===
// =============================================
const PORT = 4000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  log("🚀", `Server running at http://localhost:${PORT}`);
  log("🌐", `Accessible on LAN at http://${getLocalIP()}:${PORT}`);
});

// Helper: find local LAN IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}
