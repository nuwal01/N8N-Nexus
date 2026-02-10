# N8N Nexus - Quick Reference

## 🔗 Important Links

| Service | URL |
|---------|-----|
| **N8N Nexus (Local)** | http://localhost:3002 |
| **N8N Nexus (Deployed)** | https://n8n-nexus.vercel.app *(update with your actual URL)* |
| **n8n Instance (Local)** | http://localhost:5678 |
| **Cloudflare Tunnel** | https://pour-criteria-app-address.trycloudflare.com *(changes on restart)* |

---

## 🔑 Credentials

### n8n API Key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZmFlMGVhOS00OGQxLTRlMTQtOTM2NC05ZmU3MGM5NzQzOGQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzY5Njc5OTk2LCJleHAiOjE3NzIyNTQ4MDB9.SckqOAzgn-3EJAzBhTORExtCVemounHujWojF8zQ4sQ
```
*(Get a new key from: n8n Settings → API)*

---

## 🚀 How to Start the App

### Step 1: Start n8n
```bash
n8n start
```
Wait until you see: `Editor is now accessible via: http://localhost:5678`

### Step 2: Start Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:5678
```
Copy the URL shown (e.g., `https://xxx.trycloudflare.com`)

### Step 3: Start N8N Nexus (Local Development)
```bash
cd c:\Users\dell\n8n-nexus\n8n-nexus
npm start
```
Open: http://localhost:3002

### Step 4: Connect
- **For Local**: Use `http://localhost:5678` as n8n URL
- **For Deployed**: Use the Cloudflare tunnel URL

---

## 📝 Notes

- **Cloudflare URL changes** every time you restart the tunnel
- **Keep terminals open** - closing them stops the services
- If you get "502 Bad Gateway", n8n is not running
- If you get "Invalid API Key", regenerate it in n8n Settings → API

---

## 🛑 To Stop Everything

1. Press `Ctrl+C` in the n8n terminal
2. Press `Ctrl+C` in the cloudflared terminal
3. Press `Ctrl+C` in the npm start terminal



## On your deployed website (Vercel or Render):

In the connection modal, enter:
n8n URL: https://unapprised-inconsequential-neida.ngrok-free.dev
API Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZmFlMGVhOS00OGQxLTRlMTQtOTM2NC05ZmU3MGM5NzQzOGQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzY5Njc5OTk2LCJleHAiOjE3NzIyNTQ4MDB9.SckqOAzgn-3EJAzBhTORExtCVemounHujWojF8zQ4sQ