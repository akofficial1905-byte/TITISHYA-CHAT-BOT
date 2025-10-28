// public/manager.js - manager dashboard with print-ready receipts
(async function(){
  const socket = io();
  const datePicker = document.getElementById('datePicker');
  const incomingDiv = document.getElementById('incoming');
  const deliveredDiv = document.getElementById('delivered');
  const totalOrdersEl = document.getElementById('totalOrders');

  function todayStr(){ return new Date().toISOString().slice(0,10); }
  datePicker.value = todayStr();

  let orders = [];

  async function fetchOrders(date){
    const resp = await fetch('/api/orders?date=' + date);
    orders = await resp.json();
    render();
  }

  function render(){
    const incomings = orders.filter(o => o.status !== 'delivered' && o.status !== 'deleted');
    const delivereds = orders.filter(o => o.status === 'delivered');

    totalOrdersEl.textContent = orders.length;

    incomingDiv.innerHTML = incomings.map(o => orderCard(o, false)).join('');
    deliveredDiv.innerHTML = delivereds.map(o => orderCard(o, true)).join('');

    // attach actions
    document.querySelectorAll('button[data-action]').forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute('data-id');
        const act = b.getAttribute('data-action');
        if (act === 'delete' && !confirm('Delete order?')) return;
        await fetch('/api/orders/' + id + '/status', {
          method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: act })
        });
        // server emits update; refresh local list
        await fetchOrders(datePicker.value);
      }
    });
  }

  function orderCard(o, isDelivered){
    return `<div class="bg-white p-3 rounded mb-3 shadow-sm order-details" id="order-${o.id}">
      <div>
        <h2 style="margin:0;font-size:1.1em;text-align:center;">Titishya Fast Food</h2>
        <div style="font-weight:bold;">Order#: ${escapeHtml(o.id)}</div>
        <div>Customer: ${escapeHtml(o.customerName)} — Table ${escapeHtml(o.tableNumber || '-')}</div>
        <div style="color:#666;font-size:13px;">${new Date(o.createdAt).toLocaleString()}</div>
        <hr>
        <div>${o.items.map(it=>`${escapeHtml(it.qty)} × ${escapeHtml(it.name)} — ₹${it.price}`).join('<br>')}</div>
        <hr>
        <div style="font-weight:bold;">Total: ₹${o.total}</div>
        <div style="font-size:13px;color:#666;">${o.paymentStatus ? 'Paid' : 'Pending payment'}</div>
        ${o.status === 'delivered' && o.deliveredAt ? `<div style="font-size:12px;">Delivered at: ${new Date(o.deliveredAt).toLocaleString()}</div>` : ''}
        <div style="text-align:center;margin-top:8px;font-size:13px;">Thank you!</div>
      </div>
      <div class="mt-3" style="display:flex;gap:8px;margin-top:10px;">
        <button class="px-3 py-1 bg-blue-500 text-white rounded" onclick="printOrder('${o.id}')">Print</button>
        ${
          !isDelivered
            ? `<button class="px-3 py-1 bg-yellow-400 rounded" data-id="${o.id}" data-action="preparing">Mark Preparing</button>
               <button class="px-3 py-1 bg-green-600 text-white rounded" data-id="${o.id}" data-action="delivered">Mark Delivered</button>
               <button class="px-3 py-1 bg-red-500 text-white rounded" data-id="${o.id}" data-action="delete">Delete</button>`
            : ``
        }
      </div>
    </div>`;
  }

  socket.on('newOrder', (o) => {
    if ((o.createdAt||'').slice(0,10) === datePicker.value) {
      fetchOrders(datePicker.value);
    }
  });
  socket.on('orderUpdated', (o) => {
    fetchOrders(datePicker.value);
  });

  datePicker.onchange = ()=> fetchOrders(datePicker.value);

  // initial load
  await fetchOrders(datePicker.value);

  function escapeHtml(s){ return (''+s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // PRINT FUNCTION
  window.printOrder = function(orderId) {
    var orderElem = document.getElementById('order-' + orderId);
    if (!orderElem) return;

    let clone = orderElem.cloneNode(true);
    let actionDiv = clone.querySelector('.mt-3');
    if (actionDiv) actionDiv.style.display = 'none';

    const printContent = `
      <div style="font-family:monospace;font-size:16px;max-width:280px;margin:auto;">
        ${clone.innerHTML}
      </div>
    `;

    var printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write('<html><head><title>Order Print</title>');
    printWindow.document.write(`
      <style>
        body { margin:0;padding:10px;background:#fff; }
        h2 { text-align:center;margin:0 0 10px 0; }
        hr { margin:10px 0;border:none;border-top:1px dashed #333; }
        .order-details { box-shadow:none;border:none; }
        @media print {
          body { margin:0; }
          .mt-3, button { display: none !important; }
        }
      </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      setTimeout(function(){ printWindow.close(); }, 600);
    };
  };
})();

