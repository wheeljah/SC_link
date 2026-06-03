const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadAndAnalyzeChunks() {
  const doi = '10.1007/s13668-023-00492-x';
  const doiUrl = 'https://sci-hub.run/' + doi;
  
  console.log('=== Downloading all JS chunks from sci-hub.run ===\n');
  
  // Get DOI page HTML to find all chunks
  const pageRes = await axios.get(doiUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  // Find the page-specific chunk (not layout)
  const pageChunkMatch = pageRes.data.match(/\/_next\/static\/chunks\/app\/%5Blocale%5D\/%5B\.\.\.doi%5D\/page-[a-f0-9]+\.js/);
  console.log('Page chunk:', pageChunkMatch ? pageChunkMatch[0] : 'not found');
  
  // Get all JS chunks from the page
  const allChunks = pageRes.data.match(/\/_next\/static\/chunks\/[^"'\s)]+\.js/g) || [];
  const uniqueChunks = [...new Set(allChunks)];
  console.log('All unique chunks:', uniqueChunks.length);
  
  // Download each chunk and search for API/backend references
  const apiDomains = new Set();
  const apiPaths = [];
  const pdfPatterns = [];
  
  for (const chunk of uniqueChunks) {
    try {
      const url = 'https://sci-hub.run' + chunk;
      const res = await axios.get(url, { timeout: 15000 });
      const content = res.data;
      const size = content.length;
      
      // Look for backend references
      const domains = content.match(/['"`]https?:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}['"`]/gi) || [];
      domains.forEach(d => apiDomains.add(d));
      
      // Look for fetch/XMLHttpRequest patterns
      const fetchCalls = content.match(/fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/gi) || [];
      apiPaths.push(...fetchCalls.map(f => f.replace(/fetch\s*\(\s*/, '').replace(/['"`]/g, '')));
      
      // Look for PDF/download paths
      const pdfPaths = content.match(/['"`]\/[a-z][a-z0-9/-]*(?:pdf|download|file)[^'"`]*['"`]/gi) || [];
      pdfPatterns.push(...pdfPaths);
      
      // Look for backend config
      const backend = content.match(/(?:baseUrl|baseURL|apiUrl|api_url|host|endpoint|server)\s*[=:]\s*['"`][^'"`]+['"`]/gi) || [];
      if (backend.length > 0) {
        console.log(`\n[${chunk}] Backend config:`, backend);
      }
      
      // Check if this chunk is significant (has meaningful code, not just exports)
      if (size > 1000) {
        const urlInContent = content.match(/['"`]https?:\/\/[a-z0-9.-]+\.\w+\/[^'"`\s]{5,}['"`]/gi);
        if (urlInContent && urlInContent.length > 0) {
          console.log(`\n[${chunk}] (${size}b) External URLs:`, urlInContent.slice(0, 5));
        }
      }
      
    } catch (e) {
      console.log(`Error downloading ${chunk}: ${e.message}`);
    }
  }
  
  console.log('\n\nAll external domains:', [...apiDomains]);
  console.log('\nFetch calls:', apiPaths.slice(0, 10));
  console.log('\nPDF paths:', [...new Set(pdfPatterns)].slice(0, 10));
  
  // Try to find the main page chunk which should have the PDF fetching logic
  const mainPageChunk = uniqueChunks.find(c => c.includes('page-') && c.includes('[...doi]'));
  if (mainPageChunk) {
    console.log('\n\nDownloading main page chunk:', mainPageChunk);
    const res = await axios.get('https://sci-hub.run' + mainPageChunk, { timeout: 15000 });
    fs.writeFileSync('D:/SC_link/server/uploads/scishub_run_page_chunk.js', res.data);
    console.log('Size:', res.data.length);
    
    // The actual page code might be at the end of this chunk
    console.log('Last 2000 chars:', res.data.substring(res.data.length - 2000));
    
    // Search for interesting patterns
    const allStrings = res.data.match(/['"`][^'"`]{3,100}['"`]/g) || [];
    const interesting = allStrings.filter(s => {
      const str = s.slice(1, -1);
      return str.includes('pdf') || str.includes('api') || str.includes('download') || str.includes('proxy') ||
             str.includes('sci-hub') || str.includes('scihub') || str.includes('springer') || 
             str.includes('doi.org') || str.includes('arxiv') || str.includes('fetch');
    });
    console.log('\nInteresting strings:', interesting.slice(0, 20));
  }
  
  // Alternative: look at the full page HTML for inline JSON data
  console.log('\n\n=== Looking for inline data ===');
  const inlineData = pageRes.data.match(/<script[^>]*>([^<]{50,})<\/script>/gi) || [];
  inlineData.forEach((script, i) => {
    const content = script.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
    if (content.includes('pdf') || content.includes('api') || content.includes('download') || content.length > 200) {
      console.log(`\nScript ${i} (${content.length}b):`, content.substring(0, 500));
    }
  });
  
  // Check for window.__NUXT__ or window.__NEXT_DATA__
  const nextDataMatch = pageRes.data.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    console.log('\n__NEXT_DATA__:', nextDataMatch[1].substring(0, 500));
  }
  
  // Try the actual page chunk
  const fullChunkUrl = 'https://sci-hub.run/_next/static/chunks/app/%5Blocale%5D/%5B...doi%5D/page-6f426268fee8c26b.js';
  console.log('\n\nDownloading full page chunk:', fullChunkUrl);
  try {
    const chunkRes = await axios.get(fullChunkUrl, { timeout: 15000 });
    fs.writeFileSync('D:/SC_link/server/uploads/scishub_run_full_page.js', chunkRes.data);
    console.log('Full page chunk size:', chunkRes.data.length);
    
    // Look for all readable strings
    const allReadable = chunkRes.data.match(/['"`][\w.-]+['"`]/g) || [];
    console.log('All readable strings:', [...new Set(allReadable)].slice(0, 30));
    
    // Search for URL patterns
    const urls = chunkRes.data.match(/['"`]https?:\/\/[^'"`]{10,}['"`]/g) || [];
    console.log('URLs:', urls);
    
    // Search for any Chinese text (might indicate backend domain)
    const cnText = chunkRes.data.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    if (cnText.length > 0) console.log('Chinese text:', [...new Set(cnText)].slice(0, 20));
    
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Try to find API by intercepting with a different approach
  // Use playwright-like browser monitoring but simpler
  console.log('\n\n=== Alternative: Check if backend is in page metadata ===');
  // Look for all script tags with type="module" or modulepreload
  const moduleScripts = pageRes.data.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*>/gi) || [];
  console.log('Module scripts:', moduleScripts);
  
  const preloadChunks = pageRes.data.match(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/gi) || [];
  console.log('Module preloads:', preloadChunks);
}

downloadAndAnalyzeChunks().catch(e => console.error(e.message));
