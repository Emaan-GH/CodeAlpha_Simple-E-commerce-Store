const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const db = new DatabaseSync(path.join(__dirname, 'store.db'));
const SECRET = 'change-this-secret';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Database tables ----------
db.exec(`
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT, description TEXT, price REAL, image TEXT, category TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, user_id INTEGER, total REAL, address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, qty INTEGER, price REAL);
`);

// ---------- Seed products ----------
if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
  const ins = db.prepare('INSERT INTO products(name,description,price,image,category) VALUES(?,?,?,?,?)');
  [
    ['Classic Leather Watch', 'Elegant analog watch with genuine leather strap and water resistance.', 8500, 'img/product1.jpg', 'Accessories'],
    ['Wireless Headphones', 'Noise-cancelling over-ear headphones with 30 hours battery life.', 12000, 'img/product2.jpg', 'Electronics'],
    ['Urban Sneakers', 'Lightweight, comfortable sneakers for everyday wear.', 6500, 'img/product3.jpg', 'Fashion'],
    ['Travel Backpack', 'Spacious water-resistant backpack with laptop compartment.', 4500, 'img/product4.jpg', 'Fashion'],
    ['Aviator Sunglasses', 'UV400 protection polarized sunglasses with metal frame.', 3200, 'img/product5.jpg', 'Accessories'],
    ['Smart Watch', 'Fitness tracking, heart-rate monitor and call notifications.', 15000, 'img/product6.jpg', 'Electronics'],
    ['Designer Handbag', 'Stylish handbag with premium finish and roomy interior.', 9800, 'img/product7.jpg', 'Fashion'],
    ['Luxury Perfume', 'Long-lasting fragrance with floral and woody notes (100ml).', 5500, 'img/product8.jpg', 'Accessories']
  ].forEach(p => ins.run(...p));
}

// ---------- Auth helper ----------
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    req.user = jwt.verify(h.replace('Bearer ', ''), SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Please log in first' });
  }
}

// ---------- Products ----------
app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products').all());
});
app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  p ? res.json(p) : res.status(404).json({ error: 'Product not found' });
});

// ---------- Users ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name, email.toLowerCase(), hash);
    const user = { id: Number(r.lastInsertRowid), name, email };
    res.json({ token: jwt.sign(user, SECRET, { expiresIn: '7d' }), user });
  } catch (e) {
    res.status(400).json({ error: 'This email is already registered' });
  }
});
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password)) return res.status(400).json({ error: 'Incorrect email or password' });
  const user = { id: u.id, name: u.name, email: u.email };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '7d' }), user });
});

// ---------- Orders ----------
app.post('/api/orders', auth, (req, res) => {
  const { items, address } = req.body;
  if (!items || !items.length || !address) return res.status(400).json({ error: 'Cart or address is empty' });
  const getP = db.prepare('SELECT * FROM products WHERE id=?');
  const place = () => {
    db.exec('BEGIN');
    try {
      let total = 0;
      const rows = items.map(i => {
        const p = getP.get(i.id);
        if (!p) throw new Error('Invalid product');
        total += p.price * i.qty;
        return { id: p.id, qty: i.qty, price: p.price };
      });
      const o = db.prepare('INSERT INTO orders(user_id,total,address) VALUES(?,?,?)').run(req.user.id, total, address);
      const insItem = db.prepare('INSERT INTO order_items(order_id,product_id,qty,price) VALUES(?,?,?,?)');
      rows.forEach(r => insItem.run(Number(o.lastInsertRowid), r.id, r.qty, r.price));
      db.exec('COMMIT');
      return { orderId: Number(o.lastInsertRowid), total };
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  try { res.json(place()); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  const items = db.prepare('SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE order_id=?');
  res.json(orders.map(o => ({ ...o, items: items.all(o.id) })));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ShopZone is running at http://localhost:' + PORT));
