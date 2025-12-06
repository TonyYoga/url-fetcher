# Architecture Overview

> System architecture and component relationships for URL Fetcher

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[HTTP Client]
    end

    subgraph "Application Layer"
        B[NestJS Application]
        
        subgraph "Modules"
            C[AppModule]
            D[RequestsModule]
            E[SecurityModule]
        end
    end

    subgraph "Domain Layer"
        F[RequestsController]
        G[RequestsService]
        H[UrlFetcherService]
    end

    subgraph "Security Layer"
        I[SsrfGuard]
        J[SsrfPolicyService]
        K[SecureHttpClient]
        L[SecurityRulesService]
    end

    subgraph "Infrastructure"
        M[In-Memory Store]
        N[Axios HTTP Client]
        O[DNS Resolver]
    end

    A -->|HTTP| B
    B --> C
    C --> D
    C -.-> E
    
    D --> F
    F --> G
    G --> H
    
    F -.->|Guard| I
    H --> K
    I --> J
    K --> J
    J --> L
    
    G --> M
    K --> N
    J --> O

    style E fill:#ff6b6b,color:#fff
    style I fill:#ff6b6b,color:#fff
    style J fill:#4ecdc4,color:#fff
    style K fill:#45b7d1,color:#fff
```

## Module Structure

```
src/
├── main.ts                 # Application bootstrap
├── app.module.ts           # Root module
│
├── common/                 # Shared utilities
│   ├── constants.ts        # Application constants
│   ├── normalize-ip.utils.ts  # IP normalization utilities
│   ├── ssrf.util.ts        # Legacy SSRF utilities
│   └── ssrf.util.spec.ts   # Unit tests
│
├── requests/               # Requests feature module
│   ├── requests.module.ts
│   ├── requests.controller.ts
│   ├── requests.service.ts
│   ├── url-fetcher.service.ts
│   ├── dto/
│   │   └── create-requests.dto.ts
│   └── models/
│       └── request-result.model.ts
│
└── security/               # Security module
    ├── security.module.ts
    ├── guards/
    │   └── ssrf.guard.ts
    ├── http/
    │   ├── secure-http.clents.ts
    │   └── security-axios.adapter.ts
    ├── policy/
    │   └── ssrf-policy.service.ts
    └── rules/
        ├── rules.provider.ts
        └── rules.service.ts
```

## Request Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant VP as ValidationPipe
    participant G as SsrfGuard
    participant RC as RequestsController
    participant RS as RequestsService
    participant UF as UrlFetcherService
    participant SH as SecureHttpClient
    participant EXT as External URL

    C->>VP: POST /requests/create
    Note over VP: Validate DTO<br/>(urls: string[])
    VP->>G: canActivate()
    Note over G: Validate all URLs<br/>against SSRF policy
    G->>RC: Request allowed
    RC->>RS: create(urls)
    RS->>UF: fetchMany(urls)
    
    loop For each URL
        UF->>SH: get(url)
        Note over SH: SSRF validation<br/>on each request
        SH->>EXT: HTTP Request
        EXT-->>SH: Response
        SH-->>UF: AxiosResponse
    end
    
    UF-->>RS: UrlFetchResult[]
    RS-->>RC: { id, createdAt, count }
    RC-->>C: 201 Created
```

## Component Responsibilities

### Controller Layer

| Component | Responsibility |
|-----------|----------------|
| `RequestsController` | HTTP endpoints, request/response handling |

### Service Layer

| Component | Responsibility |
|-----------|----------------|
| `RequestsService` | Business logic, request storage |
| `UrlFetcherService` | URL fetching orchestration |

### Security Layer

| Component | Responsibility |
|-----------|----------------|
| `SsrfGuard` | Pre-request URL validation |
| `SsrfPolicyService` | SSRF validation logic |
| `SecureHttpClient` | SSRF-protected HTTP client |
| `SecurityRulesService` | Security configuration access |
| `SecurityAxiosAdapter` | Request-level SSRF interception |

## Data Models

### Request Flow

