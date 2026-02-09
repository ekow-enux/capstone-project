#!/bin/bash
set -e

# ============================================
# Shared Server Installation Script
# Used by both AI Backend and Auth Backend
# ============================================

# Configuration - set via command line arguments
BACKEND_TYPE="${1:-}"  # "ai" or "auth"
DOMAIN="${2:-}"
BACKEND_PORT="${3:-5000}"

# Defaults
if [ -z "$DOMAIN" ]; then
    if [ "$BACKEND_TYPE" = "ai" ]; then
        DOMAIN="ai.ekowlabs.space"
    else
        DOMAIN="auth.ekowlabs.space"
    fi
fi

echo "========================================="
echo "Server Installation/Update Script"
echo "========================================="
echo "Backend Type: $BACKEND_TYPE"
echo "Domain: $DOMAIN"
echo "Backend Port: $BACKEND_PORT"
echo ""

# Track what was updated
UPDATED_NODE=false
UPDATED_CADDY=false
UPDATED_PM2=false
RESTARTED_SERVICE=false

# === 1. Update System ===
echo "🔄 Updating system packages..."
sudo apt update -y && sudo apt upgrade -y
echo "✅ System packages updated"
echo ""

# === 2. Install/Update Node.js ===
echo "📦 Checking Node.js installation..."
if command -v node &> /dev/null; then
    CURRENT_NODE=$(node --version)
    echo "   Current Node.js version: $CURRENT_NODE"
    echo "📥 Updating Node.js to latest LTS..."
    
    # Remove old Node.js if exists from older repo
    sudo rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true
    sudo rm -f /usr/share/keyrings/nodesource.gpg 2>/dev/null || true
    
    # Install NodeSource prerequisites
    sudo apt install -y curl gnupg
    
    # Add NodeSource GPG key
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | \
        sudo gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
    
    # Add NodeSource repository for Node.js 22.x (LTS)
    echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | \
        sudo tee /etc/apt/sources.list.d/nodesource.list
    
    # Update and install
    sudo apt update -y
    sudo apt install -y nodejs
    
    NEW_NODE=$(node --version)
    echo "✅ Node.js updated: $CURRENT_NODE → $NEW_NODE"
    UPDATED_NODE=true
else
    echo "📥 Installing Node.js..."
    sudo apt install -y curl gnupg
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | \
        sudo gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
    echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | \
        sudo tee /etc/apt/sources.list.d/nodesource.list
    sudo apt update -y
    sudo apt install -y nodejs
    echo "✅ Node.js installed: $(node --version)"
fi
echo ""

# === 3. Update Caddy ===
echo "🌐 Checking Caddy installation..."
if command -v caddy &> /dev/null; then
    CURRENT_CADDY=$(caddy version)
    echo "   Current Caddy version: $CURRENT_CADDY"
    echo "📥 Updating Caddy..."
    
    # Add/refresh Caddy repository
    sudo rm -f /usr/share/keyrings/caddy-stable.gpg 2>/dev/null || true
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
        sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
    
    echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] \
https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | \
        sudo tee /etc/apt/sources.list.d/caddy-stable.list
    
    sudo apt update -y
    sudo apt install -y caddy
    
    NEW_CADDY=$(caddy version)
    echo "✅ Caddy updated: $CURRENT_CADDY → $NEW_CADDY"
    UPDATED_CADDY=true
else
    echo "📥 Installing Caddy..."
    sudo apt install -y curl debian-keyring debian-archive-keyring apt-transport-https gnupg
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
        sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] \
https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | \
        sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update -y
    sudo apt install -y caddy
    echo "✅ Caddy installed: $(caddy version)"
fi
echo ""

# === 4. Update PM2 ===
echo "📦 Checking PM2 installation..."
if command -v pm2 &> /dev/null; then
    CURRENT_PM2=$(pm2 --version)
    echo "   Current PM2 version: $CURRENT_PM2"
    echo "📥 Updating PM2..."
    sudo npm i -g pm2@latest
    NEW_PM2=$(pm2 --version)
    echo "✅ PM2 updated: $CURRENT_PM2 → $NEW_PM2"
    UPDATED_PM2=true
    
    # Restart the appropriate backend if it exists
    echo "🔄 Checking for $BACKEND_TYPE backend process..."
    if [ "$BACKEND_TYPE" = "ai" ]; then
        if pm2 list | grep -q "ai-backend"; then
            echo "   Found ai-backend, restarting..."
            pm2 restart ai-backend
            echo "✅ ai-backend restarted"
            RESTARTED_SERVICE=true
        else
            echo "   ai-backend not found, skipping restart"
        fi
    else
        if pm2 list | grep -q "auth-backend"; then
            echo "   Found auth-backend, restarting..."
            pm2 restart auth-backend
            echo "✅ auth-backend restarted"
            RESTARTED_SERVICE=true
        else
            echo "   auth-backend not found, skipping restart"
        fi
    fi
