const test = require('node:test');
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const env = require('../src/config/env');

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }
});

// Import and register test suites
require('./health.test');
require('./auth.test');
require('./products.test');
require('./shopping.test');
require('./orders.test');
require('./payments.test');
require('./dashboards.test');
require('./reviews.test');
require('./security.test');

test.after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
