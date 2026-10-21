const $ = s => document.querySelector(s);
const money = n => 'Rs. ' + Number(n).toLocaleString();
const getCart = () => JSON.parse(localStorage.getItem('cart') || '[]');
const saveCart = c => { localStorage.setItem('cart', JSON.stringify(c)); badge(); };
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');
const PH = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='100%' height='100%' fill='%23161616'/><text x='50%' y='50%' font-size='22' text-anchor='middle' fill='%23d4af37' font-family='Arial'>Image coming soon</text></svg>";
const img = p => `<img src="${p.image}" alt="${p.name}" onerror="this.onerror=null;this.src=&quot;${PH}&quot;">`;

async function api(url, opts = {}) {
  const t = localStorage.getItem('token');
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
function badge() { const b = $('#badge'); if (b) b.textContent = getCart().reduce((a, i) => a + i.qty, 0); }
function logout() { localStorage.removeItem('token'); localStorage.removeItem('user'); location.href = 'index.html'; }

function layout() {
  const u = getUser();
  $('#nav').innerHTML = `<header><div class="container nav">
    <a class="logo" href="index.html">Shop<span>Zone</span></a>
    <nav class="links">
      <a href="index.html">Home</a>
      <a href="index.html#products">Products</a>
      ${u ? `<a href="orders.html">My Orders</a><a href="#" onclick="logout()">Logout (${u.name.split(' ')[0]})</a>` : `<a href="login.html">Login</a>`}
      <a class="cart-link" href="cart.html">🛒<span id="badge">0</span></a>
    </nav></div></header>`;
  $('#footer').innerHTML = `<footer><div class="container">© ${new Date().getFullYear()} <b>ShopZone</b> — Made 
   by <b>Emaan</b></div></footer><div id="toast"></div>`;
  badge();
}

function addToCart(p, qty = 1) {
  const c = getCart(), f = c.find(i => i.id === p.id);
  f ? f.qty += qty : c.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty });
  saveCart(c); toast(p.name + ' added to cart ✅');
}

