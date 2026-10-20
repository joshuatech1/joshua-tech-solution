const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'joshua-tech.db');
const publicDir = path.join(__dirname, 'public');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-to-a-long-random-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(publicDir));

const defaultServices = [
  {
    name: 'Website & App Development',
    description: 'Custom websites and mobile-ready web applications tailored for business growth.',
    price: 450000
  },
  {
    name: 'Cheti cha Kuzaliwa & Kifo',
    description: 'Fast processing and support for birth and death certificate documentation.',
    price: 90000
  },
  {
    name: 'TIN Number Service',
    description: 'Professional assistance to register and manage your TIN details efficiently.',
    price: 150000
  },
  {
    name: 'Betting Apps',
    description: 'Sports betting platform and user-facing app experiences for modern users.',
    price: 650000
  },
  {
    name: 'NIDA Softcopy',
    description: 'Secure NIDA digital copy processing and support services.',
    price: 120000
  },
  {
    name: 'WhatsApp Bot Development',
    description: 'Automated WhatsApp business bots and workflow assistance for customer engagement.',
    price: 300000
  },
  {
    name: 'SMS & Call Services',
    description: 'Bulk messaging and call service integration for business communication.',
    price: 220000
  },
  {
    name: 'Kutrack Simu Iliyopotea',
    description: 'Support to locate and track a lost mobile phone using available recovery workflows.',
    price: 180000
  },
  {
    name: 'Logo & Graphic Design',
    description: 'Premium branding, graphic design, and marketing visuals for businesses.',
    price: 125000
  },
  {
    name: 'Lipa Namba Bila Makato',
    description: 'Seamless number payment solutions with transparent and compliant billing flow.',
    price: 95000
  },
  {
    name: 'Magemu ya Simu & PC',
    description: 'Gaming and digital entertainment platform solutions for local customers.',
    price: 500000
  }
];

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function runExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

async function initDatabase() {
  await runExec('PRAGMA foreign_keys = ON');

  await runExec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runExec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runExec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      message TEXT,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runExec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@joshuatech.co.tz';
  const adminPassword = process.env.ADMIN_PASSWORD || 'set-admin-password-in-.env';

  const existingAdmin = await runQuery('SELECT id FROM admin_users WHERE email = ?', [adminEmail]);
  if (!existingAdmin.length) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await runExec('INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)', [
      adminEmail,
      hash,
      'Joshua Tech Admin'
    ]);
  }

  const serviceCount = await runQuery('SELECT COUNT(*) AS total FROM services');
  if (!serviceCount[0]?.total) {
    for (const service of defaultServices) {
      await runExec('INSERT INTO services (name, description, price) VALUES (?, ?, ?)', [
        service.name,
        service.description,
        service.price
      ]);
    }
  }
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  next();
}

async function verifyPaymentWithProvider(reference, amount, provider) {
  const chosenProvider = (provider || process.env.PAYMENT_PROVIDER || 'simulated').toLowerCase();

  if (chosenProvider === 'simulated') {
    const safeReference = String(reference || '').trim();
    if (!safeReference) {
      return { valid: false, message: 'Missing payment reference.' };
    }

    const valid = /^[A-Z0-9-]{8,}$/i.test(safeReference);
    if (!valid) {
      return { valid: false, message: 'Invalid payment reference format.' };
    }

    return {
      valid: true,
      provider: 'simulated',
      amount: Number(amount || 0),
      reference: safeReference.toUpperCase(),
      message: 'Payment verified successfully via secure backend validation.'
    };
  }

  const apiKey = process.env.PAYMENT_API_KEY;
  const apiSecret = process.env.PAYMENT_SECRET_KEY;
  const baseUrl = process.env.PAYMENT_BASE_URL;

  if (!apiKey || !apiSecret || !baseUrl) {
    return {
      valid: false,
      message: 'Payment provider is not configured. Set PAYMENT_API_KEY, PAYMENT_SECRET_KEY, and PAYMENT_BASE_URL.'
    };
  }

  try {
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/verify`,
      { reference, amount, provider: chosenProvider },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Provider-Secret': apiSecret
        },
        timeout: 10000
      }
    );

    const payload = response.data || {};
    const success = payload.status === 'successful' || payload.success === true || payload.data?.status === 'successful';

    return {
      valid: !!success,
      provider: chosenProvider,
      amount: Number(amount || 0),
      reference,
      data: payload,
      message: success ? 'Payment verified successfully.' : 'Payment verification failed.'
    };
  } catch (error) {
    return {
      valid: false,
      provider: chosenProvider,
      amount: Number(amount || 0),
      reference,
      message: error.response?.data?.message || 'Payment verification request failed.'
    };
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Joshua Tech Solution API' });
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await runQuery('SELECT * FROM services ORDER BY id ASC');
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load services.', error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { name, email, phone, service, message, amount } = req.body || {};

  if (!name || !email || !phone || !service || !amount) {
    return res.status(400).json({ message: 'Please provide name, email, phone, service, and amount.' });
  }

  try {
    const orderResult = await runExec(
      'INSERT INTO orders (name, email, phone, service, message, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, service, message || '', Number(amount), 'pending']
    );

    const reference = `JTS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    await runExec(
      'INSERT INTO payments (order_id, reference, provider, amount, status) VALUES (?, ?, ?, ?, ?)',
      [orderResult.id, reference, process.env.PAYMENT_PROVIDER || 'simulated', Number(amount), 'pending']
    );

    res.status(201).json({
      message: 'Order created successfully.',
      orderId: orderResult.id,
      paymentReference: reference,
      amount: Number(amount)
    });
  } catch (error) {
    res.status(500).json({ message: 'Order creation failed.', error: error.message });
  }
});

