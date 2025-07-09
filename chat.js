// Store the TMI client globally
let client = null;
let botEnabled = false;
let lastMessageTime = Date.now();
let conversationHistory = [];
let volume = 0.5;
let newMessagesReceived = false;
let isPondering = false;
let messagesQueue = []; // Queue to collect messages while the bot is pondering
let processedMessageIds = new Set(); // Track processed message IDs
let longTermMemory = []; // Store important interactions for long-term context
let isSpeaking = false; // Track if TTS is currently speaking
let speechQueue = []; // Queue for TTS sentences
let popoutWindow = null; // Reference to popout window
let allChatMessages = []; // Store all chat messages for popout
let selectedVoice = 'en-male';
let advancedTts = false;
let voiceCloneFile = null;
let advancedTtsMode = 'models'; // 'models' or 'clone'
let ttsHistory = []; // Store completed TTS items
let currentTtsItem = null; // Track currently playing TTS item
let isCheckingForResponse = false; // Prevent multiple response check loops
let botResponseCooldown = false; // Prevent rapid responses
let botUsername = null; // Track bot's username to prevent self-responses

// Game state variables
let gameEnabled = false;
let gameOverlay = null;
let gameStats = {
  drops: 0,
  hits: 0,
  score: 0
};
let fallingCharacters = [];
let gameTarget = null;

// Initialize elements
const channelInput = document.getElementById('channel-input');
const connectButton = document.getElementById('connect-btn');
const chatBox = document.getElementById('chat-box');
const statusDiv = document.getElementById('status');
const botToggle = document.getElementById('bot-enabled');
const botContext = document.getElementById('bot-context');
const volumeControl = document.getElementById('volume-control');
const stopSpeechButton = document.getElementById('stop-speech');
const themeSelect = document.getElementById('theme-select');
const popoutButton = document.getElementById('popout-chat');
const voiceSelect = document.getElementById('voice-select');
const advancedTtsToggle = document.getElementById('advanced-tts');
const advancedTtsOptions = document.getElementById('advanced-tts-options');
const advancedModelsRadio = document.getElementById('advanced-models');
const voiceCloneRadio = document.getElementById('voice-clone');
const voiceFileLabel = document.getElementById('voice-file-label');
const voiceFileInput = document.getElementById('voice-file');
const clearTtsHistoryBtn = document.getElementById('clear-tts-history');
const ttsStatusSpan = document.getElementById('tts-status');
const queueCountSpan = document.getElementById('queue-count');
const ttsQueueDiv = document.getElementById('tts-queue');
const ttsHistoryDiv = document.getElementById('tts-history');

// Initialize game elements
const gameToggle = document.getElementById('game-enabled');
const resetGameBtn = document.getElementById('reset-game');
const toggleOverlayBtn = document.getElementById('toggle-overlay');
const dropCountSpan = document.getElementById('drop-count');
const hitCountSpan = document.getElementById('hit-count');
const gameScoreSpan = document.getElementById('game-score');
const accuracySpan = document.getElementById('accuracy');

// Voice controls
voiceSelect.addEventListener('change', (e) => {
  selectedVoice = e.target.value;
});

advancedTtsToggle.addEventListener('change', (e) => {
  advancedTts = e.target.checked;
  if (advancedTts) {
    advancedTtsOptions.style.display = 'flex';
    advancedTtsOptions.style.gap = '10px';
    updateAdvancedTtsUI();
  } else {
    advancedTtsOptions.style.display = 'none';
    voiceFileLabel.style.display = 'none';
  }
});

// Handle advanced TTS mode selection
advancedModelsRadio.addEventListener('change', (e) => {
  if (e.target.checked) {
    advancedTtsMode = 'models';
    updateAdvancedTtsUI();
  }
});

voiceCloneRadio.addEventListener('change', (e) => {
  if (e.target.checked) {
    advancedTtsMode = 'clone';
    updateAdvancedTtsUI();
  }
});

// Handle voice file upload for cloning
voiceFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    // Store the file for voice cloning
    voiceCloneFile = file;
    console.log('Voice clone file selected:', file.name);
  } else {
    voiceCloneFile = null;
  }
});

function updateAdvancedTtsUI() {
  if (advancedTtsMode === 'clone') {
    voiceFileLabel.style.display = 'flex';
    voiceFileLabel.style.alignItems = 'center';
    voiceFileLabel.style.gap = '5px';
  } else {
    voiceFileLabel.style.display = 'none';
  }
}

// Game controls
gameToggle.addEventListener('change', (e) => {
  gameEnabled = e.target.checked;
  if (gameEnabled) {
    initializeGame();
  }
});

resetGameBtn.addEventListener('click', () => {
  resetGame();
});

toggleOverlayBtn.addEventListener('click', () => {
  const overlay = document.getElementById('game-overlay');
  overlay.classList.toggle('active');
  
  if (overlay.classList.contains('active')) {
    // Switch to overlay theme for better visibility
    document.documentElement.setAttribute('data-theme', 'overlay');
    themeSelect.value = 'overlay';
  }
});