const pages = {
  async home() {
    const all = await api('/api/products');
    const cats = ['All', ...new Set(all.map(p => p.category))];
    let cat = 'All', q = '';
    $('#chips').innerHTML = cats.map(c => `<button class="chip ${c === 'All' ? 'active' : ''}" data-c="${c}">${c}</button>`).join('');
    const draw = () => {
      const list = all.filter(p => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q));
      $('#grid').innerHTML = list.length ? list.map(p => `
        <div class="card"><a href="product.html?id=${p.id}"><div class="img">${img(p)}</div></a>
        <div class="body"><span class="tag">${p.category}</span><h3>${p.name}</h3>
        <div class="row"><span class="price">${money(p.price)}</span><button class="btn small" data-add="${p.id}">Add to Cart</button></div></div></div>`).join('')
        : '<p class="empty" style="grid-column:1/-1">No products found 😕</p>';
    };
    $('#chips').onclick = e => { if (e.target.dataset.c) { cat = e.target.dataset.c; document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.c === cat)); draw(); } };
    $('#search').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    $('#grid').onclick = e => { if (e.target.dataset.add) addToCart(all.find(p => p.id == e.target.dataset.add)); };
    draw();
  },

  async product() {
    const p = await api('/api/products/' + new URLSearchParams(location.search).get('id'));
    let qty = 1;
    $('#detail').innerHTML = `<div class="pic">${img(p)}</div><div>
      <span class="tag">${p.category}</span><h1>${p.name}</h1><div class="price">${money(p.price)}</div>
      <p style="color:#6b7280;margin-bottom:24px">${p.description}</p>
      <div class="qty"><button id="m">−</button><b id="q">1</b><button id="p">+</button></div>
      <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn" id="add">Add to Cart</button><a class="btn outline" href="cart.html">Go to Cart</a></div></div>`;
    $('#m').onclick = () => { qty = Math.max(1, qty - 1); $('#q').textContent = qty; };
    $('#p').onclick = () => { qty++; $('#q').textContent = qty; };
    $('#add').onclick = () => addToCart(p, qty);
  },

  cart() {
    const draw = () => {
      const c = getCart(), total = c.reduce((a, i) => a + i.price * i.qty, 0);
      if (!c.length) { $('#cart').innerHTML = '<div class="empty" style="grid-column:1/-1"><h2>Your cart is empty 🛒</h2><br><a class="btn" href="index.html">Start Shopping</a></div>'; return; }
      $('#cart').innerHTML = `<div class="panel">${c.map((i, n) => `
        <div class="cart-item">${img(i)}<div class="info"><b>${i.name}</b><div class="price">${money(i.price)}</div></div>
        <div class="qty"><button data-d="${n}" data-v="-1">−</button><b>${i.qty}</b><button data-d="${n}" data-v="1">+</button></div>
        <button class="remove" data-r="${n}">✕</button></div>`).join('')}</div>
        <div class="panel"><h3 style="margin-bottom:14px">Order Summary</h3>
        <div class="sum"><span>Subtotal</span><span>${money(total)}</span></div>
        <div class="sum"><span>Delivery</span><span>Free</span></div>
        <div class="sum total"><span>Total</span><span>${money(total)}</span></div>
        <textarea id="addr" rows="3" placeholder="Enter your delivery address..." style="margin:14px 0"></textarea>
        <button class="btn" style="width:100%" id="order">Place Order</button></div>`;
    };
    $('#cart').onclick = async e => {
      const c = getCart(), d = e.target.dataset;
      if (d.d !== undefined) { c[d.d].qty = Math.max(1, c[d.d].qty + +d.v); saveCart(c); draw(); }
      if (d.r !== undefined) { c.splice(d.r, 1); saveCart(c); draw(); }
      if (e.target.id === 'order') {
        if (!getUser()) { toast('Please log in first'); return setTimeout(() => location.href = 'login.html?next=cart.html', 900); }
        try {
          const r = await api('/api/orders', { method: 'POST', body: { items: c.map(i => ({ id: i.id, qty: i.qty })), address: $('#addr').value.trim() } });
          saveCart([]);
          $('#cart').innerHTML = `<div class="empty" style="grid-column:1/-1"><h1>🎉 Order Placed Successfully!</h1><p>Order #${r.orderId} — Total ${money(r.total)}</p><br><a class="btn" href="orders.html">My Orders</a></div>`;
        } catch (err) { toast(err.message); }
      }
    };
    draw();
  },

  login() {
    let mode = 'login';
    const set = m => {
      mode = m;
      $('#nameField').style.display = m === 'register' ? 'block' : 'none';
      $('#go').textContent = m === 'login' ? 'Login' : 'Create Account';
      document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.m === m));
    };
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => set(b.dataset.m));
    $('#go').onclick = async () => {
      try {
        const body = { name: $('#name').value, email: $('#email').value, password: $('#pass').value };
        const r = await api('/api/' + mode, { method: 'POST', body });
        localStorage.setItem('token', r.token); localStorage.setItem('user', JSON.stringify(r.user));
        location.href = new URLSearchParams(location.search).get('next') || 'index.html';
      } catch (err) { toast(err.message); }
    };
    set('login');
  },

  async orders() {
    if (!getUser()) return location.href = 'login.html?next=orders.html';
    const list = await api('/api/orders');
    $('#orders').innerHTML = list.length ? list.map(o => `<div class="panel order">
      <div class="head"><b>Order #${o.id}</b><span class="badge-ok">Placed</span><span>${o.created_at}</span></div>
      ${o.items.map(i => `<div class="sum"><span>${i.name} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
      <div class="sum total"><span>Total</span><span>${money(o.total)}</span></div>
      <small style="color:#6b7280">📍 ${o.address}</small></div>`).join('')
      : '<div class="empty"><h2>You have no orders yet 📦</h2><br><a class="btn" href="index.html">Start Shopping</a></div>';
  }
};

layout();
pages[document.body.dataset.page]?.();
