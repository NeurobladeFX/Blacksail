# 🚀 Deployment Guide - Blacksail.io

This guide explains how to deploy Blacksail.io to various platforms.

## ✅ Prerequisites

Before deploying, make sure you have:
- Git installed and initialized in your project
- A GitHub account
- Your code committed to a Git repository

## 📤 Deploy to GitHub

### Step 1: Initialize Git (if not already done)

```bash
cd e:\Blacksail
git init
git add .
git commit -m "Initial commit - Blacksail.io multiplayer game"
```

### Step 2: Create GitHub Repository

1. Go to [GitHub](https://github.com)
2. Click "New Repository"
3. Name it: `Blacksail`
4. **DO NOT** initialize with README (you already have one)
5. Click "Create Repository"

### Step 3: Push to GitHub

```bash
git remote add origin https://github.com/NeurobladeFX/Blacksail.git
git branch -M main
git push -u origin main
```

Your code is now on GitHub! 🎉

---

## 🌐 Deploy to Render (Recommended - Free Tier Available)

Render is perfect for hosting static websites like Blacksail.io.

### Step 1: Sign Up

1. Go to [Render.com](https://render.com)
2. Sign up with your GitHub account

### Step 2: Create New Static Site

1.  From the dashboard, click **New +** → **Static Site**.
2.  Connect your GitHub repository (e.g., `YourUsername/Blacksail`).
3.  Click "Connect".

### Step 3: Configure Service

Use these settings:

| Setting | Value |
|---|---|
| **Name** | `blacksail-io` (or any name you like) |
| **Branch** | `main` |
| **Build Command** | `npm install` |
| **Publish Directory** | `.` (Since `index.html` is in the root) |

### Step 4: Deploy

1. Click **Create Static Site**.
2. Wait a minute for the deployment.
3. Your game will be live at the URL Render provides (e.g., `https://blacksail-io.onrender.com`).

### Important Notes for Render:

- ✅ **Static sites on Render are FREE.**
- ✅ **They come with a global CDN for fast loading.**
- ✅ **Automatic updates on every `git push`.

---

## 🔧 Alternative Deployments

### Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create blacksail-io

# Deploy
git push heroku main

# Open
heroku open
```

**Cost**: $7/month (no free tier anymore)

### Railway

1. Go to [Railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose your Blacksail repository
5. Railway auto-detects Node.js and deploys!

**Cost**: Free tier available ($5 credit/month)

### DigitalOcean App Platform

1. Go to [DigitalOcean](https://www.digitalocean.com/)
2. Click "Apps" → "Create App"
3. Connect GitHub repository
4. Configure:
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
5. Deploy

**Cost**: $5/month minimum

---

## 🎮 After Deployment

### Testing Your Deployed Game

1. Open your deployed URL (e.g., `https://blacksail-io.onrender.com`)
2. Enter a pirate name
3. Click "Weigh Anchor"
4. You should connect and join with 199 bots!

### Monitoring

Check the Render dashboard for:
- **Logs**: See server console output
- **Metrics**: CPU, RAM, requests
- **Events**: Deployments, crashes, restarts

### Updating Your Game

Whenever you make changes:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

Render will automatically redeploy! 🚀

---

## ⚡ Performance Tips

### For Better Performance:

1. **Use Paid Tier** ($7/month on Render)
   - Keeps server always on
   - More CPU/RAM
   - No sleep time

2. **Configure Environment Variables** (optional)
   Create `.env` file:
   ```
   PORT=3000
   NODE_ENV=production
   ```

3. **Enable Compression** (already in code)
   Server uses gzip compression for faster loading

---

## 🐛 Troubleshooting

### Server Not Starting

**Check Logs**:
- Render: Dashboard → Logs tab
- Heroku: `heroku logs --tail`

**Common Issues**:
- Port binding: Make sure `PORT` env variable is used
- Dependencies: Run `npm install` locally first
- Node version: Ensure Node.js 14+ in `package.json`

### Players Can't Connect

**Check**:
- ✅ Server is running (green status)
- ✅ WebSocket support is enabled
- ✅ HTTPS is used (required for production)
- ✅ No firewall blocking port 3000

### Game Laggy

**Solutions**:
- Upgrade to paid tier for more resources
- Reduce number of bots in `server.js` (change `MAX_ENTITIES`)
- Use server region closest to your players

---

## 📊 Monitoring Your Game

### Server Health

Check these metrics:
- **TPS**: Should stay at 60
- **Memory**: Should be < 500MB
- **Active Players**: Check console logs
- **Bot Count**: Should always be 200 - player count

### Player Analytics

Add simple logging in `server.js`:

```javascript
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] Player connected. Total: ${gameState.players.size}`);
});
```

---

## 🎉 Success!

Your game is now live and accessible to players worldwide!

**Share your game**:
- Post your URL on social media
- Share with friends
- Submit to game directories
- Add to your portfolio

**Your deployed game URL**: `https://blacksail-io.onrender.com`

---

## 📞 Support

Having issues? Check:
- GitHub Issues: Open an issue on your repository
- Render Docs: https://render.com/docs
- Socket.io Docs: https://socket.io/docs

---

**Happy Sailing! 🏴‍☠️⚓**