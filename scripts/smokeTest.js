/**
 * ResCrafted 2.0 - Production Readiness & Post-Deployment Smoke Test
 *
 * Runs non-destructive health checks against the running API gateway
 * to verify network readiness, database connectivity, and security headers.
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');

async function runSmokeTests() {
  console.log('🌱 Starting ResCrafted 2.0 Production Smoke Tests...\n');

  if (mongoose.connection.readyState === 0) {
    console.log('Connecting to database for verification probes...');
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB Atlas.\n');
  }

  const request = supertest(app);
  let passedCount = 0;
  let failedCount = 0;

  const assertions = [
    {
      name: 'Root Gateway Discovery Probe',
      run: async () => {
        const res = await request.get('/');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (res.body.status !== 'online') throw new Error('API status not reported as online');
      }
    },
    {
      name: 'Health Check & DB Ping (/api/v1/health)',
      run: async () => {
        const res = await request.get('/api/v1/health');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        if (!res.body.data?.database) throw new Error('Database ping missing from health response');
      }
    },
    {
      name: 'Defensive Security Headers (Helmet)',
      run: async () => {
        const res = await request.get('/api/v1/health');
        if (res.headers['x-content-type-options'] !== 'nosniff') {
          throw new Error('x-content-type-options header missing or invalid');
        }
        if (!res.headers['x-frame-options']) {
          throw new Error('x-frame-options header missing');
        }
      }
    },
    {
      name: 'CORS Allowlist Security Policy (Local & Vercel Production)',
      run: async () => {
        const localRes = await request
          .get('/api/v1/health')
          .set('Origin', 'http://localhost:5173');
        if (localRes.headers['access-control-allow-origin'] !== 'http://localhost:5173') {
          throw new Error('Local origin was not granted access');
        }

        const vercelRes = await request
          .get('/api/v1/health')
          .set('Origin', 'https://rescrafted-frontend.vercel.app');
        if (vercelRes.headers['access-control-allow-origin'] !== 'https://rescrafted-frontend.vercel.app') {
          throw new Error('Vercel production origin was not granted access');
        }
      }
    },
    {
      name: 'Category Hierarchy (/api/v1/categories)',
      run: async () => {
        const res = await request.get('/api/v1/categories');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        const categories = Array.isArray(res.body.data) ? res.body.data : res.body.data?.categories;
        if (!Array.isArray(categories)) {
          throw new Error('Categories list not returned as an array');
        }
      }
    },
    {
      name: 'Public Product Catalog & LCA Specs (/api/v1/products)',
      run: async () => {
        const res = await request.get('/api/v1/products?limit=5');
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        const products = Array.isArray(res.body.data) ? res.body.data : res.body.data?.products;
        if (!Array.isArray(products)) {
          throw new Error('Products list not returned as an array');
        }
      }
    },
    {
      name: 'NoSQL Operator Stripping (mongoSanitize)',
      run: async () => {
        const res = await request
          .post('/api/v1/auth/login')
          .send({ $where: '1 == 1', email: 'nonexistent@rescrafted.test', password: 'password123' });
        // Handled cleanly by auth controller without crashing
        if (res.status === 500) {
          throw new Error('NoSQL injection payload caused internal server error');
        }
      }
    }
  ];

  for (const check of assertions) {
    try {
      await check.run();
      console.log(`  ✔ [PASS] ${check.name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${check.name}: ${err.message}`);
      failedCount++;
    }
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`Smoke Test Summary: ${passedCount} passed, ${failedCount} failed`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('🚀 Platform is verified healthy and ready for production traffic!');
    process.exit(0);
  }
}

runSmokeTests().catch((err) => {
  console.error('Fatal smoke test exception:', err);
  process.exit(1);
});
