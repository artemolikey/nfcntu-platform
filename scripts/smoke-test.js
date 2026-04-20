const { spawn } = require('child_process');

const baseUrl = 'http://127.0.0.1:3099';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      // waiting for server
    }
    await wait(1000);
  }
  throw new Error('Сервер не відповідає на /health.');
}

async function fetchWithCookie(url, options = {}, cookie = '') {
  const response = await fetch(url, {
    redirect: options.redirect || 'manual',
    method: options.method || 'GET',
    headers: {
      ...(options.headers || {}),
      ...(cookie ? { cookie } : {})
    },
    body: options.body
  });
  return response;
}

(async () => {
  const child = spawn(process.execPath, ['src/server.js'], {
    env: {
      ...process.env,
      DB_CLIENT: 'pgmem',
      AUTO_SEED: 'true',
      SESSION_SECRET: 'smoke-secret',
      PORT: '3099',
      APP_URL: baseUrl
    },
    stdio: 'inherit'
  });

  let finished = false;
  const finish = (code = 0) => {
    if (finished) return;
    finished = true;
    child.kill('SIGTERM');
    process.exit(code);
  };

  try {
    await waitForHealth();

    const homeResponse = await fetch(`${baseUrl}/`);
    const homeHtml = await homeResponse.text();
    if (!homeResponse.ok || !homeHtml.includes('Платформа замовлень')) {
      throw new Error('Головна сторінка не відображається коректно.');
    }

    const loginBody = new URLSearchParams({
      email: 'admin@nfcntu.ukr.education',
      password: 'College2025!'
    });

    const loginResponse = await fetchWithCookie(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: loginBody.toString()
    });

    const cookie = loginResponse.headers.get('set-cookie');
    if (![302, 303].includes(loginResponse.status) || !cookie) {
      throw new Error('Не вдалося виконати вхід у систему.');
    }

    const dashboardResponse = await fetchWithCookie(`${baseUrl}/dashboard`, {}, cookie);
    const dashboardHtml = await dashboardResponse.text();
    if (!dashboardResponse.ok || !dashboardHtml.includes('Огляд системи')) {
      throw new Error('Dashboard адміністратора не відкривається.');
    }

    const allOrdersResponse = await fetchWithCookie(`${baseUrl}/orders`, {}, cookie);
    const allOrdersHtml = await allOrdersResponse.text();
    if (!allOrdersResponse.ok || !(allOrdersHtml.includes('Список замовлень платформи') || allOrdersHtml.includes('Замовлення'))) {
      throw new Error('Загальна сторінка замовлень не відкривається.');
    }

    const ordersResponse = await fetchWithCookie(`${baseUrl}/admin/orders`, {}, cookie);
    const ordersHtml = await ordersResponse.text();
    if (!ordersResponse.ok || !ordersHtml.includes('Усі замовлення')) {
      throw new Error('Адмінська сторінка замовлень не відкривається.');
    }

    const usersResponse = await fetchWithCookie(`${baseUrl}/admin/users`, {}, cookie);
    const usersHtml = await usersResponse.text();
    if (!usersResponse.ok || !usersHtml.includes('Користувачі системи')) {
      throw new Error('Адмінська сторінка користувачів не відкривається.');
    }

    console.log('Smoke test успішно пройдено.');
    finish(0);
  } catch (error) {
    console.error('Smoke test завершився помилкою:', error);
    finish(1);
  }
})();
