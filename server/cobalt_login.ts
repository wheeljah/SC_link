import 'dotenv/config';
import puppeteer from 'puppeteer';

async function loginAndGetCookie() {
  console.log('Starting login...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({'Accept-Language': 'en-US,en;q=0.9'});

  // Go to login page
  await page.goto('https://colab.ws/login', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 2000));

  const url1 = page.url();
  console.log('Login page URL:', url1);

  // Check what login options exist
  const snapshot1 = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(el => ({
      type: el.type, name: el.name, id: el.id,
      placeholder: el.placeholder, 'class': el.className
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
      text: el.innerText?.trim().substring(0,50), 'class': el.className
    }));
    const links = Array.from(document.querySelectorAll('a[href*="auth"], a[href*="login"], a[href*="oauth"]')).map(el => ({
      text: el.innerText?.trim().substring(0,50), href: el.href
    }));
    return { inputs, buttons, links };
  });
  console.log('Login page elements:', JSON.stringify(snapshot1, null, 2));

  // Get CSRF token first
  const csrfToken = await page.$eval('input[name="_token"]', el => (el as HTMLInputElement).value).catch(() => null);
  console.log('CSRF token:', csrfToken ? 'found' : 'not found');

  // Fill and submit if form exists
  const emailEl = await page.$('input[type="email"], input[name="email"], input[name="login"], input[id="email"]');
  const passEl = await page.$('input[type="password"]');

  if (emailEl && passEl) {
    console.log('Found login form, filling...');
    await emailEl.type('wheeljah@gmail.com');
    await passEl.type('L00catm281h');
    await new Promise(r => setTimeout(r, 500));

    // Click submit
    const submit = await page.$('button[type="submit"]');
    if (submit) {
      await Promise.all([
        submit.click(),
        page.waitForNavigation({waitUntil:'networkidle2', timeout:30000}).catch(() => {})
      ]);
    }

    await new Promise(r => setTimeout(r, 3000));
    console.log('After login URL:', page.url());

    // Check if still on login page (login failed)
    if (page.url().includes('/login')) {
      console.log('Still on login page — checking for error message...');
      const errText = await page.evaluate(() => {
        const err = document.querySelector('[class*="error"], [class*="alert"], [role="alert"]');
        return err ? err.innerText : 'no error element found';
      });
      console.log('Error text:', errText);
    }

    // Get all cookies - use individual domains
    let cookies = [];
    try {
      cookies = await page.cookies('https://colab.ws');
    } catch(e) {
      console.log('Cookie error:', e.message);
    }
    console.log('Cookies:', JSON.stringify(cookies.map(c => ({name: c.name, value: c.value.substring(0,30)}))));

    // Write COBALT_SESSION_COOKIE to .env if found
    const sessionCookie = cookies.find(c =>
      c.name.includes('session') || c.name.includes('token') || c.name.includes('auth')
    );
    if (sessionCookie) {
      console.log('Session cookie found:', sessionCookie.name);
      console.log('Value length:', sessionCookie.value.length);

      const fs = await import('fs');
      let envContent = '';
      try {
        envContent = fs.readFileSync('.env', 'utf8');
      } catch {}

      if (envContent.includes('COBALT_SESSION_COOKIE=')) {
        envContent = envContent.replace(/COBALT_SESSION_COOKIE=.*/,
          `COBALT_SESSION_COOKIE=${sessionCookie.value}`);
      } else {
        envContent += `\nCOBALT_SESSION_COOKIE=${sessionCookie.value}\n`;
      }
      fs.writeFileSync('.env', envContent.trim() + '\n');
      console.log('Saved COBALT_SESSION_COOKIE to .env');
    } else {
      console.log('No session cookie found.');
    }

    // Test: navigate to search
    if (!page.url().includes('/login')) {
      await page.goto('https://cobalt.colab.ws/?term=10.1038%2Fs41576-019-0205-4',
        {waitUntil:'networkidle2', timeout:30000});
      await new Promise(r => setTimeout(r, 3000));
      const text = await page.evaluate(() => document.body.innerText);
      console.log('Search page text (first 500):', text.substring(0, 500));
    }
  } else {
    console.log('No login form found — maybe OAuth-only?');
  }

  await browser.close();
  console.log('Done');
}

loginAndGetCookie().catch(e => console.log('Fatal:', e.message, e.stack?.substring(0,300)));
