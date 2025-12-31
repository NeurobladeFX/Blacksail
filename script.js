// ===================================================
// CLIENT-SIDE SCRIPT - Socket.io Multiplayer Client
// ===================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const WORLD_WIDTH = 32000;
const WORLD_HEIGHT = 32000;

// Ship sizes
const shipSizes = {
    1: 120, 2: 150, 3: 180, 4: 210, 5: 240, 6: 270, 7: 300
};

// Game state (received from server)
let localPlayer = null;
let players = [];
let bots = [];
let islands = [];
let collectibles = [];
let cannonballs = [];
let camera = { x: 0, y: 0, zoom: 1 };
let lastTime = 0;
let fps = 0;

// Image cache
const images = {};

// Socket connection
let socket = null;
let playerId = null;
let connected = false;

// Input state
const keys = {
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false
};

const mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
let firing = false;

// Audio
const bgMusic = new Audio('assets/pirate.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;

const fireSound = new Audio('assets/fire.mp3');
fireSound.volume = 0.4;

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (e.key && e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key && e.key.toLowerCase() in keys) {
        keys[e.key.toLowerCase()] = false;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    if (camera) {
        mouse.worldX = (mouse.x / camera.zoom) + camera.x;
        mouse.worldY = (mouse.y / camera.zoom) + camera.y;
    }
});

canvas.addEventListener('click', () => {
    firing = true;
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

document.getElementById('weighAnchorBtn').addEventListener('click', () => {
    const playerName = document.getElementById('pirateName').value.trim() || 'Player';
    startGame(playerName);
});

document.getElementById('respawnBtn').addEventListener('click', () => {
    document.getElementById('respawnScreen').style.display = 'none';
    const playerName = localPlayer ? localPlayer.name : 'Player';
    socket.emit('joinGame', playerName);
});

// Auto-upgrade - no manual button needed

// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

// Joystick state
let joystickActive = false;
let joystickAngle = 0;
let joystickPower = 0;

if (isMobile) {
    document.getElementById('joystick-container').style.display = 'block';

    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');

    const handleJoystickMove = (clientX, clientY) => {
        const rect = joystickBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), 45);

        joystickAngle = Math.atan2(deltaY, deltaX);
        joystickPower = distance / 45;

        const stickX = Math.cos(joystickAngle) * distance;
        const stickY = Math.sin(joystickAngle) * distance;

        joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    };

    const resetJoystick = () => {
        joystickActive = false;
        joystickPower = 0;
        joystickStick.style.transform = 'translate(-50%, -50%)';
    };

    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const touch = e.touches[0];
        handleJoystickMove(touch.clientX, touch.clientY);
    });

    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (joystickActive) {
            const touch = e.touches[0];
            handleJoystickMove(touch.clientX, touch.clientY);
        }
    });

    joystickBase.addEventListener('touchend', (e) => {
        e.preventDefault();
        resetJoystick();
    });

    // Touch firing
    canvas.addEventListener('touchstart', (e) => {
        if (e.target === canvas) {
            e.preventDefault();
            firing = true;
        }
    });
}

// Preload images
function preloadImages(imagePaths) {
    return new Promise((resolve, reject) => {
        let loadedCount = 0;
        const totalImages = imagePaths.length;

        if (totalImages === 0) {
            resolve();
            return;
        }

        imagePaths.forEach(path => {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                images[path] = img;
                loadedCount++;
                if (loadedCount === totalImages) {
                    resolve();
                }
            };
            img.onerror = () => {
                console.error(`[CLIENT] Failed to load image: ${path}`);
                loadedCount++; // Count it as 'loaded' to not block the game
                if (loadedCount === totalImages) {
                    resolve(); // or reject, depending on desired behavior
                }
            };
        });
    });
}

