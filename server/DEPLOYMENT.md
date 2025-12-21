# Willhaben Cars Server - Deployment Guide

## Hetzner VPS Deployment

### 1. Prerequisites
- Hetzner VPS (CX11 - €3.29/month is enough)
- Ubuntu 22.04 or newer
- Docker and Docker Compose installed

### 2. Server Setup (SSH into your VPS)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Logout and login again for docker group to take effect
```

### 3. Deploy the Server

```bash
# Create directory
mkdir -p /opt/willhaben-cars
cd /opt/willhaben-cars

# Upload files (from your local machine):
# scp -r server/* user@your-vps-ip:/opt/willhaben-cars/

# Or clone/copy the server folder contents to /opt/willhaben-cars

# Build and start
docker compose up -d --build

# Check logs
docker compose logs -f
```

### 4. Configure Firewall (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8082/tcp  # API
sudo ufw enable
```

### 5. Optional: Setup with Nginx + SSL

```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/willhaben-api

# Add this configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/willhaben-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 6. Update the Mobile App

After deploying, update `services/api.ts` in the mobile app to use your server URL:

```typescript
// For production deployment, update getBaseUrl():
const PRODUCTION_API_URL = 'https://your-domain.com';
// or
const PRODUCTION_API_URL = 'http://your-vps-ip:8082';
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vehicles` | GET | Get all vehicles (max 100) |
| `/api/vehicles/new` | GET | Get newly found vehicles |
| `/api/vehicles/mark-seen` | POST | Mark vehicles as seen |
| `/api/scrape` | POST | Trigger manual scrape |
| `/api/health` | GET | Health check |
| `/api/register-push-token` | POST | Register device for push notifications |

## Monitoring

```bash
# View logs
docker compose logs -f

# Check health
curl http://localhost:8082/api/health

# Restart
docker compose restart

# Stop
docker compose down

# Update and restart
docker compose up -d --build
```

## Costs

- **Hetzner CX11**: €3.29/month (1 vCPU, 2GB RAM, 20GB SSD)
- **Domain** (optional): ~€10/year
- **Total**: ~€4-5/month

## Notes

- Server scrapes Willhaben every 30 seconds
- Data is stored in-memory (resets on restart)
- Push notifications sent via Expo Push Service (free)
- No database needed - all data is temporary