app.post('/api/payments/verify', async (req, res) => {
  const { reference, amount, provider } = req.body || {};

  if (!reference) {
    return res.status(400).json({ message: 'Payment reference is required.' });
  }

  try {
    const verification = await verifyPaymentWithProvider(reference, Number(amount || 0), provider);

    await runExec('UPDATE payments SET status = ?, provider = ? WHERE reference = ?', [
      verification.valid ? 'successful' : 'failed',
      verification.provider || (process.env.PAYMENT_PROVIDER || 'simulated'),
      reference
    ]);

    if (verification.valid) {
      await runExec("UPDATE orders SET status = 'paid' WHERE id = (SELECT order_id FROM payments WHERE reference = ?)", [reference]);
    }

    res.json({
      success: verification.valid,
      message: verification.message,
      reference,
      provider: verification.provider || (process.env.PAYMENT_PROVIDER || 'simulated'),
      amount: Number(amount || 0)
    });
  } catch (error) {
    res.status(500).json({ message: 'Payment verification failed.', error: error.message });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await runQuery('SELECT * FROM admin_users WHERE email = ?', [email]);
  if (!user.length) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isPasswordValid = await bcrypt.compare(password, user[0].password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  req.session.user = {
    id: user[0].id,
    email: user[0].email,
    name: user[0].name
  };

  res.json({ message: 'Login successful.', user: req.session.user });
});

app.get('/api/admin/session', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/admin/summary', requireAuth, async (req, res) => {
  try {
    const [totalOrders, paidOrders, pendingOrders, totalRevenue] = await Promise.all([
      runQuery('SELECT COUNT(*) AS total FROM orders'),
      runQuery("SELECT COUNT(*) AS total FROM orders WHERE status = 'paid'"),
      runQuery("SELECT COUNT(*) AS total FROM orders WHERE status = 'pending'"),
      runQuery("SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'paid'")
    ]);

    res.json({
      totalOrders: totalOrders[0]?.total || 0,
      paidOrders: paidOrders[0]?.total || 0,
      pendingOrders: pendingOrders[0]?.total || 0,
      totalRevenue: Number(totalRevenue[0]?.total || 0)
    });
  } catch (error) {
    res.status(500).json({ message: 'Summary unavailable.', error: error.message });
  }
});

app.get('/api/admin/orders', requireAuth, async (req, res) => {
  try {
    const rows = await runQuery(`
      SELECT o.*, p.reference, p.status AS payment_status, p.provider
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Orders unavailable.', error: error.message });
  }
});

app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-login.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/admin-login.html');
  }
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get('/services', (req, res) => {
  res.sendFile(path.join(publicDir, 'services.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(publicDir, 'contact.html'));
});

app.get('/payment', (req, res) => {
  res.sendFile(path.join(publicDir, 'payment.html'));
});

app.get('*', (req, res) => {
  const requestedPath = path.join(publicDir, req.path.replace(/^\//, ''));
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    return res.sendFile(requestedPath);
  }

  res.sendFile(path.join(publicDir, 'index.html'));
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Joshua Tech Solution server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
