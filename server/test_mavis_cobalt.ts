import 'dotenv/config';
import { execSync } from 'child_process';
import * as fs from 'fs';

function main() {
  // Use mavis browser to navigate to Cobalt article page
  console.log('Navigating to article...');
  try {
    const navResult = execSync('mavis browser tool navigate "{\\"url\\":\\"https://colab.ws/articles/10.1038/s41576-019-0205-4?locale=en\\"}"', { encoding: 'utf8', timeout: 15000, windowsHide: true });
    console.log('Navigate:', navResult.substring(0, 100));
  } catch(e) {
    console.log('Nav err:', e.message.substring(0,200));
  }

  // Wait for page to load using PowerShell ping
  execSync('powershell -Command "Start-Sleep -Seconds 5"', { windowsHide: true });

  // Get page text
  console.log('Getting page text...');
  try {
    const ptResult = execSync('mavis browser tool query "{\\"mode\\":\\"page_text\\",\\"limit\\":5000}"', { encoding: 'utf8', timeout: 15000, windowsHide: true });
    const pt = JSON.parse(ptResult);
    const text = pt.content || '';
    console.log('Page text (first 1000):', String(text).substring(0, 1000));
    fs.writeFileSync('D:/SC_link/server/cobalt_article_text.txt', String(text));
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
    console.log('Content type:', typeof content, 'Len:', content.length);

    if (content && String(content).startsWith('data:')) {
      const base64 = String(content).split(',')[1];
      fs.writeFileSync('D:/SC_link/server/cobalt_article_screen.png', Buffer.from(base64, 'base64'));
      console.log('Screenshot saved!');
    } else {
      console.log('No data URL, raw:', String(content).substring(0, 200));
    }
  } catch(e) {
    console.log('SS err:', e.message.substring(0,200));
  }
}

main();