// Initialize game
function initializeGame() {
  gameOverlay = document.getElementById('game-overlay');
  gameTarget = document.querySelector('.game-target');
  
  // Reset game stats
  resetGame();
  
  // Start game loop
  gameLoop();
}

// Reset game stats
function resetGame() {
  gameStats = {
    drops: 0,
    hits: 0,
    score: 0
  };
  
  // Clear all falling characters
  fallingCharacters.forEach(char => {
    if (char.animationId) {
      cancelAnimationFrame(char.animationId);
    }
    if (char.element && char.element.parentNode) {
      char.element.parentNode.removeChild(char.element);
    }
  });
  fallingCharacters = [];
  
  updateGameStats();
}

// Update game stats display
function updateGameStats() {
  dropCountSpan.textContent = gameStats.drops;
  hitCountSpan.textContent = gameStats.hits;
  gameScoreSpan.textContent = gameStats.score;
  
  const accuracy = gameStats.drops > 0 ? Math.round((gameStats.hits / gameStats.drops) * 100) : 0;
  accuracySpan.textContent = accuracy + '%';
}

// Handle drop command
function handleDropCommand(username) {
  if (!gameEnabled) return;
  
  gameStats.drops++;
  
  // Create falling character
  const character = createFallingCharacter(username);
  fallingCharacters.push(character);
  
  // Add to game overlay
  gameOverlay.appendChild(character.element);
  
  // Calculate hit chance and physics
  const hitChance = 0.3; // 30% chance to hit
  const willHit = Math.random() < hitChance;
  
  // Random starting position across screen width
  const startX = Math.random() * (window.innerWidth - 80) + 40;
  character.x = startX;
  character.y = -150;
  character.velocityX = (Math.random() - 0.5) * 2; // Random horizontal drift
  character.velocityY = 0.8 + Math.random() * 0.4; // Slow fall speed
  character.gravity = 0.02;
  character.bounce = 0.7;
  character.drag = 0.98;
  
  // Set initial position
  character.element.style.left = character.x + 'px';
  character.element.style.top = character.y + 'px';
  
  // Remove CSS animation and use JS physics
  character.element.style.animation = 'none';
  
  // Start physics simulation
  character.animationId = requestAnimationFrame(() => animateCharacter(character));
  
  updateGameStats();
}

// Create falling character element with parachute
function createFallingCharacter(username) {
  const container = document.createElement('div');
  container.className = 'falling-character-container';
  container.style.position = 'absolute';
  container.style.width = '60px';
  container.style.height = '80px';
  
  // Create parachute
  const parachute = document.createElement('div');
  parachute.className = 'parachute';
  parachute.style.position = 'absolute';
  parachute.style.top = '0px';
  parachute.style.left = '50%';
  parachute.style.transform = 'translateX(-50%)';
  parachute.style.width = '50px';
  parachute.style.height = '25px';
  parachute.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ff5252 50%, #f44336 100%)';
  parachute.style.borderRadius = '50% 50% 50% 50% / 60% 60% 40% 40%';
  parachute.style.border = '2px solid #fff';
  parachute.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
  
  // Create parachute strings
  const strings = document.createElement('div');
  strings.className = 'parachute-strings';
  strings.style.position = 'absolute';
  strings.style.top = '20px';
  strings.style.left = '50%';
  strings.style.transform = 'translateX(-50%)';
  strings.style.width = '2px';
  strings.style.height = '15px';
  strings.style.background = '#333';
  strings.style.opacity = '0.7';
  
  // Create character
  const character = document.createElement('div');
  character.className = 'falling-character';
  character.style.position = 'absolute';
  character.style.bottom = '0px';
  character.style.left = '50%';
  character.style.transform = 'translateX(-50%)';
  character.style.width = '30px';
  character.style.height = '30px';
  character.style.background = 'linear-gradient(135deg, #ff9800 0%, #ff5722 100%)';
  character.style.borderRadius = '50%';
  character.style.border = '2px solid #fff';
  character.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
  character.style.display = 'flex';
  character.style.alignItems = 'center';
  character.style.justifyContent = 'center';
  character.style.fontSize = '12px';
  character.style.color = 'white';
  character.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.5)';
  character.style.fontWeight = 'bold';
  
  // Add username initial
  const initial = username.charAt(0).toUpperCase();
  character.textContent = initial;
  
  // Random colors
  const colors = ['#ff9800', '#2196f3', '#4caf50', '#e91e63', '#9c27b0', '#ff5722'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  character.style.background = `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`;
  parachute.style.background = `linear-gradient(135deg, ${color} 0%, ${color}CC 50%, ${color}99 100%)`;
  
  // Assemble the falling unit
  container.appendChild(parachute);
  container.appendChild(strings);
  container.appendChild(character);
  
  return {
    element: container,
    username: username,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    gravity: 0.02,
    bounce: 0.7,
    drag: 0.98,
    hit: false,
    animationId: null
  };
}

