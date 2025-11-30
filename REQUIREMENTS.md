# Recipe Keeper - System Requirements

## Server Requirements

### Web Server
- Apache 2.4+ with mod_rewrite enabled, OR
- Nginx 1.18+

### PHP
- **Version**: PHP 7.4 or higher (PHP 8.x recommended)
- **Required Extensions**:
  - `pdo` - PHP Data Objects
  - `pdo_mysql` - MySQL/MariaDB PDO driver
  - `json` - JSON support (usually built-in)
  - `curl` - For proxy functionality
  - `mbstring` - Multibyte string support

To check PHP extensions:
```bash
php -m | grep -E "pdo|json|curl|mbstring"
```

### Database
- **MariaDB 10.3+** (recommended), OR
- **MySQL 5.7+**

Required privileges:
- SELECT, INSERT, UPDATE, DELETE on the recipes table

### Disk Space
- Application files: ~500 KB
- Database: Varies with recipe count (~10 KB per recipe)

## Client Requirements

### Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- Mobile Safari (iOS 13+)
- Chrome for Android

### Required Browser Features
- ES6 Modules support
- Fetch API
- LocalStorage
- CSS Grid and Flexbox

## Optional API Keys

### OpenAI API (for Photo/PDF OCR)
- Required for extracting recipes from images and PDFs
- Get your key at: https://platform.openai.com/api-keys
- Estimated cost: ~$0.01-0.05 per image processed

## Network Requirements

### Ports
- HTTP (80) or HTTPS (443) for web access
- MySQL (3306) for database connection (can be local)

### Outbound Connections
The application makes outbound requests to:
- Recipe websites (for extraction)
- `api.openai.com` (for OCR, if configured)

## Installation Checklist

- [ ] Web server installed and running
- [ ] PHP 7.4+ installed with required extensions
- [ ] MariaDB/MySQL installed and running
- [ ] Database and user created
- [ ] `api/config.php` configured with database credentials
- [ ] File permissions set correctly (755 for directories, 644 for files)
- [ ] `js/config.local.js` configured with API keys (optional)

## Recommended Server Specifications

### Minimum
- 1 CPU core
- 512 MB RAM
- 1 GB disk space

### Recommended
- 2 CPU cores
- 1 GB RAM
- 5 GB disk space

## Security Recommendations

1. **Use HTTPS** - Encrypt all traffic, especially if using API keys
2. **Restrict database access** - Use a dedicated database user with minimal privileges
3. **Keep software updated** - Regular updates for PHP, MariaDB, and web server
4. **Firewall** - Block direct database access from external networks
5. **API Keys** - Never commit `config.local.js` with real keys to version control
