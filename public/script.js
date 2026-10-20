async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }
  return data;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function showMessage(elementId, message, isError = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#ff7d7d' : '#63e6ff';
}

async function populateServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  try {
    const services = await fetchJson('/api/services');
    const options = document.getElementById('serviceSelect');

    if (options) {
      services.forEach((service) => {
        const option = document.createElement('option');
        option.value = service.name;
        option.textContent = `${service.name} (${formatCurrency(service.price)})`;
        options.appendChild(option);
      });
    }

    grid.innerHTML = services
      .map(
        (service) => `
          <article class="service-card">
            <div class="service-badge">Service</div>
            <h3>${service.name}</h3>
            <p>${service.description}</p>
            <div class="service-meta">
              <span class="service-price">${formatCurrency(service.price)}</span>
              <span class="service-badge">Ready</span>
            </div>
          </article>
        `
      )
      .join('');
  } catch (error) {
    grid.innerHTML = '<p class="form-message">Unable to load services right now.</p>';
  }
}

async function handleOrderSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await fetchJson('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showMessage('orderMessage', `Order created. Payment reference: ${result.paymentReference}. Please verify payment using the reference above.`);
    form.reset();
  } catch (error) {
    showMessage('orderMessage', error.message, true);
  }
}

async function handleVerifySubmit(event) {
  event.preventDefault();
  const reference = document.getElementById('verifyReference')?.value;
  const amount = document.getElementById('verifyAmount')?.value;

  try {
    const result = await fetchJson('/api/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ reference, amount })
    });

    showMessage('verifyMessage', result.success ? `Payment verified successfully for ${reference}.` : `Verification failed: ${result.message}`);
  } catch (error) {
    showMessage('verifyMessage', error.message, true);
  }
}

async function handleContactSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  const message = `New enquiry from ${payload.contactName} (${payload.contactPhone}): ${payload.contactMessage}`;
  showMessage('contactMessage', 'Thank you! Your message has been captured and our team will contact you soon.');
  form.reset();
  console.log(message);
}

async function adminLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const result = await fetchJson('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showMessage('adminLoginMessage', result.message || 'Login successful.');
    window.location.href = '/admin';
  } catch (error) {
    showMessage('adminLoginMessage', error.message, true);
  }
}

async function loadAdminDashboard() {
  const tableBody = document.getElementById('ordersTableBody');
  const totalOrdersEl = document.getElementById('totalOrders');
  const paidOrdersEl = document.getElementById('paidOrders');
  const pendingOrdersEl = document.getElementById('pendingOrders');
  const totalRevenueEl = document.getElementById('totalRevenue');
  const logoutButton = document.getElementById('logoutButton');

  if (!tableBody) return;

  try {
    const summary = await fetchJson('/api/admin/summary');
    totalOrdersEl.textContent = summary.totalOrders;
    paidOrdersEl.textContent = summary.paidOrders;
    pendingOrdersEl.textContent = summary.pendingOrders;
    totalRevenueEl.textContent = formatCurrency(summary.totalRevenue);

    const orders = await fetchJson('/api/admin/orders');
    tableBody.innerHTML = orders
      .map(
        (order) => `
          <tr>
            <td>${order.id}</td>
            <td>${order.name}</td>
            <td>${order.service}</td>
            <td>${order.phone}</td>
            <td>${formatCurrency(order.amount)}</td>
            <td>${order.reference || '—'}</td>
            <td>
              <span class="status-pill ${order.status === 'paid' ? 'status-success' : order.status === 'pending' ? 'status-pending' : 'status-failed'}">
                ${order.status || 'pending'}
              </span>
            </td>
          </tr>
        `
      )
      .join('');
  } catch (error) {
    tableBody.innerHTML = '<tr><td colspan="7">Unable to load dashboard data.</td></tr>';
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await fetchJson('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin-login.html';
      } catch (error) {
        console.error('Logout failed', error);
      }
    });
  }
}

function initPage() {
  populateServices();

  const orderForm = document.getElementById('orderForm');
  const verifyForm = document.getElementById('verifyForm');
  const contactForm = document.getElementById('contactForm');
  const adminLoginForm = document.getElementById('adminLoginForm');

  if (orderForm) orderForm.addEventListener('submit', handleOrderSubmit);
  if (verifyForm) verifyForm.addEventListener('submit', handleVerifySubmit);
  if (contactForm) contactForm.addEventListener('submit', handleContactSubmit);
  if (adminLoginForm) adminLoginForm.addEventListener('submit', adminLoginSubmit);

  if (document.getElementById('ordersTableBody')) {
    loadAdminDashboard();
  }
}

document.addEventListener('DOMContentLoaded', initPage);