```mermaid
classDiagram
    class CreateRequestDto {
        +string[] urls
    }
    
    class RequestResult {
        +string id
        +number createdAt
        +string[] urls
        +UrlFetchResult[] results
    }
    
    class UrlFetchResult {
        +string url
        +string|null finalUrl
        +number|null statusCode
        +string|null contentType
        +string|null content
        +string|null error
    }
    
    CreateRequestDto --> RequestResult : creates
    RequestResult *-- UrlFetchResult : contains
```

### Security Configuration

```mermaid
classDiagram
    class SecurityRules {
        +SsrfRulesConfig ssrf
    }
    
    class SsrfRulesConfig {
        +string[] allowedHosts
        +string[] blockedIpRanges
        +number maxRedirects
        +string[] allowedProtocols
        +number maxResponseSizeBytes
        +boolean validateRedirectChain
    }
    
    SecurityRules *-- SsrfRulesConfig
```

## Dependency Injection Graph

```mermaid
graph TD
    subgraph "Providers"
        A[SECURITY_RULES_CONFIG]
    end

    subgraph "Services"
        B[SecurityRulesService]
        C[SsrfPolicyService]
        D[SecureHttpClient]
        E[SsrfGuard]
        F[RequestsService]
        G[UrlFetcherService]
    end

    A -->|inject| B
    B -->|inject| C
    C -->|inject| D
    C -->|inject| E
    D -->|inject| G
    E -->|inject| F
    G -->|inject| F

    style A fill:#ffd93d,color:#000
    style C fill:#4ecdc4,color:#fff
    style D fill:#45b7d1,color:#fff
```

## API Endpoints

| Method | Endpoint | Description | Guards |
|--------|----------|-------------|--------|
| `POST` | `/requests/create` | Create URL fetch request | `SsrfGuard` |
| `GET` | `/requests/:id` | Get request result by ID | - |

### Request/Response Examples

#### Create Request

```http
POST /requests/create HTTP/1.1
Content-Type: application/json

{
  "urls": [
    "https://example.com",
    "https://httpbin.org/get"
  ]
}
```

```json
{
  "id": "req_1733500800000",
  "createdAt": 1733500800000,
  "count": 2
}
```

#### Get Result

```http
GET /requests/req_1733500800000 HTTP/1.1
```

```json
{
  "id": "req_1733500800000",
  "createdAt": 1733500800000,
  "urls": ["https://example.com", "https://httpbin.org/get"],
  "results": [
    {
      "url": "https://example.com",
      "finalUrl": "https://example.com/",
      "statusCode": 200,
      "contentType": "text/html",
      "content": "<!doctype html>...",
      "error": null
    }
  ]
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

### Application Constants

```typescript
// src/common/constants.ts
MAX_URLS_PER_REQUEST = 100      // Max URLs per batch
HTTP_TIMEOUT_MS = 5000          // Request timeout
MAX_CONTENT_LENGTH_BYTES = 2MB  // Max response size
MAX_REDIRECTS = 5               // Max redirect hops
```

## Error Handling

### HTTP Exceptions

| Status | Exception | Trigger |
|--------|-----------|---------|
| `400` | `BadRequestException` | Invalid DTO |
| `403` | `ForbiddenException` | SSRF blocked |
| `404` | `NotFoundException` | Request ID not found |

### Error Flow

```mermaid
flowchart TD
    A[Request] --> B{Valid DTO?}
    B -->|No| C[400 Bad Request]
    B -->|Yes| D{SSRF Check}
    D -->|Blocked| E[403 Forbidden]
    D -->|Passed| F{Fetch URLs}
    F -->|Error| G[Capture in result]
    F -->|Success| H[Return result]
    G --> H
```

## Testing Strategy

### Unit Tests

- `ssrf.util.spec.ts` - IP validation functions
- Mock DNS resolution for deterministic testing
- Test all private IP ranges

### E2E Tests

- `app.e2e-spec.ts` - API endpoint testing
- Supertest for HTTP assertions

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```
