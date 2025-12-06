import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('URL Fetcher (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /requests/create', () => {
    describe('successful requests', () => {
      it('should create request with valid public URL', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['https://example.com'] })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toMatch(/^req_\d+$/);
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body.count).toBe(1);
      });

      it('should create request with multiple URLs', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({
            urls: [
              'https://example.com',
              'https://httpbin.org/get',
            ],
          })
          .expect(201);

        expect(response.body.count).toBe(2);
      });
    });

    describe('SSRF protection', () => {
      it('should block localhost', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['http://localhost/admin'] })
          .expect(403);

        expect(response.body.message).toContain('SSRF blocked');
      });

      it('should block 127.0.0.1', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['http://127.0.0.1'] })
          .expect(403);

        expect(response.body.message).toContain('SSRF blocked');
      });

      it('should block private IP 10.x.x.x', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['http://10.0.0.1'] })
          .expect(403);

        expect(response.body.message).toContain('SSRF blocked');
      });

      it('should block private IP 192.168.x.x', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['http://192.168.1.1'] })
          .expect(403);

        expect(response.body.message).toContain('SSRF blocked');
      });

      it('should block private IP 172.16.x.x', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['http://172.16.0.1'] })
          .expect(403);

        expect(response.body.message).toContain('SSRF blocked');
      });

      it('should block AWS metadata IP', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['http://169.254.169.254/latest/meta-data'] })
          .expect(403);

        expect(response.body.message).toContain('SSRF blocked');
      });

      it('should block if any URL in array is malicious', async () => {
        const response = await request(app.getHttpServer())
          .post('/requests/create')
          .send({
            urls: [
              'https://example.com',  // Valid
              'http://127.0.0.1',      // Invalid - should block entire request
            ],
          })
          .expect(403);

        expect(response.body.message).toContain('SSRF blocked');
      });
    });

    describe('validation errors', () => {
      it('should return 403 for empty body (guard runs before validation)', async () => {
        // Note: SsrfGuard runs before ValidationPipe, so it returns 403 "No URLs provided"
        await request(app.getHttpServer())
          .post('/requests/create')
          .send({})
          .expect(403);
      });

      it('should return 403 for missing urls field (guard runs before validation)', async () => {
        // Note: SsrfGuard runs before ValidationPipe
        await request(app.getHttpServer())
          .post('/requests/create')
          .send({ wrongField: ['https://example.com'] })
          .expect(403);
      });

      it('should return 400 for empty urls array', async () => {
        await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: [] })
          .expect(400);
      });

      it('should return 400 for non-array urls', async () => {
        await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: 'https://example.com' })
          .expect(400);
      });

      it('should return 400 for non-string values in urls array', async () => {
        await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: [123, null] })
          .expect(400);
      });

      it('should return 403 for invalid URL format', async () => {
        await request(app.getHttpServer())
          .post('/requests/create')
          .send({ urls: ['not-a-valid-url'] })
          .expect(403);
      });
    });
  });

  describe('GET /requests/:id', () => {
    it('should return stored request result', async () => {
      // First create a request
      const createResponse = await request(app.getHttpServer())
        .post('/requests/create')
        .send({ urls: ['https://example.com'] })
        .expect(201);

      const requestId = createResponse.body.id;

      // Then get the result
      const getResponse = await request(app.getHttpServer())
        .get(`/requests/${requestId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(requestId);
      expect(getResponse.body.urls).toEqual(['https://example.com']);
      expect(getResponse.body.results).toBeInstanceOf(Array);
      expect(getResponse.body.results).toHaveLength(1);
    });

    it('should return 404 for non-existent id', async () => {
      const response = await request(app.getHttpServer())
        .get('/requests/non-existent-id')
        .expect(404);

      expect(response.body.message).toContain('not');
      expect(response.body.message).toContain('found');
    });

    it('should return complete fetch result structure', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/requests/create')
        .send({ urls: ['https://example.com'] })
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get(`/requests/${createResponse.body.id}`)
        .expect(200);

      const result = getResponse.body.results[0];
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('finalUrl');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('contentType');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('error');
    });
  });
});
