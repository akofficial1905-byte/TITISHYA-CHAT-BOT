// public/customer.js - wizard, menu, cart, checkout + QR
(async function(){
  const wizardArea = document.getElementById('wizardArea');
  const menuArea = document.getElementById('menuArea');
  const cartBox = document.getElementById('cartBox');
  const cartItems = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotalEl = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');

  let step = 0;
  let language = 'English';
  let customerName = '';
  let tableNumber = '';
  let menu = {};
  let cart = [];

  // load menu
  try {
    menu = await (await fetch('/menu.json')).json();
  } catch (e) {
    wizardArea.innerHTML = `<div class="p-6 bg-white rounded-2xl shadow">Failed to load menu.json</div>`;
    console.error(e);
    return;
  }

  function renderWizard(){
    if (step === 0) {
      wizardArea.innerHTML = `
        <div class="bg-white rounded-2xl shadow p-6">
          <h2 class="text-2xl font-bold text-indigo-700">Welcome to TITISHYA FAST FOOD</h2>
          <p class="text-gray-600 mt-2">University friendly — quick ordering</p>
          <div class="mt-4"><button id="startBtn" class="bg-indigo-600 text-white px-4 py-2 rounded-lg">Start Order</button></div>
        </div>`;
      document.getElementById('startBtn').onclick = ()=> { step = 1; renderWizard(); }
    } else if (step === 1) {
      wizardArea.innerHTML = `
        <div class="bg-white rounded-2xl shadow p-6">
          <h3 class="text-lg font-semibold">Choose Language / भाषा चुनें</h3>
          <div class="mt-4 flex gap-3">
            <button id="enBtn" class="px-4 py-2 bg-indigo-600 text-white rounded">English</button>
            <button id="hiBtn" class="px-4 py-2 bg-gray-100 rounded">हिन्दी</button>
          </div>
        </div>`;
      document.getElementById('enBtn').onclick = ()=> { language='English'; step=2; renderWizard(); renderMenu(); }
      document.getElementById('hiBtn').onclick = ()=> { language='Hindi'; step=2; renderWizard(); renderMenu(); }
    } else if (step === 2) {
      wizardArea.innerHTML = `
        <div class="bg-white rounded-2xl shadow p-6">
          <h3 class="text-lg font-semibold">Your Name & Table Number</h3>
          <input id="nameInput" placeholder="Your name" class="mt-3 p-2 border rounded w-full" />
          <input id="tableInput" placeholder="Table number (optional)" class="mt-3 p-2 border rounded w-full" />
          <div class="mt-4 flex justify-between">
            <button id="backBtn" class="px-3 py-2 rounded border">Back</button>
            <button id="toMenuBtn" class="px-4 py-2 bg-indigo-600 text-white rounded">View Menu</button>
          </div>
        </div>`;
      document.getElementById('backBtn').onclick = ()=> { step=1; renderWizard(); }
      document.getElementById('toMenuBtn').onclick = ()=> {
        customerName = document.getElementById('nameInput').value.trim() || 'Guest';
        tableNumber = document.getElementById('tableInput').value.trim() || '';
        step = 3; renderWizard(); renderMenu();
      }
    } else {
      wizardArea.innerHTML = '';
    }
  }

  function renderMenu(){
    let html = '';
    for (const [category, items] of Object.entries(menu)) {
      html += `<div class="bg-white rounded-2xl shadow p-4 mb-4">
        <h3 class="text-xl font-semibold text-indigo-700 mb-3">${category}</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">`;
      for (const it of items) {
        html += `<div class="p-3 border rounded">
          <div class="font-semibold">${it.name}</div>
          <div class="text-sm text-gray-500 mt-1">${it.details||''}</div>
          <div class="mt-3">`;
        // show price variants
        Object.keys(it).filter(k => k !== 'name' && k !== 'details' && k !== 'category').forEach(k=>{
          const price = it[k];
          html += `<button data-name="${escapeHtml(it.name)}" data-variant="${k}" data-price="${price}" class="mr-2 mb-2 px-3 py-1 bg-indigo-600 text-white rounded text-sm">${k} • ₹${price}</button>`;
        });
        html += `</div></div>`;
      }
      html += `</div></div>`;
    }
    menuArea.innerHTML = html;

    // show cart UI
    cartBox.classList.remove('hidden');
    attachMenuButtons();
    renderCart();
  }

  function attachMenuButtons(){
    menuArea.querySelectorAll('button[data-name]').forEach(btn=>{
      btn.onclick = ()=>{
        const name = btn.getAttribute('data-name');
        const variant = btn.getAttribute('data-variant');
        const price = Number(btn.getAttribute('data-price'));
        const itemId = name + '|' + variant;
        const existing = cart.find(c => c.itemId === itemId);
        if (existing) existing.qty += 1;
        else cart.push({ itemId, name: name + ' ('+variant+')', price, qty: 1 });
        renderCart();
      }
    });
  }

  function renderCart(){
    cartItems.innerHTML = '';
    if (cart.length === 0) cartItems.innerHTML = '<div class="text-gray-500">Cart is empty</div>';
    cart.forEach(c=>{
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center py-2 border-b';
      row.innerHTML = `<div>
          <div class="font-medium">${escapeHtml(c.name)}</div>
          <div class="text-sm text-gray-500">₹${c.price} × ${c.qty}</div>
        </div>
        <div class="flex flex-col gap-2">
          <button class="px-2 py-1 bg-indigo-600 text-white rounded inc">+</button>
          <button class="px-2 py-1 bg-red-500 text-white rounded dec">-</button>
        </div>`;
      cartItems.appendChild(row);

      row.querySelector('.inc').onclick = ()=> { c.qty++; renderCart(); };
      row.querySelector('.dec').onclick = ()=> { c.qty = Math.max(0, c.qty-1); cart = cart.filter(x=>x.qty>0); renderCart(); };
    });

    const count = cart.reduce((s,i)=>s+i.qty,0);
    cartCount.textContent = `(${count})`;
    const subtotal = cart.reduce((s,i)=>s + i.price*i.qty,0);
    const total = subtotal + 2;
    cartTotalEl.textContent = '₹' + total;
    checkoutBtn.disabled = cart.length===0;
  }

  checkoutBtn.onclick = async ()=>{
    if (cart.length === 0) { alert('Cart is empty'); return; }
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Placing order...';
    const payload = {
      customerName,
      tableNumber,
      language,
      items: cart.map(c => ({ itemId: c.itemId, name: c.name, price: c.price, qty: c.qty }))
    };
    try {
      const resp = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error('Order failed');
      const order = await resp.json();
      // show QR using Google Chart API
      menuArea.innerHTML = `<div class="bg-white rounded-2xl shadow p-6">
        <h2 class="text-xl font-bold">Order Placed — ₹${order.total}</h2>
        <p class="text-sm text-gray-500 mt-2">Platform fee ₹${order.platformFee} included</p>
        <div class="mt-4 flex justify-center">
          <img src="https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(location.origin + '/mock-payment?orderId=' + order.id)}" />
        </div>
        <p class="text-sm text-gray-600 mt-3">After payment, show payment proof at the counter.</p>
        <div class="mt-4"><button onclick="location.href='/'" class="px-4 py-2 bg-indigo-600 text-white rounded">Back to Menu</button></div>
      </div>`;
      cart = [];
      renderCart();
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Checkout';
    } catch (e) {
      alert('Order failed: ' + e.message);
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Checkout';
    }
  };

  // initial render
  renderWizard();

  function escapeHtml(s){ return (''+s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
})();

