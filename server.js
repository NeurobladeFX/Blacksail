const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const WORLD_WIDTH = 32000;
const WORLD_HEIGHT = 32000;
const MAX_ENTITIES = 200;
const TICK_RATE = 60; // Server ticks per second
const NETWORK_UPDATE_RATE = 20; // Send updates to clients 20 times per second
const INITIAL_BOTS = 50;
const INITIAL_ISLANDS = 200;
const INITIAL_COLLECTIBLES = 5000;

// Ship sizes matching client
const shipSizes = {
    1: 120, 2: 150, 3: 180, 4: 210, 5: 240, 6: 270, 7: 300
};

// Game state
const gameState = {
    players: new Map(),
    bots: new Map(),
    islands: [],
    collectibles: [],
    cannonballs: []
};

let botIdCounter = 0;
let cannonballIdCounter = 0;
let collectibleIdCounter = 0;

// Spatial grid for collision optimization
const GRID_SIZE = 1000;
const grid = new Map();

function getGridKey(x, y) {
    const gridX = Math.floor(x / GRID_SIZE);
    const gridY = Math.floor(y / GRID_SIZE);
    return `${gridX},${gridY}`;
}

function addToGrid(entity) {
    const key = getGridKey(entity.x, entity.y);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(entity);
}

function getNearbyEntities(x, y, radius = GRID_SIZE) {
    const entities = [];
    const cellsToCheck = Math.ceil(radius / GRID_SIZE);

    for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
        for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
            const gridX = Math.floor(x / GRID_SIZE) + dx;
            const gridY = Math.floor(y / GRID_SIZE) + dy;
            const key = `${gridX},${gridY}`;
            if (grid.has(key)) {
                entities.push(...grid.get(key));
            }
        }
    }
    return entities;
}

// Initialize game world
function initializeWorld() {
    console.log('[INIT] Initializing game world...');

    // Create islands
    for (let i = 0; i < INITIAL_ISLANDS; i++) {
        gameState.islands.push({
            id: i,
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT,
            size: 300 + Math.random() * 400,
            imageType: Math.floor(Math.random() * 2)
        });
    }

    // Create collectibles
    for (let i = 0; i < INITIAL_COLLECTIBLES; i++) {
        const rand = Math.random();
        let type;
        if (rand < 0.4) type = 'gold';
        else if (rand < 0.9) type = 'wood';
        else type = 'crew';

        gameState.collectibles.push({
            id: collectibleIdCounter++,
            type: type,
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT,
            value: type === 'gold' ? 10 : (type === 'wood' ? 5 : 1)
        });
    }

    // Create bots
    for (let i = 0; i < INITIAL_BOTS; i++) {
        createBot();
    }

    console.log(`[INIT] World created: ${gameState.islands.length} islands, ${gameState.collectibles.length} collectibles, ${gameState.bots.size} bots`);
}

// Create a bot
function createBot() {
    if (gameState.bots.size + gameState.players.size >= MAX_ENTITIES) return; // Prevent overflow

    const botNames = ['Arjun', 'Vikram', 'Rohan', 'Priya', 'Ananya', 'Jack', 'William', 'James', 'Emily', 'Sophia',
        'Blackbeard', 'Calico', 'Morgan', 'Drake', 'Kidd', 'Teach', 'Sparrow', 'Turner', 'Swann', 'Barbossa'];

    const bot = {
        id: `bot_${botIdCounter++}`,
        name: botNames[Math.floor(Math.random() * botNames.length)] + Math.floor(Math.random() * 1000),
        isBot: true,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        angle: Math.random() * 2 * Math.PI,
        speed: 0,
        maxSpeed: 4,
        shipLevel: Math.floor(Math.random() * 2) + 1,
        health: 100,
        maxHealth: 100,
        gold: 0,
        wood: 0,
        crew: 5,
        maxCrew: 10,
        lastFire: 0,
        target: null,
        aiMode: 'hunt', // hunt, collect, flee
        aiCooldown: 0
    };

    updateShipStats(bot);
    gameState.bots.set(bot.id, bot);
    return bot;
}