// Animate character with physics
function animateCharacter(character) {
  // Apply gravity
  character.velocityY += character.gravity;
  
  // Apply drag
  character.velocityX *= character.drag;
  character.velocityY *= character.drag;
  
  // Update position
  character.x += character.velocityX;
  character.y += character.velocityY;
  
  // Bounce off side walls
  if (character.x <= 0) {
    character.x = 0;
    character.velocityX = Math.abs(character.velocityX) * character.bounce;
  } else if (character.x >= window.innerWidth - 60) {
    character.x = window.innerWidth - 60;
    character.velocityX = -Math.abs(character.velocityX) * character.bounce;
  }
  
  // Check if hit ground or target
  if (character.y >= window.innerHeight - 200) {
    character.y = window.innerHeight - 200;
    character.velocityY = -character.velocityY * character.bounce * 0.5;
    character.velocityX *= 0.8; // Reduce horizontal movement on ground bounce
    
    // Check for target hit
    if (!character.hit) {
      checkHit(character);
    }
    
    // Stop bouncing if velocity is too low
    if (Math.abs(character.velocityY) < 0.1 && Math.abs(character.velocityX) < 0.1) {
      setTimeout(() => {
        removeCharacter(character);
      }, 2000);
      return;
    }
  }
  
  // Update visual position
  character.element.style.left = character.x + 'px';
  character.element.style.top = character.y + 'px';
  
  // Continue animation if character is still on screen
  if (character.y < window.innerHeight + 100) {
    character.animationId = requestAnimationFrame(() => animateCharacter(character));
  } else {
    removeCharacter(character);
  }
}

// Remove character from game
function removeCharacter(character) {
  if (character.animationId) {
    cancelAnimationFrame(character.animationId);
  }
  
  if (character.element && character.element.parentNode) {
    character.element.parentNode.removeChild(character.element);
  }
  
  // Remove from array
  const index = fallingCharacters.indexOf(character);
  if (index > -1) {
    fallingCharacters.splice(index, 1);
  }
}

// Check if character hit the target
function checkHit(character) {
  const charRect = character.element.getBoundingClientRect();
  const targetRect = gameTarget.getBoundingClientRect();
  
  // Check collision
  const hit = charRect.left < targetRect.right &&
              charRect.right > targetRect.left &&
              charRect.top < targetRect.bottom &&
              charRect.bottom > targetRect.top;
  
  if (hit) {
    character.hit = true;
    gameStats.hits++;
    gameStats.score += 10;
    
    // Show score popup
    showScorePopup(charRect.left + charRect.width / 2, charRect.top, 10);
    
    // Play hit sound effect (optional)
    playHitSound();
    
    updateGameStats();
  }
  
  // Remove character after a delay
  setTimeout(() => {
    if (character.element && character.element.parentNode) {
      character.element.parentNode.removeChild(character.element);
    }
    
    // Remove from array
    const index = fallingCharacters.indexOf(character);
    if (index > -1) {
      fallingCharacters.splice(index, 1);
    }
  }, 1000);
}

// Show score popup
function showScorePopup(x, y, points) {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = '+' + points;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  
  document.body.appendChild(popup);
  
  // Remove after animation
  setTimeout(() => {
    if (popup.parentNode) {
      popup.parentNode.removeChild(popup);
    }
  }, 2000);
}

// Play hit sound effect
function playHitSound() {
  // Create a simple beep sound
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
}

// Game loop
function gameLoop() {
  if (!gameEnabled) return;
  
  // Clean up old characters
  fallingCharacters = fallingCharacters.filter(char => {
    if (char.element && char.element.parentNode) {
      return true;
    }
    return false;
  });
  
  // Continue game loop
  requestAnimationFrame(gameLoop);
}

// Theme handling
themeSelect.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value);
  localStorage.setItem('selectedTheme', e.target.value);
  
  // Handle overlay theme special case
  if (e.target.value === 'overlay') {
    document.body.style.background = 'transparent';
  } else {
    document.body.style.background = '';
  }
});

