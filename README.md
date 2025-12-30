# 🏴‍☠️ Blacksail.io

**Multiplayer Pirate Battle Game** - A server-side io-game with 200 AI bots, real-time combat, and mobile support!

## 🎮 Features

- **200 AI Bots** with advanced AI (predictive aiming, pack behavior, strategic retreating)
- **Real-time Multiplayer** using Socket.io
- **Dynamic Bot Replacement** - bots are removed when players join
- **Auto-Upgrade System** - ships upgrade automatically when collecting wood
- **Mobile Support** - Touch joystick controls for mobile devices
- **Large World** - 32,000 x 32,000 pixels with 400 islands and 10,000 collectibles
- **Performance Optimized** - Spatial partitioning for smooth 60 TPS gameplay

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ installed
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/NeurobladeFX/Blacksail.git
cd Blacksail

# Install dependencies
npm install

# Start the server
npm start
```

The game will be running at `http://localhost:3000`

## 🎯 How to Play

### Desktop Controls
- **WASD** or **Arrow Keys**: Move ship
- **Mouse**: Aim cannons
- **Click**: Fire cannons

### Mobile Controls
- **Virtual Joystick**: Move ship (bottom-left)
- **Tap anywhere on screen**: Fire cannons
- Cannons automatically aim at tap location

### Gameplay
- Collect **gold** and **wood** floating in the ocean
- Ships automatically upgrade when you have enough wood
- Battle against 200 AI-controlled pirate ships
- Climb the leaderboard to become the Pirate King!

## 📦 Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Real-time Communication**: Socket.io (WebSockets)
- **Game Loop**: 60 TPS server-side, 60 FPS client-side

## 🌐 Deployment

### Deploy to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Use the following settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Port**: 3000 (auto-detected)

### Environment Variables
No environment variables required! The game works out of the box.

## 📊 Architecture

- **Server-Authoritative**: All game logic runs on the server
- **Spatial Partitioning**: Efficient collision detection using grid system
- **Network Optimization**: 20Hz update rate to clients
- **Bot AI**: Three modes (hunt, collect, flee) with predictive aiming

## 🎨 Game Mechanics

### Ship Upgrades (Automatic)
- Level 1→2: 15 wood
- Level 2→3: 20 wood
- Level 3→4: 25 wood
- ... up to Level 7

Each upgrade increases:
- ✅ Maximum health
- ✅ Ship speed
- ✅ Crew capacity
- ✅ Number of cannons

### Bot AI
Bots are challenging opponents with:
- **Predictive Aiming**: Aim ahead of moving targets
- **Pack Behavior**: Prioritize attacking real players
- **Strategic Retreating**: Flee when health is low
- **Resource Collection**: Actively seek wood and gold

## 🛠️ Development

```bash
# Run in development mode
npm start

# The server will restart automatically when files change
# Open http://localhost:3000 in your browser
```

## 📝 License

MIT License - feel free to use this project however you like!

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

## 🏴‍☠️ Credits

Created by NeurobladeFX

---

**Enjoy the high seas, matey! ⚓**