// Update ship stats based on level
function updateShipStats(ship) {
    // Ensure shipLevel is always valid
    if (!ship.shipLevel || ship.shipLevel < 1 || ship.shipLevel > 7) ship.shipLevel = 1;
    ship.maxHealth = 100 + (ship.shipLevel - 1) * 20;
    ship.health = Math.min(ship.health, ship.maxHealth);
    ship.maxSpeed = 4 + (ship.shipLevel - 1) * 0.4;
    ship.maxCrew = 10 + (ship.shipLevel - 1) * 5;
    ship.size = shipSizes[ship.shipLevel] || 120;
}

// Smart bot AI with predictive aiming and pack behavior
function updateBotAI(bot) {
    const allShips = [...gameState.players.values(), ...gameState.bots.values()];
    const nearbyShips = allShips.filter(s => {
        if (s.id === bot.id) return false;
        const dist = Math.hypot(s.x - bot.x, s.y - bot.y);
        return dist < 2000;
    });

    // Determine AI mode
    if (bot.health < bot.maxHealth * 0.3) {
        bot.aiMode = 'flee';
    } else if (bot.wood < 10 + bot.shipLevel * 5 && Math.random() < 0.3) {
        bot.aiMode = 'collect';
    } else {
        bot.aiMode = 'hunt';
    }

    // AI Decision making
    if (bot.aiMode === 'flee') {
        // Flee from nearest threat
        const threat = nearbyShips.sort((a, b) => {
            const distA = Math.hypot(a.x - bot.x, a.y - bot.y);
            const distB = Math.hypot(b.x - bot.x, b.y - bot.y);
            return distA - distB;
        })[0];

        if (threat) {
            const angle = Math.atan2(bot.y - threat.y, bot.x - threat.x);
            bot.angle = angle;
            bot.speed = bot.maxSpeed;
        }
    } else if (bot.aiMode === 'collect') {
        // Find nearest wood/gold
        const nearbyCollectibles = gameState.collectibles.filter(c => {
            const dist = Math.hypot(c.x - bot.x, c.y - bot.y);
            return dist < 1500 && (c.type === 'wood' || c.type === 'gold');
        });

        if (nearbyCollectibles.length > 0) {
            const closest = nearbyCollectibles.sort((a, b) => {
                const distA = Math.hypot(a.x - bot.x, a.y - bot.y);
                const distB = Math.hypot(b.x - bot.x, b.y - bot.y);
                return distA - distB;
            })[0];

            const angle = Math.atan2(closest.y - bot.y, closest.x - bot.x);
            bot.angle = angle;
            bot.speed = bot.maxSpeed;
        } else {
            bot.aiMode = 'hunt';
        }
    } else if (bot.aiMode === 'hunt') {
        // Hunt players or other bots
        const targets = nearbyShips.filter(s => {
            // No friendly fire for now, but bots can attack anyone
            return s.id !== bot.id;
        });

        if (targets.length > 0) {
            // Prioritize real players, then ships of different levels
            const sorted = targets.sort((a, b) => {
                if (!a.isBot && b.isBot) return -1; // Player vs Bot
                if (a.isBot && !b.isBot) return 1; // Bot vs Player
                return Math.abs(bot.shipLevel - a.shipLevel) - Math.abs(bot.shipLevel - b.shipLevel);
            });

            const target = sorted[0];
            const dx = target.x - bot.x;
            const dy = target.y - bot.y;
            const distance = Math.hypot(dx, dy);

            // Predictive aiming for harder difficulty
            const targetVelocityX = Math.cos(target.angle) * (target.speed || 0);
            const targetVelocityY = Math.sin(target.angle) * (target.speed || 0);
            const timeToHit = distance / 12; // Cannonball speed is 12

            const predictedX = target.x + targetVelocityX * timeToHit;
            const predictedY = target.y + targetVelocityY * timeToHit;

            const angle = Math.atan2(predictedY - bot.y, predictedX - bot.x);
            bot.angle = angle;
            bot.speed = bot.maxSpeed;

            // Fire at target if in range
            if (distance < 700) {
                fireCannon(bot, angle);
            }
        } else {
            // Wander
            if (bot.aiCooldown <= 0) {
                bot.angle += (Math.random() - 0.5) * 0.5;
                bot.speed = bot.maxSpeed * 0.5;
                bot.aiCooldown = 60; // Change direction every second
            }
            bot.aiCooldown--;
        }
    }

    // Auto-upgrade
    const upgradeCost = 10 + bot.shipLevel * 5;
    if (bot.wood >= upgradeCost && bot.shipLevel < 7) {
        bot.wood -= upgradeCost;
        bot.shipLevel++;
        updateShipStats(bot);
    }
}