// Connect to server and start game
async function startGame(playerName) {
    console.log('[CLIENT] Preloading assets...');
    const imagePaths = [
        'assets/Island.png',
        'assets/island1.png',
        'assets/Wood.png',
        'assets/crew_face.png',
        ...Array.from({ length: 7 }, (_, i) => `assets/ship${i + 1}.png`)
    ];
    await preloadImages(imagePaths);
    console.log('[CLIENT] Assets loaded.');

    console.log('[CLIENT] Connecting to server...');

    // Play background music
    bgMusic.play().catch(e => console.log('Audio play failed:', e));

    // Hide menu, show game
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';

    // Connect to server
    socket = io(serverUrl);

    socket.on('connect', () => {
        console.log('[CLIENT] Connected to server!');
        connected = true;
        socket.emit('joinGame', playerName);
    });

    socket.on('gameInit', (data) => {
        console.log('[CLIENT] Game initialized!', data);
        playerId = data.playerId;
        islands = data.islands;
        localPlayer = data.player;

        // Start render loop
        requestAnimationFrame(renderLoop);
    });

    socket.on('gameState', (state) => {
        // Update players
        state.players.forEach(serverPlayer => {
            let p = players.find(player => player.id === serverPlayer.id);
            if (p) { // Existing player
                if (p.id === playerId) {
                    // Local player: update directly from server for authority
                    p.x = serverPlayer.x;
                    p.y = serverPlayer.y;
                    p.angle = serverPlayer.angle;
                } else {
                    // Other players: set target for interpolation
                    p.targetX = serverPlayer.x;
                    p.targetY = serverPlayer.y;
                    p.targetAngle = serverPlayer.angle;
                }
                // Common properties
                p.shipLevel = serverPlayer.shipLevel;
                p.health = serverPlayer.health;
                p.maxHealth = serverPlayer.maxHealth;
                p.gold = serverPlayer.gold;
                p.crew = serverPlayer.crew;
                p.maxCrew = serverPlayer.maxCrew;
                p.wood = serverPlayer.wood || 0;
                p.name = serverPlayer.name;
            } else { // New player
                serverPlayer.x = serverPlayer.x;
                serverPlayer.y = serverPlayer.y;
                serverPlayer.targetX = serverPlayer.x;
                serverPlayer.targetY = serverPlayer.y;
                serverPlayer.angle = serverPlayer.angle;
                serverPlayer.targetAngle = serverPlayer.angle;
                players.push(serverPlayer);
            }
        });
        // Remove old players
        players = players.filter(p => state.players.some(sp => sp.id === p.id));

        // Update bots (always interpolate)
        state.bots.forEach(serverBot => {
            let b = bots.find(bot => bot.id === serverBot.id);
            if (b) {
                b.targetX = serverBot.x;
                b.targetY = serverBot.y;
                b.targetAngle = serverBot.angle;
                b.shipLevel = serverBot.shipLevel;
                b.health = serverBot.health;
                b.maxHealth = serverBot.maxHealth;
                b.name = serverBot.name;
            } else {
                serverBot.x = serverBot.x;
                serverBot.y = serverBot.y;
                serverBot.targetX = serverBot.x;
                serverBot.targetY = serverBot.y;
                serverBot.angle = serverBot.angle;
                serverBot.targetAngle = serverBot.angle;
                bots.push(serverBot);
            }
        });
        // Remove old bots
        bots = bots.filter(b => state.bots.some(sb => sb.id === b.id));

        cannonballs = state.cannonballs;
        collectibles = state.collectibles;

        // Update localPlayer reference
        localPlayer = players.find(p => p.id === playerId);
    });

    socket.on('playerDeath', () => {
        console.log('[CLIENT] You died!');
        document.getElementById('respawnScreen').style.display = 'block';
    });

    socket.on('serverFull', () => {
        alert('Server is full! Maximum 200 players.');
        document.getElementById('main-menu').style.display = 'block';
        document.getElementById('gameCanvas').style.display = 'none';
    });

    socket.on('disconnect', () => {
        console.log('[CLIENT] Disconnected from server');
        connected = false;
    });

    // Send input to server periodically
    setInterval(() => {
        if (socket && connected && localPlayer) {
            // Mobile joystick input
            if (isMobile && joystickActive) {
                keys.w = joystickPower > 0.2;
                keys.a = false;
                keys.d = false;
                // Set player angle based on joystick
                const targetAngle = joystickAngle;
                if (localPlayer.angle) {
                    // Smooth rotation
                    let angleDiff = targetAngle - localPlayer.angle;
                    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                    if (Math.abs(angleDiff) > 0.05) {
                        keys.a = angleDiff < 0;
                        keys.d = angleDiff > 0;
                    }
                }
            }

            const mouseAngle = Math.atan2(mouse.worldY - localPlayer.y, mouse.worldX - localPlayer.x);

            socket.emit('playerInput', {
                keys: keys,
                mouseAngle: mouseAngle,
                firing: firing
            });

            firing = false; // Reset firing
        }
    }, 50); // Send input 20 times per second
}

