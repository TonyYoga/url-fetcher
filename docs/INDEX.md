# URL Fetcher Documentation

> Complete documentation for the URL Fetcher service with SSRF protection

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| [README](../README.md) | Project overview and quick start |
| [Architecture](./ARCHITECTURE.md) | System architecture and component relationships |
| [Security](./SECURITY.md) | SSRF protection module documentation |
| [Logging](./LOGGING.md) | Structured logging and observability |

---

## Quick Navigation

### For Developers

- **Getting Started** → [README](../README.md#setup)
- **System Overview** → [Architecture](./ARCHITECTURE.md)
- **API Reference** → [Architecture - API Endpoints](./ARCHITECTURE.md#api-endpoints)

### For Security Engineers

- **SSRF Protection** → [Security](./SECURITY.md)
- **Data Flow Diagrams** → [Security - Data Flow](./SECURITY.md#data-flow)
- **Extension Guide** → [Security - Extension Guide](./SECURITY.md#extension-guide)

### For DevOps / SRE

- **Logging System** → [Logging](./LOGGING.md)
- **Log Events Reference** → [Logging - Events](./LOGGING.md#events-reference)
- **Request Tracing** → [Logging - Request Context](./LOGGING.md#request-context)

---

## Project Overview

```
url-fetcher/
├── docs/                    # 📚 Documentation
│   ├── INDEX.md            # This file
│   ├── ARCHITECTURE.md     # System architecture
│   ├── SECURITY.md         # Security module docs
│   └── LOGGING.md          # Logging & observability
│
├── src/
│   ├── common/             # 🔧 Shared utilities, logging, middleware
│   ├── requests/           # 📨 Request handling
│   └── security/           # 🛡️ SSRF protection
│
├── test/                   # 🧪 Tests
└── README.md              # 📖 Quick start
```

---

## Key Concepts

### What This Service Does

1. **Accepts URLs** from API clients
2. **Validates URLs** against SSRF rules
3. **Fetches content** from allowed URLs
4. **Returns results** with content and metadata

### Security Layers

```
┌──────────────────────────────────────────────┐
│  Layer 1: Input Validation (ValidationPipe)  │
├──────────────────────────────────────────────┤
│  Layer 2: SSRF Guard (Pre-request)           │
├──────────────────────────────────────────────┤
│  Layer 3: Secure HTTP Client (Per-request)   │
├──────────────────────────────────────────────┤
│  Layer 4: Redirect Chain Validation          │
└──────────────────────────────────────────────┘
```

---

## Common Tasks

### Start the Service

```bash
npm install
npm run start:dev
```

### Make a Request

```bash
curl -X POST http://localhost:3000/requests/create \
  -H "Content-Type: application/json" \
  -d '{"urls":[
            "https://httpbun.com/redirect-to?url=http://127.0.0.1",
            "https://httpbun.com/redirect/2",
            "https://httpbun.com/redirect/6"
            ]}'
```

### Check Security Configuration

See [Security - Configuration](./SECURITY.md#configuration)

### Add Custom IP Ranges to Block

See [Security - Extension Guide](./SECURITY.md#extension-guide)

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | NestJS 11 |
| HTTP Client | Axios |
| Validation | class-validator |
| Testing | Jest |
| Language | TypeScript 5 |

---

## Contact & Support

For questions about:
- **Security implementation** → See [Security Docs](./SECURITY.md)
- **Architecture decisions** → See [Architecture Docs](./ARCHITECTURE.md)
- **Bug reports** → Create an issue
