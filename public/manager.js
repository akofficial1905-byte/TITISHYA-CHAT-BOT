// public/manager.js - manager dashboard with real-time updates
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
    return `<div class="bg-white p-3 rounded mb-3 shadow-sm">
      <div class="flex justify-between items-start">
        <div>
          <div class="font-semibold">${escapeHtml(o.customerName)} — Table ${escapeHtml(o.tableNumber || '-')}</div>
          <div class="text-sm text-gray-500">${new Date(o.createdAt).toLocaleString()}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">₹${o.total}</div>
          <div class="text-sm text-gray-500">${o.paymentStatus ? 'Paid' : 'Pending'}</div>
        </div>
      </div>
      <div class="mt-2 text-sm">${o.items.map(it=>'<div>'+escapeHtml(it.qty)+' × '+escapeHtml(it.name)+' — ₹'+it.price+'</div>').join('')}</div>
      <div class="mt-3">${!isDelivered ? '<button class="px-3 py-1 bg-yellow-400 rounded mr-2" data-id="'+o.id+'" data-action="preparing">Mark Preparing</button><button class="px-3 py-1 bg-green-600 text-white rounded mr-2" data-id="'+o.id+'" data-action="delivered">Mark Delivered</button><button class="px-3 py-1 bg-red-500 text-white rounded" data-id="'+o.id+'" data-action="delete">Delete</button>' : ''}</div>
    </div>`;
  }

  socket.on('newOrder', (o) => {
    // if current date, reload
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
})();

