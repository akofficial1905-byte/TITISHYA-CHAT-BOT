// app.js - single-terminal server for Titishya Fast Food
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'orders.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ensure data file exists
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function loadOrders() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); }
  catch (e) { return []; }
}
function saveOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

app.use(express.json());
app.use(express.static(PUBLIC_DIR)); // serve public files

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});

// Create order
app.post('/api/orders', (req, res) => {
  try {
    const { customerName, tableNumber, language, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Cart empty' });

    const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty || 1), 0);
    const platformFee = 2; // ₹2
    const total = subtotal + platformFee;
    const id = Date.now().toString();

    const order = {
      id,
      customerName: customerName || 'Guest',
      tableNumber: tableNumber || '',
      language: language || 'English',
      items,
      subtotal,
      platformFee,
      total,
      paymentStatus: false,
      status: 'received',
      createdAt: new Date().toISOString()
    };

    const orders = loadOrders();
    orders.unshift(order); // newest first
    saveOrders(orders);

    io.emit('newOrder', order);
    return res.json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get orders (optional ?date=YYYY-MM-DD)
app.get('/api/orders', (req, res) => {
  try {
    const { date } = req.query;
    let orders = loadOrders();
    if (date) orders = orders.filter(o => (o.createdAt || '').slice(0,10) === date);
    return res.json(orders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update status (preparing/delivered/deleted)
app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const orders = loadOrders();
    const idx = orders.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Order not found' });
    orders[idx].status = status;
    saveOrders(orders);
    io.emit('orderUpdated', orders[idx]);
    return res.json(orders[idx]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Confirm payment (simulate)
app.post('/api/payments/confirm', (req, res) => {
  try {
    const { orderId } = req.body;
    const orders = loadOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return res.status(404).json({ message: 'Order not found' });
    orders[idx].paymentStatus = true;
    saveOrders(orders);
    io.emit('orderUpdated', orders[idx]);
    return res.json(orders[idx]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Mock payment page for QR scanner
app.get('/mock-payment', (req, res) => {
  const orderId = req.query.orderId;
  const orders = loadOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.send('<h2>Order not found</h2><a href="/">Back</a>');

  const html = `
  <!doctype html><html><head><meta charset="utf-8"><title>Pay — Titishya</title>
  <style>body{font-family:system-ui,Arial;padding:24px;background:#f8fafc;color:#111} .card{max-width:520px;margin:20px auto;padding:16px;border-radius:12px;background:#fff;box-shadow:0 8px 28px rgba(2,6,23,0.08)}</style>
  </head><body>
    <div class="card">
      <h2>Pay ₹${order.total} — Order ${order.id}</h2>
      <p>Customer: ${escapeHtml(order.customerName)} | Table: ${escapeHtml(order.tableNumber || '-')}</p>
      <p>Items:</p>
      <ul>${order.items.map(it => '<li>'+escapeHtml(it.name)+' × '+(it.qty||1)+' — ₹'+it.price+'</li>').join('')}</ul>
      <p><strong>Platform fee ₹${order.platformFee} included</strong></p>
      <div style="margin-top:12px">
        <button id="payBtn" style="padding:10px 14px;border-radius:8px;background:#10b981;color:white;border:none;cursor:pointer">Simulate Payment</button>
        <span id="status" style="margin-left:12px"></span>
      </div>
      <p style="margin-top:12px;color:#666;font-size:13px">After payment, show this page or payment proof to the counter.</p>
      <p style="margin-top:8px"><a href="/">Back to Menu</a></p>
    </div>
    <script>
      document.getElementById('payBtn').addEventListener('click', async function(){
        this.disabled = true;
        document.getElementById('status').textContent = 'Processing...';
        const resp = await fetch('/api/payments/confirm', {
          method:'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ orderId: '${order.id}' })
        });
        if (resp.ok) {
          document.getElementById('status').textContent = 'Paid ✓';
        } else {
          document.getElementById('status').textContent = 'Payment failed';
        }
      });
      function escapeHtml(s){ return (''+s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }
    </script>
  </body></html>
  `;
  res.send(html);
});

function escapeHtml(s) { return (''+s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }

server.listen(PORT, () => console.log('Server listening on http://localhost:' + PORT));