// Fire cannon
function fireCannon(ship, targetAngle = null) {
    const now = Date.now();
    if (now - ship.lastFire < 500) return; // 500ms cooldown

    ship.lastFire = now;
    const baseAngle = targetAngle !== null ? targetAngle : ship.angle;

    let cannonballCount = 1;
    if (ship.shipLevel === 3) cannonballCount = 2;
    else if (ship.shipLevel === 4) cannonballCount = 3;
    else if (ship.shipLevel === 5) cannonballCount = 4;
    else if (ship.shipLevel === 6) cannonballCount = 5;
    else if (ship.shipLevel >= 7) cannonballCount = 6;

    const spreadAngle = 0.1;

    for (let i = 0; i < cannonballCount; i++) {
        const angle = baseAngle + (i - (cannonballCount - 1) / 2) * spreadAngle;
        gameState.cannonballs.push({
            id: cannonballIdCounter++,
            x: ship.x + Math.cos(angle) * 20,
            y: ship.y + Math.sin(angle) * 20,
            angle: angle,
            speed: 12,
            radius: 8,
            life: 100,
            ownerId: ship.id
        });
    }
}

// Update ship position
function updateShip(ship) {
    // Movement
    ship.x += Math.cos(ship.angle) * ship.speed;
    ship.y += Math.sin(ship.angle) * ship.speed;

    // Deceleration
    ship.speed *= 0.95;

    // World bounds
    ship.x = Math.max(0, Math.min(WORLD_WIDTH, ship.x));
    ship.y = Math.max(0, Math.min(WORLD_HEIGHT, ship.y));

    // Auto-upgrade when enough wood is collected
    const upgradeCost = 10 + ship.shipLevel * 5;
    if (ship.wood >= upgradeCost && ship.shipLevel < 7) {
        ship.wood -= upgradeCost;
        ship.shipLevel++;
        updateShipStats(ship);
    }
    // Health regen
    if (ship.health < ship.maxHealth) {
        ship.health = Math.min(ship.maxHealth, ship.health + 0.05);
    }
}

// Main game loop
let lastNetworkUpdate = 0;