// Load saved theme
const savedTheme = localStorage.getItem('selectedTheme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeSelect.value = savedTheme;

// Popout chat functionality
popoutButton.addEventListener('click', () => {
  if (popoutWindow && !popoutWindow.closed) {
    popoutWindow.focus();
    return;
  }

  const popoutContent = createPopoutHTML();
  popoutWindow = window.open('', 'chatPopout', 'width=600,height=800,scrollbars=yes,resizable=yes');
  
  if (popoutWindow) {
    popoutWindow.document.write(popoutContent);
    popoutWindow.document.close();
    
    // Send current theme to popout
    popoutWindow.postMessage({
      type: 'setTheme',
      theme: savedTheme
    }, '*');
    
    // Send current messages to popout
    popoutWindow.postMessage({
      type: 'loadMessages',
      messages: allChatMessages
    }, '*');
    
    // Listen for theme changes in popout
    window.addEventListener('message', (event) => {
      if (event.source === popoutWindow && event.data.type === 'themeChange') {
        document.documentElement.setAttribute('data-theme', event.data.theme);
        themeSelect.value = event.data.theme;
        localStorage.setItem('selectedTheme', event.data.theme);
      }
    });
  }
});

function createPopoutHTML() {
  const currentTheme = themeSelect.value;
  return `<!DOCTYPE html>
<html>
<head>
  <title>Twitch Chat - Pop-out</title>
  <style>
    :root {
      /* Light theme (default) */
      --bg-color: #f0f0f0;
      --container-bg: white;
      --text-color: #333;
      --border-color: #ddd;
      --primary-color: #6441A4;
      --primary-hover: #7454B3;
      --chat-bg: #fff;
      --username-color: #6441A4;
      --bot-username-color: #2ecc71;
      --timestamp-color: #666;
    }

    [data-theme="dark"] {
      --bg-color: #1a1a1a;
      --container-bg: #2d2d2d;
      --text-color: #fff;
      --border-color: #444;
      --primary-color: #9147ff;
      --primary-hover: #a970ff;
      --chat-bg: #1e1e1e;
      --username-color: #9147ff;
      --bot-username-color: #00d4aa;
      --timestamp-color: #aaa;
    }

    [data-theme="purple"] {
      --bg-color: #2d1b69;
      --container-bg: #3d2b79;
      --text-color: #e8e8ff;
      --border-color: #5d4b99;
      --primary-color: #8b5cf6;
      --primary-hover: #a78bfa;
      --chat-bg: #1e1135;
      --username-color: #a78bfa;
      --bot-username-color: #34d399;
      --timestamp-color: #c4b5fd;
    }

    [data-theme="neon"] {
      --bg-color: #0a0a0a;
      --container-bg: #111;
      --text-color: #00ff41;
      --border-color: #00ff41;
      --primary-color: #ff0080;
      --primary-hover: #ff3399;
      --chat-bg: #050505;
      --username-color: #00ffff;
      --bot-username-color: #ffff00;
      --timestamp-color: #00ff41;
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 10px;
      background: var(--bg-color);
      color: var(--text-color);
      transition: background-color 0.3s, color 0.3s;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding: 10px;
      background: var(--container-bg);
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }

    .theme-selector select {
      padding: 5px;
      background: var(--container-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
    }

    #popout-chat-box {
      height: calc(100vh - 80px);
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 10px;
      background: var(--chat-bg);
    }

    .chat-message {
      padding: 4px 0;
      word-wrap: break-word;
    }

    .username {
      font-weight: bold;
      color: var(--username-color);
    }

    .bot-message .username {
      color: var(--bot-username-color);
    }

    .timestamp {
      color: var(--timestamp-color);
      font-size: 0.8em;
      margin-right: 5px;
    }
  </style>
</head>
<body data-theme="${currentTheme}">
  <div class="header">
    <h3>Twitch Chat</h3>
    <div class="theme-selector">
      <label for="popout-theme-select">Theme:</label>
      <select id="popout-theme-select">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="purple">Purple</option>
        <option value="neon">Neon</option>
      </select>
    </div>
  </div>
  <div id="popout-chat-box"></div>

  <script>
    let chatMessages = [];
    const chatBox = document.getElementById('popout-chat-box');
    const themeSelect = document.getElementById('popout-theme-select');
    
    themeSelect.value = '${currentTheme}';
    
    themeSelect.addEventListener('change', (e) => {
      document.body.setAttribute('data-theme', e.target.value);
      window.opener.postMessage({
        type: 'themeChange',
        theme: e.target.value
      }, '*');
    });

    window.addEventListener('message', (event) => {
      if (event.data.type === 'newMessage') {
        addChatMessage(event.data.username, event.data.message, event.data.tags);
      } else if (event.data.type === 'loadMessages') {
        chatMessages = event.data.messages;
        renderAllMessages();
      } else if (event.data.type === 'setTheme') {
        document.body.setAttribute('data-theme', event.data.theme);
        themeSelect.value = event.data.theme;
      }
    });

    function addChatMessage(username, message, tags) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'chat-message';
      if (tags.bot) {
        messageDiv.className += ' bot-message';
      }

      const timestamp = new Date().toLocaleTimeString();
      const timestampSpan = document.createElement('span');
      timestampSpan.className = 'timestamp';
      timestampSpan.textContent = timestamp;
      messageDiv.appendChild(timestampSpan);

      const usernameSpan = document.createElement('span');
      usernameSpan.className = 'username';
      usernameSpan.textContent = username;
      messageDiv.appendChild(usernameSpan);

      const messageText = document.createElement('span');
      messageText.textContent = ': ' + message;
      messageDiv.appendChild(messageText);

      chatBox.appendChild(messageDiv);
      chatBox.scrollTop = chatBox.scrollHeight;

      while (chatBox.children.length > 1000) {
        chatBox.removeChild(chatBox.firstChild);
      }
    }

    function renderAllMessages() {
      chatBox.innerHTML = '';
      chatMessages.forEach(msg => {
        addChatMessage(msg.username, msg.message, msg.tags);
      });
    }
  </script>
</body>
</html>`;
}

function sendMessageToPopout(username, message, tags) {
  if (popoutWindow && !popoutWindow.closed) {
    popoutWindow.postMessage({
      type: 'newMessage',
      username: username,
      message: message,
      tags: tags
    }, '*');
  }
}

// Setup volume control
volumeControl.addEventListener('input', (e) => {
  volume = parseFloat(e.target.value);
});

// Handle bot toggle
botToggle.addEventListener('change', (e) => {
  botEnabled = e.target.checked;
  if (botEnabled) {
    speak("AI bot activated. I'll be monitoring the chat.");
    // Reset state and start the bot response loop
    isCheckingForResponse = false;
    botResponseCooldown = false;
    messagesQueue = [];
    newMessagesReceived = false;
    isPondering = false;
    checkForBotResponse();
  } else {
    // Reset state when bot is disabled
    isCheckingForResponse = false;
    botResponseCooldown = false;
    messagesQueue = [];
    newMessagesReceived = false;
    isPondering = false;
  }
});

// Handle connect/disconnect
connectButton.addEventListener('click', () => {
  if (client && client.readyState() === 'OPEN') {
    disconnectFromChat();
  } else {
    connectToChat();
  }
});

function connectToChat() {
  const channel = channelInput.value.toLowerCase().trim();
  
  if (!channel) {
    alert('Please enter a channel name');
    return;
  }

  // Create new client using window.tmi.Client
  try {
    client = new window.tmi.Client({
      connection: {
        secure: true,
        reconnect: true
      },
      channels: [channel]
    });

    // Handle connection
    client.connect()
      .then(() => {
        console.log('Successfully connected to Twitch');
      })
      .catch(err => {
        console.error('Error connecting to Twitch:', err);
        statusDiv.className = 'status disconnected';
        statusDiv.textContent = `Connection error: ${err.message}`;
      });

    // Setup event handlers
    client.on('connected', () => {
      statusDiv.className = 'status connected';
      statusDiv.textContent = `Connected to ${channel}'s chat`;
      connectButton.textContent = 'Disconnect';
    });

    client.on('disconnected', () => {
      statusDiv.className = 'status disconnected';
      statusDiv.textContent = 'Disconnected from chat';
      connectButton.textContent = 'Connect';
    });

    client.on('message', async (channel, tags, message, self) => {
      addChatMessage(tags['display-name'], message, tags);
      
      // Handle drop command
      if (gameEnabled && message.toLowerCase().trim() === '!drop') {
        handleDropCommand(tags['display-name']);
      }
      
      // Store bot's username when it first speaks
      if (self && !botUsername) {
        botUsername = tags['display-name'];
      }
      
      if (botEnabled && !self) {
        // Don't respond to bot's own messages
        if (botUsername && tags['display-name'] === botUsername) {
          return;
        }
        
        try {
          // Generate a unique identifier for this message
          const messageId = `${tags.id || tags['user-id']}_${Date.now()}_${Math.random()}`;
          
          // Add message to conversation history with user info
          conversationHistory.push({
            role: "user",
            content: `${tags['display-name']}: ${message}`,
            messageId: messageId,
            username: tags['display-name'],
            timestamp: Date.now()
          });
          
          // Keep only last 10 messages for recent context
          if (conversationHistory.length > 10) {
            const oldestMessage = conversationHistory.shift();
            if (oldestMessage.isImportant) {
              longTermMemory.push(oldestMessage);
              if (longTermMemory.length > 20) {
                longTermMemory.shift();
              }
            }
          }
          
          // Add to messages queue and signal new messages
          if (messagesQueue.length < 5) {
            messagesQueue.push({
              username: tags['display-name'],
              message: message,
              messageId: messageId,
              userId: tags['user-id'],
              timestamp: Date.now()
            });
            
            newMessagesReceived = true;
            lastMessageTime = Date.now();
            console.log(`New message queued from ${tags['display-name']}: ${message.substring(0, 50)}...`);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    });
  } catch (error) {
    console.error('Error setting up Twitch client:', error);
    statusDiv.className = 'status disconnected';
    statusDiv.textContent = `Error: ${error.message}`;
  }
}

// Generate bot response using AI
async function generateBotResponse(newMessages) {
  try {
    const context = botContext.value.trim();
    
    // Build the system message with bot context
    let systemMessage = "You are a helpful Twitch chat bot. ";
    if (context) {
      systemMessage += context;
    } else {
      systemMessage += "You are friendly, engaging, and respond naturally to chat messages. Keep responses concise and conversational.";
    }
    
    // Prepare messages for the AI
    const messages = [
      {
        role: "system",
        content: systemMessage
      }
    ];
    
    // Add long-term memory context if available
    if (longTermMemory.length > 0) {
      const memoryContext = longTermMemory.map(msg => msg.content).join('\n');
      messages.push({
        role: "system",
        content: `Previous important interactions: ${memoryContext}`
      });
    }
    
    // Add recent conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    // Generate response
    const completion = await websim.chat.completions.create({
      messages: messages
    });
    
    return completion.content;
    
  } catch (error) {
    console.error('Error generating bot response:', error);
    return null;
  }
}

// Check if any message in the queue refers to a previously processed message
function isReferringToPreviousMessage(message) {
  // Simple check - see if any usernames from processed messages appear in this new message
  for (const msgId of processedMessageIds) {
    const msgInfo = conversationHistory.find(msg => msg.messageId === msgId);
    if (msgInfo && message.toLowerCase().includes(msgInfo.username.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// Separate function to check if the bot should respond
function checkForBotResponse() {
  if (!botEnabled || isCheckingForResponse) return;
  
  isCheckingForResponse = true;
  console.log('Starting bot response checking loop...');

  const checkLoop = () => {
    if (!botEnabled) {
      console.log('Bot disabled, stopping response loop');
      isCheckingForResponse = false;
      return;
    }

    const now = Date.now();
    const timeElapsed = now - lastMessageTime;
    const responseDelay = Math.random() * 5000 + 7000; // 7-12 seconds as requested
    
    console.log(`Checking for response - Time elapsed: ${timeElapsed}ms, Required: ${responseDelay}ms, Queue: ${messagesQueue.length}, Pondering: ${isPondering}, Cooldown: ${botResponseCooldown}`);
    
    // Check if we should respond
    if (newMessagesReceived && timeElapsed > responseDelay && !isPondering && !botResponseCooldown && messagesQueue.length > 0) {
      console.log('Conditions met for bot response, generating...');
      
      // Get unprocessed messages
      const newMessages = messagesQueue.filter(msg => !processedMessageIds.has(msg.messageId));
      
      if (newMessages.length > 0) {
        isPondering = true;
        botResponseCooldown = true;
        newMessagesReceived = false;
        
        console.log(`Generating response for ${newMessages.length} messages`);
        
        // Generate response with a shorter pondering delay
        const ponderTime = Math.random() * 1000 + 500; // 0.5-1.5 seconds
        setTimeout(() => {
          generateBotResponse(newMessages)
            .then(botResponse => {
              if (botResponse && botEnabled) {
                try {
                  console.log('Playing bot response as TTS:', botResponse.substring(0, 100) + '...');
                  speak(botResponse);
                  
                  // Mark messages as processed
                  newMessages.forEach(msg => {
                    processedMessageIds.add(msg.messageId);
                  });
                  
                  // Add bot's response to conversation history
                  conversationHistory.push({
                    role: "assistant",
                    content: botResponse,
                    timestamp: Date.now()
                  });
                  
                  // Clean up processed messages from queue
                  messagesQueue = messagesQueue.filter(msg => !processedMessageIds.has(msg.messageId));
                  
                  // Shorter cooldown period (10 seconds)
                  setTimeout(() => {
                    botResponseCooldown = false;
                    console.log('Bot response cooldown ended');
                  }, 10000);
                  
                  // Update last message time to prevent immediate re-triggering
                  lastMessageTime = Date.now();
                } catch (err) {
                  console.error('Error in bot response handling:', err);
                  botResponseCooldown = false;
                }
              }
              isPondering = false;
            })
            .catch(err => {
              console.error('Error generating response:', err);
              isPondering = false;
              botResponseCooldown = false;
            });
        }, ponderTime);
      } else {
        console.log('No new messages to respond to');
        newMessagesReceived = false;
      }
    }
    
    // Continue checking every 3 seconds
    setTimeout(checkLoop, 3000);
  };
  
  // Start the check loop
  checkLoop();
}

function speak(text) {
  if (!text) return;
  
  // Cancel any ongoing speech if requested to speak something new
  if (isSpeaking) {
    // For websim TTS, we'll need to track and cancel differently
    speechQueue = [];
    isSpeaking = false;
    updateTtsStatus();
  }
  
  try {
    // Split text into sentences
    const sentences = splitIntoSentences(text);
    
    // Create TTS items for each sentence and add to queue
    sentences.forEach(sentence => {
      const ttsItem = {
        id: Date.now() + Math.random(),
        transcript: sentence,
        timestamp: new Date(),
        voice: getCurrentVoiceDescription(),
        status: 'queued'
      };
      speechQueue.push(ttsItem);
    });
    
    // Update UI
    updateTtsQueueUI();
    updateTtsStatus();
    
    // Start processing the speech queue if not already speaking
    if (!isSpeaking) {
      processSpeechQueue();
    }
  } catch (error) {
    console.error('Error with speech synthesis:', error);
  }
}

function getCurrentVoiceDescription() {
  if (advancedTts) {
    if (advancedTtsMode === 'clone' && voiceCloneFile) {
      return `Voice Clone: ${voiceCloneFile.name}`;
    } else if (advancedTtsMode === 'models') {
      return `Advanced: ${selectedVoice}`;
    }
  }
  return `Standard: ${selectedVoice}`;
}

function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Split text into sentences using common sentence endings
  // This regex looks for periods, exclamation marks, or question marks followed by whitespace or end of string
  const sentences = text.split(/[.!?]+(?:\s+|$)/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
  
  // If no sentences were found (no punctuation), return the whole text as one sentence
  if (sentences.length === 0) {
    return [text.trim()];
  }
  
  return sentences;
}

// Process the speech queue one sentence at a time using websim TTS
async function processSpeechQueue() {
  if (speechQueue.length === 0) {
    isSpeaking = false;
    currentTtsItem = null;
    updateTtsStatus();
    updateTtsQueueUI();
    return;
  }
  
  isSpeaking = true;
  currentTtsItem = speechQueue.shift();
  currentTtsItem.status = 'playing';
  
  updateTtsStatus();
  updateTtsQueueUI();
  
  try {
    let ttsOptions = {
      text: currentTtsItem.transcript
    };
    
    // Determine which TTS method to use based on advanced TTS settings
    if (advancedTts) {
      if (advancedTtsMode === 'clone' && voiceCloneFile) {
        // Use voice cloning with uploaded file
        // Convert File object to data URL for websim TTS
        const reader = new FileReader();
        const fileDataUrl = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(voiceCloneFile);
        });
        ttsOptions.voice_sample = fileDataUrl;
      } else if (advancedTtsMode === 'models') {
        // Use advanced TTS models
        ttsOptions.voice = selectedVoice;
        ttsOptions.advanced = true;
      } else {
        // Fallback to regular TTS if advanced settings are incomplete
        ttsOptions.voice = selectedVoice;
      }
    } else {
      // Use standard TTS with selected voice
      ttsOptions.voice = selectedVoice;
    }
    
    const result = await websim.textToSpeech(ttsOptions);
    currentTtsItem.audioUrl = result.url;
    
    // Create audio element and play
    const audio = new Audio(result.url);
    audio.volume = volume;
    
    audio.onended = () => {
      // Move completed item to history
      currentTtsItem.status = 'completed';
      ttsHistory.unshift(currentTtsItem);
      
      // Keep history manageable (max 50 items)
      if (ttsHistory.length > 50) {
        ttsHistory.pop();
      }
      
      updateTtsHistoryUI();
      processSpeechQueue();
    };
    
    audio.onerror = (error) => {
      console.error('TTS audio error:', error);
      currentTtsItem.status = 'error';
      ttsHistory.unshift(currentTtsItem);
      updateTtsHistoryUI();
      processSpeechQueue();
    };
    
    await audio.play();
    
  } catch (error) {
    console.error('TTS generation error:', error);
    // Fall back to browser speech synthesis for this sentence
    fallbackToBuiltInTTS(currentTtsItem.transcript);
  }
}

// Fallback to built-in browser TTS if websim TTS fails
function fallbackToBuiltInTTS(sentence) {
  if (!('speechSynthesis' in window)) {
    currentTtsItem.status = 'error';
    ttsHistory.unshift(currentTtsItem);
    updateTtsHistoryUI();
    processSpeechQueue();
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.volume = volume;
  
  utterance.onend = () => {
    currentTtsItem.status = 'completed';
    currentTtsItem.voice += ' (Fallback)';
    ttsHistory.unshift(currentTtsItem);
    updateTtsHistoryUI();
    processSpeechQueue();
  };
  
  utterance.onerror = (error) => {
    console.error('Fallback TTS error:', error);
    currentTtsItem.status = 'error';
    ttsHistory.unshift(currentTtsItem);
    updateTtsHistoryUI();
    processSpeechQueue();
  };
  
  speechSynthesis.speak(utterance);
}

function updateTtsStatus() {
  if (isSpeaking && currentTtsItem) {
    ttsStatusSpan.textContent = 'Playing';
    ttsStatusSpan.className = 'playing';
  } else {
    ttsStatusSpan.textContent = 'Idle';
    ttsStatusSpan.className = 'idle';
  }
}

function updateTtsQueueUI() {
  queueCountSpan.textContent = speechQueue.length;
  ttsQueueDiv.innerHTML = '';
  
  // Show currently playing item first if exists
  if (currentTtsItem && currentTtsItem.status === 'playing') {
    const itemDiv = createTtsItemElement(currentTtsItem, true);
    ttsQueueDiv.appendChild(itemDiv);
  }
  
  // Show queued items
  speechQueue.forEach(item => {
    const itemDiv = createTtsItemElement(item, false);
    ttsQueueDiv.appendChild(itemDiv);
  });
}

function updateTtsHistoryUI() {
  ttsHistoryDiv.innerHTML = '';
  
  ttsHistory.forEach(item => {
    const itemDiv = createTtsItemElement(item, false);
    ttsHistoryDiv.appendChild(itemDiv);
  });
}

function createTtsItemElement(item, isCurrentlyPlaying) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'tts-item';
  
  if (isCurrentlyPlaying) {
    itemDiv.classList.add('current-playing');
  }
  
  const transcriptDiv = document.createElement('div');
  transcriptDiv.className = 'tts-transcript';
  transcriptDiv.textContent = item.transcript;
  
  const metaDiv = document.createElement('div');
  metaDiv.className = 'tts-meta';
  
  const timestampDiv = document.createElement('div');
  timestampDiv.className = 'tts-timestamp';
  timestampDiv.textContent = item.timestamp.toLocaleTimeString();
  
  const voiceDiv = document.createElement('div');
  voiceDiv.className = 'tts-voice';
  voiceDiv.textContent = item.voice;
  
  metaDiv.appendChild(timestampDiv);
  metaDiv.appendChild(voiceDiv);
  
  // Add status for completed items
  if (item.status === 'error') {
    const statusDiv = document.createElement('div');
    statusDiv.style.color = '#dc3545';
    statusDiv.textContent = 'Error';
    metaDiv.appendChild(statusDiv);
  }
  
  itemDiv.appendChild(transcriptDiv);
  itemDiv.appendChild(metaDiv);
  
  return itemDiv;
}

// Handle stop speech button
stopSpeechButton.addEventListener('click', () => {
  // Stop websim TTS by clearing queue and stopping current audio
  speechQueue = [];
  isSpeaking = false;
  
  if (currentTtsItem) {
    currentTtsItem.status = 'cancelled';
    ttsHistory.unshift(currentTtsItem);
    currentTtsItem = null;
  }
  
  // Also stop any fallback speech synthesis
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  // Stop any currently playing audio elements
  const audioElements = document.querySelectorAll('audio');
  audioElements.forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
  
  updateTtsStatus();
  updateTtsQueueUI();
  updateTtsHistoryUI();
  
  console.log('All speech stopped');
});

function disconnectFromChat() {
  if (client) {
    try {
      // Cancel any ongoing speech when disconnecting
      if (isSpeaking) {
        speechSynthesis.cancel();
        isSpeaking = false;
        speechQueue = [];
      }
      
      client.disconnect()
        .then(() => {
          console.log('Successfully disconnected from Twitch');
          client = null;
        })
        .catch(err => {
          console.error('Error disconnecting from Twitch:', err);
        });
    } catch (error) {
      console.error('Error during disconnect:', error);
      client = null;
    }
  }
}

function addChatMessage(username, message, tags) {
  try {
    // Store message for popout
    allChatMessages.push({ username, message, tags });
    
    // Keep only last 1000 messages
    if (allChatMessages.length > 1000) {
      allChatMessages.shift();
    }
    
    // Send to popout if open
    sendMessageToPopout(username, message, tags);

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    if (tags.bot) {
      messageDiv.className += ' bot-message';
    }

    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = timestamp;
    messageDiv.appendChild(timestampSpan);

    // Add username
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = username;
    messageDiv.appendChild(usernameSpan);

    // Add message
    const messageText = document.createElement('span');
    messageText.textContent = `: ${message}`;
    messageDiv.appendChild(messageText);

    // Add to chat box and scroll to bottom
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Limit messages to prevent memory issues
    while (chatBox.children.length > 500) {
      chatBox.removeChild(chatBox.firstChild);
    }
  } catch (error) {
    console.error('Error adding chat message to UI:', error);
  }
}

// Handle Enter key in input
channelInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});

// Clear TTS history
clearTtsHistoryBtn.addEventListener('click', () => {
  ttsHistory = [];
  updateTtsHistoryUI();
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check for OBS overlay mode
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('obs') === 'true') {
    // Enable overlay mode
    document.documentElement.setAttribute('data-theme', 'overlay');
    themeSelect.value = 'overlay';
    
    // Hide main container and show only game overlay
    document.querySelector('.container').style.display = 'none';
    document.getElementById('game-overlay').classList.add('active');
    
    // Auto-enable game
    gameEnabled = true;
    gameToggle.checked = true;
    initializeGame();
    
    // Make body transparent
    document.body.style.background = 'transparent';
  }
  
  // Generate OBS URL and show it
  updateObsUrl();
});

function updateObsUrl() {
  const currentUrl = window.location.href.split('?')[0];
  const obsUrl = `${currentUrl}?obs=true`;
  
  // Create or update OBS URL display
  let obsUrlDisplay = document.getElementById('obs-url-display');
  if (!obsUrlDisplay) {
    obsUrlDisplay = document.createElement('div');
    obsUrlDisplay.id = 'obs-url-display';
    obsUrlDisplay.style.marginTop = '10px';
    obsUrlDisplay.style.padding = '10px';
    obsUrlDisplay.style.background = 'var(--chat-bg)';
    obsUrlDisplay.style.border = '1px solid var(--border-color)';
    obsUrlDisplay.style.borderRadius = '4px';
    obsUrlDisplay.style.fontSize = '0.9em';
    
    const label = document.createElement('strong');
    label.textContent = 'OBS Browser Source URL: ';
    obsUrlDisplay.appendChild(label);
    
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.readOnly = true;
    urlInput.value = obsUrl;
    urlInput.style.width = '100%';
    urlInput.style.marginTop = '5px';
    urlInput.style.padding = '5px';
    urlInput.style.background = 'var(--container-bg)';
    urlInput.style.color = 'var(--text-color)';
    urlInput.style.border = '1px solid var(--border-color)';
    urlInput.style.borderRadius = '4px';
    urlInput.style.fontSize = '0.9em';
    
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy URL';
    copyBtn.style.marginTop = '5px';
    copyBtn.style.padding = '5px 10px';
    copyBtn.style.fontSize = '0.9em';
    copyBtn.onclick = () => {
      urlInput.select();
      document.execCommand('copy');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy URL';
      }, 2000);
    };
    
    obsUrlDisplay.appendChild(urlInput);
    obsUrlDisplay.appendChild(copyBtn);
    
    // Insert after game controls
    const gameControls = document.querySelector('.game-controls');
    gameControls.appendChild(obsUrlDisplay);
  }
}

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});