// Render loop (60 FPS)
function renderLoop() {
    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;
    fps = Math.round(1000 / delta);
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!localPlayer) {
        requestAnimationFrame(renderLoop);
        return;
    }

    // Interpolate other entities
    const interpolationFactor = 0.2;
    players.forEach(p => {
        if (p.id !== playerId && p.targetX !== undefined) {
            p.x += (p.targetX - p.x) * interpolationFactor;
            p.y += (p.targetY - p.y) * interpolationFactor;
            let angleDiff = p.targetAngle - p.angle;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            p.angle += angleDiff * interpolationFactor;
        }
    });
    bots.forEach(b => {
        if (b.targetX !== undefined) {
            b.x += (b.targetX - b.x) * interpolationFactor;
            b.y += (b.targetY - b.y) * interpolationFactor;
            let angleDiff = b.targetAngle - b.angle;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            b.angle += angleDiff * interpolationFactor;
        }
    });

    // Update camera
    updateCamera();

    // Apply camera transformations
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    const view = {
        x: camera.x,
        y: camera.y,
        w: canvas.width / camera.zoom,
        h: canvas.height / camera.zoom
    };

    // Draw islands
    islands.forEach(island => {
        if (island.x + island.size > view.x && island.x - island.size < view.x + view.w &&
            island.y + island.size > view.y && island.y - island.size < view.y + view.h) {
            drawIsland(island);
        }
    });

    // Draw collectibles
    collectibles.forEach(c => {
        if (c.x > view.x && c.x < view.x + view.w && c.y > view.y && c.y < view.y + view.h) {
            drawCollectible(c);
        }
    });

    // Draw local player
    if (localPlayer) drawShip(localPlayer, true);

    // Draw other players and bots
    players.forEach(p => {
        if (p.id !== playerId) {
            if (p.x > view.x - 100 && p.x < view.x + view.w + 100 && p.y > view.y - 100 && p.y < view.y + view.h + 100) {
                drawShip(p, false);
            }
        }
    });
    bots.forEach(b => {
        if (b.x > view.x - 100 && b.x < view.x + view.w + 100 && b.y > view.y - 100 && b.y < view.y + view.h + 100) {
            drawShip(b, false);
        }
    });

    // Draw cannonballs
    cannonballs.forEach(cb => {
        if (cb.x > view.x && cb.x < view.x + view.w && cb.y > view.y && cb.y < view.y + view.h) {
            drawCannonball(cb);
        }
    });

    ctx.restore();

    // Update UI
    updateUI();

    // Draw FPS
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`FPS: ${fps}`, 10, 30);

    requestAnimationFrame(renderLoop);
}