else
    echo "📥 Installing PM2..."
    sudo npm i -g pm2
    echo "✅ PM2 installed: $(pm2 --version)"
    
    # Setup PM2 startup script
    echo "📝 Setting up PM2 startup script..."
    sudo env PATH=$PATH:/usr/bin pm2 startup | tail -1
    echo "✅ PM2 startup script configured"
fi
echo ""

# === 5. Create Status Page Directory ===
STATUS_DIR=/var/www/status
echo "📁 Creating status page directory..."
sudo mkdir -p $STATUS_DIR
sudo chown -R caddy:caddy $STATUS_DIR
echo "✅ Status page directory created"
echo ""

# === 6. Configure Caddy as Reverse Proxy ===
echo "🧩 Configuring Caddy for domain: $DOMAIN"

# Check if this domain already exists in Caddyfile
if grep -q "^$DOMAIN {" /etc/caddy/Caddyfile 2>/dev/null; then
    echo "   Domain $DOMAIN already configured in Caddyfile"
    echo "   Updating backend port to $BACKEND_PORT..."
    
    # Use sed to update the port for this domain
    sudo sed -i "/^$DOMAIN {/,/^}/{/reverse_proxy localhost:/s/localhost:[0-9]*/localhost:$BACKEND_PORT/}" /etc/caddy/Caddyfile
    echo "✅ Caddy configuration updated for $DOMAIN"
else
    echo "   Adding new domain configuration..."
    
    # Append new domain configuration to Caddyfile
    sudo tee -a /etc/caddy/Caddyfile <<EOF

$DOMAIN {
    # Try to proxy to backend first, fallback to status page
    @backend {
        path /api/*
    }
    
    # Serve status page for root and non-API routes
    @status {
        not path /api/*
        not path /api-docs*
    }
    
    # Route API requests to backend
    handle @backend {
        reverse_proxy localhost:$BACKEND_PORT {
            health_uri /api/health
            health_interval 10s
            health_timeout 5s
        }
    }
    
    # Route Swagger docs to backend
    handle /api-docs* {
        reverse_proxy localhost:$BACKEND_PORT
    }
    
    # Serve status page for other routes
    handle @status {
        root * $STATUS_DIR
        file_server
    }
    
    # Enable gzip compression
    encode gzip
    
    # Add security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    }
    
    # Log requests
    log {
        output file /var/log/caddy/access.log
    }
    
    # Handle preflight requests
    @options {
        method OPTIONS
    }
    respond @options 200
}
EOF
    echo "✅ Caddy configuration added for $DOMAIN"
fi
echo ""

# === 7. Restart Caddy ===
echo "🔄 Restarting Caddy..."
sudo systemctl reload caddy || sudo systemctl restart caddy
sudo systemctl enable caddy
echo "✅ Caddy restarted and enabled"
echo ""

# === 8. Create Log Directory ===
echo "📁 Creating Caddy log directory..."
sudo mkdir -p /var/log/caddy
sudo chown caddy:caddy /var/log/caddy
echo "✅ Log directory created"
echo ""

# === 9. Save PM2 processes ===
if command -v pm2 &> /dev/null; then
    echo "💾 Saving PM2 process list..."
    pm2 save || true
    echo "✅ PM2 processes saved"
    echo ""
fi

# === Summary ===
echo "========================================="
echo "📊 INSTALLATION SUMMARY"
echo "========================================="
echo ""
echo "🔧 Components:"
[ "$UPDATED_NODE" = true ] && echo "   ✅ Node.js: updated" || echo "   ○ Node.js: already current"
[ "$UPDATED_CADDY" = true ] && echo "   ✅ Caddy: updated" || echo "   ○ Caddy: already current"
[ "$UPDATED_PM2" = true ] && echo "   ✅ PM2: updated" || echo "   ○ PM2: already current"
echo ""
echo "🔄 Services:"
[ "$RESTARTED_SERVICE" = true ] && echo "   ✅ $BACKEND_TYPE-backend restarted" || echo "   ○ $BACKEND_TYPE-backend: not running"
echo ""
echo "📦 Current Versions:"
echo "   • Node.js: $(node --version)"
echo "   • npm: $(npm --version)"
echo "   • Caddy: $(caddy version)"
echo "   • PM2: $(pm2 --version 2>/dev/null || echo 'N/A')"
echo ""
echo "🌐 Configuration:"
echo "   • Domain: $DOMAIN"
echo "   • Backend Port: $BACKEND_PORT"
echo "   • Status Page: https://$DOMAIN"
echo "   • API: https://$DOMAIN/api"
echo ""
echo "✅ Server installation completed successfully!"
echo "========================================="

# Always exit with status 0
exit 0
