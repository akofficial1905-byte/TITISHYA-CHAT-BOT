// app.js - single-terminal server (file-based storage) for Titishya Fast Food
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

// middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// sockets
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});

// create order
app.post('/api/orders', (req, res) => {
  try {
    const { customerName, tableNumber, language, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Cart empty' });

    const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty || 1), 0);
    const platformFee = 2;
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
      status: 'received', // values: received, preparing, delivered, deleted
      createdAt: new Date().toISOString()
    };

    const orders = loadOrders();
    orders.unshift(order);
    saveOrders(orders);

    io.emit('newOrder', order);
    return res.json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// get orders (optional date param YYYY-MM-DD)
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

// update status (preparing/delivered/deleted)
app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const orders = loadOrders();
    const idx = orders.findIndex(o => o.id === req.params.id || o._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Order not found' });
    orders[idx].status = status;
    // if delivered, set deliveredAt timestamp
    if (status === 'delivered') orders[idx].deliveredAt = new Date().toISOString();
    saveOrders(orders);
    io.emit('orderUpdated', orders[idx]);
    return res.json(orders[idx]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// confirm payment
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

// Serve manager page explicitly (optional)
app.get('/manager.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'manager.html'));
});

server.listen(PORT, () => console.log('Server listening on http://localhost:' + PORT));

