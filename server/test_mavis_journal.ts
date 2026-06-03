import 'dotenv/config';
import { execSync } from 'child_process';
import * as fs from 'fs';

function main() {
  // Navigate to journal page
  console.log('Navigating to journal...');
  try {
    const navResult = execSync('mavis browser tool navigate "{\\"url\\":\\"https://colab.ws/journals/13955?locale=en\\"}"', { encoding: 'utf8', timeout: 15000, windowsHide: true });
    console.log('Navigate:', navResult.substring(0, 100));
  } catch(e) {
    console.log('Nav err:', e.message.substring(0,200));
  }

  // Wait for page to load
  execSync('powershell -Command "Start-Sleep -Seconds 5"', { windowsHide: true });

  // Get page text
  console.log('Getting page text...');
  try {
    const ptResult = execSync('mavis browser tool query "{\\"mode\\":\\"page_text\\",\\"limit\\":5000}"', { encoding: 'utf8', timeout: 15000, windowsHide: true });
    const pt = JSON.parse(ptResult);
    const text = pt.content || '';
    console.log('Page text (first 1200):', String(text).substring(0, 1200));
    fs.writeFileSync('D:/SC_link/server/cobalt_journal_text.txt', String(text));
    console.log('Text length:', text.length);
  } catch(e) {
    console.log('PT err:', e.message.substring(0,200));
  }

  // Get screenshot
  console.log('Getting screenshot...');
  try {
    const ssResult = execSync('mavis browser tool screenshot "{}"', { encoding: 'utf8', timeout: 15000, windowsHide: true });
    const ss = JSON.parse(ssResult);
    const content = ss.content || '';
    if (content && String(content).startsWith('data:')) {
      const base64 = String(content).split(',')[1];
      fs.writeFileSync('D:/SC_link/server/cobalt_journal_screen.png', Buffer.from(base64, 'base64'));
      console.log('Screenshot saved!');
    }
  } catch(e) {
    console.log('SS err:', e.message.substring(0,200));
  }
}

main();