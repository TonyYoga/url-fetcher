# URL Fetcher

A simple URL fetching service built with NestJS — designed for SSRF (Server-Side Request Forgery) demonstration and testing.

## What is SSRF?

**Server-Side Request Forgery (SSRF)** is a web security vulnerability that allows an attacker to make the server perform HTTP requests to arbitrary destinations.

### How it works

1. Application accepts a URL from user input
2. Server fetches content from that URL
3. Attacker provides a malicious URL pointing to internal resources

### Attack examples

```
http://localhost/admin              # Access internal admin panel
http://127.0.0.1:3306               # Probe internal database
http://169.254.169.254/metadata     # AWS/cloud metadata (credential theft)
http://internal-service:8080/api    # Access internal microservices
```

### Why it's dangerous

- **Bypass firewalls** — the server is trusted on the internal network
- **Access internal services** — databases, admin panels, cloud metadata
- **Port scanning** — enumerate internal infrastructure
- **Data exfiltration** — steal sensitive information

## Protection

This service implements **multi-layer SSRF protection**:

| Layer | Description |
|-------|-------------|
| 🛡️ **IP Blocking** | Blocks private, loopback, link-local, cloud metadata ranges |
| 🔄 **Redirect Validation** | Validates every URL in redirect chains |
| 🌐 **DNS Check** | Resolves hostnames before IP validation |
| ⚙️ **Configurable Rules** | Centralized security configuration |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design, components, data flow |
| [Security](./docs/SECURITY.md) | SSRF protection, extension guide, best practices |
| [Logging](./docs/LOGGING.md) | Structured JSON logging, request tracing |

> 📚 See full documentation in [`docs/`](./docs/) for diagrams, API reference, and how to extend security rules.

## API

### Fetch URLs

```bash
POST /requests/create
Content-Type: application/json

{
  "urls": ["https://example.com", "https://httpbin.org/get"]
}
```

### Get result by ID

```bash
GET /requests/:id
```

## Setup

```bash
npm install
```

## Run

```bash
# development
npm run start:dev

# production
npm run start:prod
```

## License

MIT
