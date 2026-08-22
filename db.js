const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data.json');

const SEED = {
  users: [
    { id: 'u1', name: 'Demo Shopper', email: 'demo@ecom.dev' },
  ],
  products: [
    { id: 'p1', name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse', price: 19.99 },
    { id: 'p2', name: 'Mechanical Keyboard', description: 'Hot-swappable 75% mechanical keyboard', price: 89.5 },
    { id: 'p3', name: 'USB-C Hub', description: '7-in-1 USB-C hub with HDMI and PD passthrough', price: 34.0 },
  ],
  orders: [],
};

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(SEED, null, 2));
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8').trim();
  if (!raw) return JSON.parse(JSON.stringify(SEED));
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function newId() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { readDb, writeDb, newId };
