# Calendar Application Deployment Guide for Ubuntu Server

## Prerequisites
- Fresh Ubuntu server (20.04 LTS or newer)
- Root or sudo access
- Domain name (optional, for SSL)

## Step 1: Update System and Install Dependencies

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential pkg-config libssl-dev postgresql postgresql-contrib nginx ufw
```

## Step 2: Install Rust

```bash
# Install Rust using rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify installation
rustc --version
cargo --version
```

## Step 3: Set Up PostgreSQL

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE calendar_db;
CREATE USER calendar_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE calendar_db TO calendar_user;
ALTER USER calendar_user CREATEDB;
\q
EOF

# Configure PostgreSQL for remote connections (if needed)
sudo nano /etc/postgresql/*/main/postgresql.conf
# Uncomment and set: listen_addresses = '*'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host calendar_db calendar_user 0.0.0.0/0 md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## Step 4: Clone and Build Application

```bash
# Create application directory
sudo mkdir -p /opt/calendar-rs
sudo chown $USER:$USER /opt/calendar-rs

# Clone your repository (replace with your repo URL)
cd /opt/calendar-rs
git clone <your-repo-url> .

# Or upload files manually
# scp -r calendar-rs/ user@server:/opt/calendar-rs/

# Build the application
cargo build --release
```

## Step 5: Configure Environment

```bash
# Create production environment file
cat > /opt/calendar-rs/.env << EOF
# Database Configuration
DATABASE_URL=postgresql://calendar_user:your_secure_password_here@localhost:5432/calendar_db

# Server Configuration
HOST=127.0.0.1
PORT=3000

# JWT Secret for authentication
JWT_SECRET=$(openssl rand -base64 32)

# File Upload Configuration
UPLOAD_DIR=/opt/calendar-rs/uploads
MAX_FILE_SIZE=52428800

# CORS Configuration
CORS_ORIGIN=http://your-domain.com

# Logging
RUST_LOG=info
EOF

# Create uploads directory
mkdir -p /opt/calendar-rs/uploads
chmod 755 /opt/calendar-rs/uploads
```

## Step 6: Initialize Database

```bash
# Run database migrations
cd /opt/calendar-rs
PGPASSWORD=your_secure_password_here psql -h localhost -U calendar_user -d calendar_db -f migrations/001_initial_schema.sql
```

## Step 7: Create Systemd Service

```bash
# Create systemd service file
sudo tee /etc/systemd/system/calendar-rs.service << EOF
[Unit]
Description=Calendar Rust Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/calendar-rs
ExecStart=/opt/calendar-rs/target/release/calendar-rs
Restart=always
RestartSec=5
Environment=RUST_LOG=info

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/calendar-rs/uploads
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Set proper ownership
sudo chown -R www-data:www-data /opt/calendar-rs

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable calendar-rs
sudo systemctl start calendar-rs

# Check status
sudo systemctl status calendar-rs
```

## Step 8: Configure Nginx Reverse Proxy

```bash
# Create nginx configuration
sudo tee /etc/nginx/sites-available/calendar-rs << EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # File upload size limit
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static file serving (optional optimization)
    location /static/ {
        alias /opt/calendar-rs/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/calendar-rs /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 9: Configure Firewall

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

## Step 10: SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 11: Monitoring and Logs

```bash
# View application logs
sudo journalctl -u calendar-rs -f

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check service status
sudo systemctl status calendar-rs
sudo systemctl status nginx
sudo systemctl status postgresql
```

## Troubleshooting

### Application won't start:
```bash
# Check logs
sudo journalctl -u calendar-rs -n 50

# Check database connection
sudo -u postgres psql -c "\l"

# Test database connection
PGPASSWORD=your_secure_password_here psql -h localhost -U calendar_user -d calendar_db -c "SELECT 1;"
```

### File upload issues:
```bash
# Check uploads directory permissions
ls -la /opt/calendar-rs/uploads/
sudo chown -R www-data:www-data /opt/calendar-rs/uploads/
sudo chmod 755 /opt/calendar-rs/uploads/
```

### Nginx issues:
```bash
# Test configuration
sudo nginx -t

# Check if port 3000 is listening
sudo netstat -tlnp | grep :3000
```

## Security Recommendations

1. **Change default passwords** in PostgreSQL and .env file
2. **Use strong JWT secret** (generated automatically in script)
3. **Keep system updated**: `sudo apt update && sudo apt upgrade`
4. **Monitor logs regularly** for suspicious activity
5. **Backup database regularly**:
   ```bash
   pg_dump -h localhost -U calendar_user calendar_db > backup.sql
   ```

## Performance Optimization

1. **Enable gzip compression** in nginx
2. **Set up log rotation**
3. **Monitor resource usage**: `htop`, `iotop`
4. **Consider using a CDN** for static assets

Your calendar application should now be accessible at your domain!