function updateCamera() {
    if (!localPlayer) return;

    // Smooth zoom based on ship size
    const targetZoom = 0.6 - (shipSizes[localPlayer.shipLevel] - 120) / 500;
    camera.zoom += (Math.max(0.3, targetZoom) - camera.zoom) * 0.1;

    // Center on player
    camera.x = localPlayer.x - (canvas.width / 2) / camera.zoom;
    camera.y = localPlayer.y - (canvas.height / 2) / camera.zoom;
}

// Drawing functions
function drawIsland(island) {
    const img = images[island.imageType === 0 ? 'assets/Island.png' : 'assets/island1.png'];
    if (img) {
        ctx.drawImage(img, island.x - island.size, island.y - island.size, island.size * 2, island.size * 2);
    }
}

function drawCollectible(c) {
    if (c.type === 'gold') {
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else if (c.type === 'wood') {
        const img = images['assets/Wood.png'];
        if (img) ctx.drawImage(img, c.x - 22.5, c.y - 22.5, 45, 45);
    } else if (c.type === 'crew') {
        const img = images['assets/crew_face.png'];
        if (img) ctx.drawImage(img, c.x - 50, c.y - 50, 100, 100);
    }
}

function drawShip(ship, isLocal) {
    // Ensure shipLevel is valid, default to 1 if not
    const shipLevel = ship.shipLevel && shipSizes[ship.shipLevel] ? ship.shipLevel : 1;
    const size = shipSizes[shipLevel];
    const width = size;
    const height = size;

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    // Draw ship image
    const img = images[`assets/ship${shipLevel}.png`];
    if (img) {
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
    }

    ctx.restore();

    // Draw name and health bar
    ctx.save();
    ctx.translate(ship.x, ship.y);

    const topOfShip = -size / 2;

    // Name
    ctx.fillStyle = isLocal ? '#FFD700' : 'white';
    ctx.font = isLocal ? 'bold 20px Arial' : '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(ship.name, 0, topOfShip - 25);

    // Health bar
    const healthBarWidth = 60;
    const healthBarHeight = 8;
    const healthPercentage = ship.health / ship.maxHealth;
    ctx.fillStyle = '#333';
    ctx.fillRect(-healthBarWidth / 2, topOfShip - 15, healthBarWidth, healthBarHeight);
    ctx.fillStyle = healthPercentage > 0.5 ? 'green' : (healthPercentage > 0.2 ? 'orange' : 'red');
    ctx.fillRect(-healthBarWidth / 2, topOfShip - 15, healthBarWidth * healthPercentage, healthBarHeight);

    ctx.restore();
}

function drawCannonball(cb) {
    // Draw cannonball tail
    const tailLength = 8;
    for (let i = tailLength; i > 0; i--) {
        const t = i / tailLength;
        const tailX = cb.x - Math.cos(cb.angle) * cb.speed * i * 2;
        const tailY = cb.y - Math.sin(cb.angle) * cb.speed * i * 2;
        ctx.save();
        ctx.globalAlpha = 0.08 + 0.12 * t;
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(tailX, tailY, 7 - t * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Draw cannonball
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cb.x, cb.y, 8, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(cb.x - 2, cb.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

let lastUIState = {};

function updateUI() {
    if (!localPlayer) return;

    const newState = {
        gold: localPlayer.gold || 0,
        wood: localPlayer.wood || 0,
        crew: `${localPlayer.crew}/${localPlayer.maxCrew}`,
        shipLevel: localPlayer.shipLevel,
    };

    if (newState.gold !== lastUIState.gold) {
        document.getElementById('gold-stat').textContent = newState.gold;
    }
    if (newState.wood !== lastUIState.wood) {
        document.getElementById('wood-stat').textContent = newState.wood;
    }
    if (newState.crew !== lastUIState.crew) {
        document.getElementById('crew-stat').textContent = newState.crew;
    }
    if (newState.shipLevel !== lastUIState.shipLevel) {
        document.getElementById('ship-level').textContent = newState.shipLevel;
    }

    // Auto-upgrade display (top center)
    const autoUpgradeDisplay = document.getElementById('auto-upgrade-display');
    if (localPlayer.shipLevel >= 7) {
        if (autoUpgradeDisplay.style.display !== 'none') {
            autoUpgradeDisplay.style.display = 'none';
        }
    } else {
        if (autoUpgradeDisplay.style.display !== 'block') {
            autoUpgradeDisplay.style.display = 'block';
        }

        const upgradeCost = 10 + localPlayer.shipLevel * 5;
        const currentWood = localPlayer.wood || 0;
        const woodProgress = Math.min(100, (currentWood / upgradeCost) * 100);

        if (localPlayer.shipLevel !== lastUIState.shipLevel) {
            document.getElementById('current-level').textContent = localPlayer.shipLevel;
            document.getElementById('next-level').textContent = localPlayer.shipLevel + 1;
        }

        const progressWidth = `${woodProgress}%`;
        if (progressWidth !== lastUIState.progressWidth) {
            document.getElementById('upgrade-progress').style.width = progressWidth;
        }
        
        const progressText = `${currentWood} / ${upgradeCost} Wood`;
        if (progressText !== lastUIState.progressText) {
            document.getElementById('upgrade-progress-text').textContent = progressText;
        }

        if (currentWood >= upgradeCost) {
            if (lastUIState.upgradeStatus !== "UPGRADING...") {
                document.getElementById('upgrade-progress-text').style.color = "#00ff00";
                document.getElementById('upgrade-progress-text').textContent = "UPGRADING...";
                lastUIState.upgradeStatus = "UPGRADING...";
            }
        } else {
            if (lastUIState.upgradeStatus !== "default") {
                document.getElementById('upgrade-progress-text').style.color = "#FFD700";
                lastUIState.upgradeStatus = "default";
            }
        }
        newState.progressWidth = progressWidth;
        newState.progressText = progressText;
    }

    lastUIState = newState;
}

function updateLeaderboard() {
    if (!players.length && !bots.length) return;

    const titles = [
        "Pirate King", "Grand Admiral", "Fleet Commander", "Captain", "Commander",
        "Lieutenant", "Ensign", "Boatswain", "Sailor", "Powder Monkey"
    ];

    const allShips = [...players, ...bots].sort((a, b) => (b.gold || 0) - (a.gold || 0));
    const leaderboardList = document.getElementById('leaderboard-list');

    if (leaderboardList) {
        leaderboardList.innerHTML = '';

        const playerRank = allShips.findIndex(ship => ship.id === playerId) + 1;
        const top10 = allShips.slice(0, 10);

        top10.forEach((ship, index) => {
            const li = document.createElement('li');
            const rankTitle = titles[index] || "Scallywag";
            li.innerHTML = `<span>${index + 1}. [${rankTitle}] ${ship.name}</span><span>${ship.gold || 0}</span>`;
            if (ship.id === playerId) li.style.fontWeight = 'bold';
            leaderboardList.appendChild(li);
        });

        const footer = document.getElementById('leaderboard-footer');
        if (footer) {
            const myTitle = titles[playerRank - 1] || "Scallywag";
            footer.textContent = `Your Rank: ${playerRank} [${myTitle}]`;
        }

        if (playerRank > 10) {
            leaderboardList.appendChild(document.createElement('li')).textContent = "...";
            const playerLi = document.createElement('li');
            playerLi.innerHTML = `<span>${playerRank}. ${localPlayer.name}</span><span>${localPlayer.gold || 0}</span>`;
            playerLi.style.fontWeight = 'bold';
            leaderboardList.appendChild(playerLi);
        }
    }
}

// Throttled leaderboard update
setInterval(updateLeaderboard, 1000);


// Disable shop buttons (not implemented in multiplayer version yet)
document.getElementById('open-shop-btn').style.display = 'none';
document.getElementById('exploreUI').style.display = 'none';

console.log('[CLIENT] Blacksail.io Client Loaded - Ready to connect!');