function gameLoop() {
    const now = Date.now();

    // Clear spatial grid
    grid.clear();

    // Update all ships
    gameState.players.forEach(player => {
        updateShip(player);
        addToGrid(player);
    });

    gameState.bots.forEach(bot => {
        updateBotAI(bot);
        updateShip(bot);
        addToGrid(bot);
    });

    // Update cannonballs
    for (let i = gameState.cannonballs.length - 1; i >= 0; i--) {
        const cb = gameState.cannonballs[i];
        cb.x += Math.cos(cb.angle) * cb.speed;
        cb.y += Math.sin(cb.angle) * cb.speed;
        cb.life--;

        if (cb.life <= 0 || cb.x < 0 || cb.x > WORLD_WIDTH || cb.y < 0 || cb.y > WORLD_HEIGHT) {
            gameState.cannonballs.splice(i, 1);
        }
    }

    // Collision detection - Cannonballs vs Ships
    const allShips = [...gameState.players.values(), ...gameState.bots.values()];

    for (let i = gameState.cannonballs.length - 1; i >= 0; i--) {
        const cb = gameState.cannonballs[i];
        const nearbyShips = getNearbyEntities(cb.x, cb.y, 500);

        for (const ship of nearbyShips) {
            if (cb.ownerId !== ship.id) {
                const dist = Math.hypot(cb.x - ship.x, cb.y - ship.y);
                if (dist < ship.size / 2) {
                    const damageReduction = 1 - (ship.shipLevel * 0.1);
                    ship.health -= 10 * damageReduction;
                    gameState.cannonballs.splice(i, 1);

                    if (ship.health <= 0) {
                        handleShipDeath(ship, cb.ownerId);
                    }
                    break;
                }
            }
        }
    }

    // Ship vs Ship collision
    for (let i = 0; i < allShips.length; i++) {
        for (let j = i + 1; j < allShips.length; j++) {
            const ship1 = allShips[i];
            const ship2 = allShips[j];

            const dx = ship2.x - ship1.x;
            const dy = ship2.y - ship1.y;
            const distance = Math.hypot(dx, dy);
            const minDistance = (ship1.size + ship2.size) / 2;

            if (distance < minDistance) {
                const overlap = minDistance - distance;
                const angle = Math.atan2(dy, dx);

                const moveX = (overlap / 2) * Math.cos(angle);
                const moveY = (overlap / 2) * Math.sin(angle);

                ship1.x -= moveX;
                ship1.y -= moveY;
                ship2.x += moveX;
                ship2.y += moveY;

                // Crew loss
                ship1.crew = Math.max(0, ship1.crew - 1);
                ship2.crew = Math.max(0, ship2.crew - 1);

                if (ship1.crew <= 0) handleShipDeath(ship1);
                if (ship2.crew <= 0) handleShipDeath(ship2);
            }
        }
    }

    // Ship vs Island collision
    for (const ship of allShips) {
        for (const island of gameState.islands) {
            const dx = ship.x - island.x;
            const dy = ship.y - island.y;
            const distance = Math.hypot(dx, dy);
            const minDistance = island.size + 20;

            if (distance < minDistance) {
                const overlap = minDistance - distance;
                const angle = Math.atan2(dy, dx);
                ship.x += overlap * Math.cos(angle);
                ship.y += overlap * Math.sin(angle);
            }
        }
    }



    // Ship vs Collectibles
    for (let i = gameState.collectibles.length - 1; i >= 0; i--) {
        const collectible = gameState.collectibles[i];
        let collected = false;

        for (const ship of allShips) {
            const dx = ship.x - collectible.x;
            const dy = ship.y - collectible.y;
            const distance = Math.hypot(dx, dy);
            const attractionRadius = 150 + ship.size;

            if (distance < ship.size / 2) {
                if (collectible.type === 'gold') ship.gold = (ship.gold || 0) + collectible.value;
                if (collectible.type === 'wood') ship.wood = (ship.wood || 0) + collectible.value;
                if (collectible.type === 'crew') ship.crew = Math.min(ship.maxCrew, ship.crew + collectible.value);

                gameState.collectibles.splice(i, 1);
                collected = true;
                break;
            } else if (distance < attractionRadius) {
                const angle = Math.atan2(dy, dx);
                collectible.x += Math.cos(angle) * 3;
                collectible.y += Math.sin(angle) * 3;
            }
        }
        if (collected) continue;
    }

    // Send state to all clients (throttled to 20Hz)
    if (now - lastNetworkUpdate >= 1000 / NETWORK_UPDATE_RATE) {
        broadcastGameState();
        lastNetworkUpdate = now;
    }
}

function handleShipDeath(ship, killerId = null) {
    if (ship.isBot) {
        // Respawn bot
        gameState.bots.delete(ship.id);
        if (gameState.players.size < MAX_ENTITIES) {
            createBot();
        }

        // Award gold to killer
        if (killerId) {
            const killer = gameState.players.get(killerId) || gameState.bots.get(killerId);
            if (killer) killer.gold = (killer.gold || 0) + 10;
        }
    } else {
        // Player died - notify client
        const socket = Array.from(io.sockets.sockets.values()).find(s => s.playerId === ship.id);
        if (socket) {
            socket.emit('playerDeath');
            gameState.players.delete(ship.id);

            // Add a bot back
            if (gameState.bots.size + gameState.players.size < MAX_ENTITIES) {
                createBot();
            }
        }
    }
}

function broadcastGameState() {
    const state = {
        players: Array.from(gameState.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            x: p.x,
            y: p.y,
            angle: p.angle,
            shipLevel: p.shipLevel,
            health: p.health,
            maxHealth: p.maxHealth,
            gold: p.gold,
            crew: p.crew,
            maxCrew: p.maxCrew,
            wood: p.wood || 0
        })),
        bots: Array.from(gameState.bots.values()).map(b => ({
            id: b.id,
            name: b.name,
            x: b.x,
            y: b.y,
            angle: b.angle,
            shipLevel: b.shipLevel,
            health: b.health,
            maxHealth: b.maxHealth,
            gold: b.gold,
            wood: b.wood || 0
        })),
        cannonballs: gameState.cannonballs.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            angle: c.angle
        })),
        collectibles: gameState.collectibles.map(c => ({
            id: c.id,
            type: c.type,
            x: c.x,
            y: c.y
        }))
    };

    io.emit('gameState', state);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`[CONNECTION] New client connected: ${socket.id}`);

    socket.on('joinGame', (playerName) => {
        // Check if we can accept more players
        if (gameState.players.size >= MAX_ENTITIES) {
            socket.emit('serverFull');
            return;
        }
        // Remove a bot if present
        if (gameState.bots.size > 0) {
            const botToRemove = gameState.bots.values().next().value;
            gameState.bots.delete(botToRemove.id);
        }

        // Create player
        const player = {
            id: socket.id,
            name: playerName || 'Player',
            isBot: false,
            x: Math.random() * WORLD_WIDTH,
            y: Math.random() * WORLD_HEIGHT,
            angle: Math.random() * 2 * Math.PI,
            speed: 0,
            maxSpeed: 4,
            shipLevel: 1,
            health: 100,
            maxHealth: 100,
            gold: 0,
            wood: 0,
            crew: 10,
            maxCrew: 20,
            lastFire: 0
        };

        updateShipStats(player);
        gameState.players.set(socket.id, player);
        socket.playerId = socket.id;

        console.log(`[PLAYER] ${playerName} joined! Players: ${gameState.players.size}, Bots: ${gameState.bots.size}`);

        // Send initial game data
        socket.emit('gameInit', {
            playerId: socket.id,
            islands: gameState.islands,
            player: player
        });

        // Notify all players
        io.emit('playerJoined', { id: socket.id, name: playerName });
    });

    socket.on('playerInput', (input) => {
        const player = gameState.players.get(socket.id);
        if (!player) return;

        // Update player based on input
        if (input.keys.a || input.keys.arrowleft) player.angle -= 0.05;
        if (input.keys.d || input.keys.arrowright) player.angle += 0.05;
        if (input.keys.w || input.keys.arrowup) {
            player.speed = Math.min(player.maxSpeed, player.speed + 0.1);
        }
        if (input.keys.s || input.keys.arrowdown) {
            player.x -= Math.cos(player.angle) * player.speed * 0.5;
            player.y -= Math.sin(player.angle) * player.speed * 0.5;
        }

        if (input.firing) {
            fireCannon(player, input.mouseAngle);
        }
    });

    // Auto-upgrade ships when they have enough wood
    // This is now handled in updateShip function automatically

    socket.on('disconnect', () => {
        const player = gameState.players.get(socket.id);
        if (player) {
            console.log(`[DISCONNECT] Player ${player.name} left`);
            gameState.players.delete(socket.id);

            // Add a bot back
            if (gameState.bots.size + gameState.players.size < MAX_ENTITIES) {
                createBot();
                console.log(`[BOT] Added bot back. Players: ${gameState.players.size}, Bots: ${gameState.bots.size}`);
            }

            io.emit('playerLeft', socket.id);
        }
    });
});

// Start server
initializeWorld();

// Start game loop
const tickInterval = 1000 / TICK_RATE;
setInterval(gameLoop, tickInterval);

// Send game state to all clients
const networkInterval = 1000 / NETWORK_UPDATE_RATE;
setInterval(() => {
    const playersArray = Array.from(gameState.players.values());
    const botsArray = Array.from(gameState.bots.values());

    io.emit('gameState', {
        players: playersArray,
        bots: botsArray,
        cannonballs: gameState.cannonballs,
        collectibles: gameState.collectibles
    });
}, networkInterval);

http.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🏴‍☠️  BLACKSAIL.IO SERVER STARTED`);
    console.log('='.repeat(60));
    console.log(`  Server running on: http://localhost:${PORT}`);
    console.log(`  Tick Rate: ${TICK_RATE} TPS`);
    console.log(`  Network Update Rate: ${NETWORK_UPDATE_RATE} Hz`);
    console.log(`  Total Entities: ${MAX_ENTITIES}`);
    console.log(`  Initial Bots: ${gameState.bots.size}`);
    console.log(`  Islands: ${gameState.islands.length}`);
    console.log(`  Collectibles: ${gameState.collectibles.length}`);
    console.log('='.repeat(60));
});