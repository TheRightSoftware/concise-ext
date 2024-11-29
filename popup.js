const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

document.addEventListener('DOMContentLoaded', async () => {
  const apiKey = await chrome.storage.local.get(['huggingface_api_key', 'form_collapsed']);
  if (apiKey.huggingface_api_key) {
    document.getElementById('apiKey').value = apiKey.huggingface_api_key;
    document.getElementById('summarizeBtn').disabled = false;
    document.getElementById('keyStatus').textContent = '\u2713 Valid';
  }
  
  // Set form state based on stored value
  const section = document.getElementById('apiKeySection');
  if (apiKey.form_collapsed) {
    section.classList.add('collapsed');
    section.classList.remove('expanded');
  } else {
    section.classList.add('expanded');
    section.classList.remove('collapsed');
  }

  // Update click handler to store collapse state
  document.getElementById('apiKeyHeader').addEventListener('click', async () => {
    const section = document.getElementById('apiKeySection');
    const willBeCollapsed = !section.classList.contains('collapsed');
    section.classList.toggle('collapsed');
    section.classList.toggle('expanded');
    await chrome.storage.local.set({ form_collapsed: willBeCollapsed });
  });
});

document.getElementById('saveKeyBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const saveBtn = document.getElementById('saveKeyBtn');
  const keyStatus = document.getElementById('keyStatus');
  
  if (!apiKey) {
    showError('Please enter an API key');
    return;
  }

  saveBtn.textContent = 'Checking...';
  saveBtn.disabled = true;

  try {
    // Test the API key with a small request
    const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: 'Test message',
        parameters: {
          max_length: 50,
          min_length: 10,
        }
      })
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    // If we get here, the key is valid
    await Promise.all([
      chrome.storage.local.set({ huggingface_api_key: apiKey }),
      chrome.storage.local.set({ form_collapsed: true })  // Store collapsed state
    ]);
    
    document.getElementById('summarizeBtn').disabled = false;
    saveBtn.textContent = 'Valid Key Saved!';
    saveBtn.style.backgroundColor = '#059669';
    keyStatus.textContent = '\u2713 Valid';
    
    setTimeout(() => {
      document.getElementById('apiKeySection').classList.add('collapsed');
      document.getElementById('apiKeySection').classList.remove('expanded');
      saveBtn.textContent = 'Save API Key';
      saveBtn.style.backgroundColor = '';
      saveBtn.disabled = false;
    }, 2000);

  } catch (error) {
    keyStatus.textContent = '\u2717 Invalid';
    showError('Invalid API key. Please check your key and try again.');
    saveBtn.textContent = 'Save API Key';
    saveBtn.disabled = false;
  }
});

document.getElementById('summarizeBtn').addEventListener('click', async () => {
  const loadingDiv = document.getElementById('loading');
  const summaryDiv = document.getElementById('summary');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const controls = document.getElementById('controls');
  
  loadingDiv.style.display = 'block';
  summaryDiv.textContent = '';
  summarizeBtn.disabled = true;
  refreshBtn.disabled = true;
  controls.style.display = 'none';

  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check cache first
    const cached = await checkCache(tab.url);
    if (cached) {
      displaySummary(cached);
      return;
    }

    let content;
    try {
      // Try to extract content from page first
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageContent,
      });
      content = result;
    } catch (error) {
      // If page content extraction fails, try clipboard
      content = await getClipboardContent();
      if (!content) {
        throw new Error('Could not access page content. Please copy the text you want to summarize to your clipboard.');
      }
    }

    if (!content || content.length < 50) {
      throw new Error('Not enough content found to summarize. Please ensure there is sufficient text to analyze.');
    }

    // Send to AI for summarization
    const summary = await getSummary(content);
    
    // Cache the result
    await cacheResult(tab.url, summary);
    
    // Display results
    displaySummary(summary);
  } catch (error) {
    showError(error.message || 'Could not summarize the page.');
    console.error(error);
  } finally {
    loadingDiv.style.display = 'none';
    summarizeBtn.disabled = false;
  }
});

document.getElementById('copyBtn').addEventListener('click', async () => {
  const summaryDiv = document.getElementById('summary');
  // Get text without HTML tags for clipboard
  const plainText = summaryDiv.innerText;
  await navigator.clipboard.writeText(plainText);
  const copyBtn = document.getElementById('copyBtn');
  copyBtn.textContent = 'Copied!';
  setTimeout(() => {
    copyBtn.textContent = 'Copy to Clipboard';
  }, 2000);
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const refreshBtn = document.getElementById('refreshBtn');
  const summaryDiv = document.getElementById('summary');
  const controls = document.getElementById('controls');
  
  refreshBtn.classList.add('rotating');
  refreshBtn.disabled = true;
  summaryDiv.textContent = '';
  controls.style.display = 'none';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.storage.local.remove(tab.url);
    
    let content;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageContent,
      });
      content = result;
    } catch (error) {
      content = await getClipboardContent();
      if (!content) {
        throw new Error('Could not access page content. Please copy the text you want to summarize to your clipboard.');
      }
    }

    if (!content || content.length < 50) {
      throw new Error('Not enough content found to summarize. Please ensure there is sufficient text to analyze.');
    }

    const summary = await getSummary(content);
    await cacheResult(tab.url, summary);
    displaySummary(summary);
  } catch (error) {
    showError(error.message || 'Could not refresh the summary.');
    console.error(error);
  } finally {
    refreshBtn.classList.remove('rotating');
    refreshBtn.disabled = false;
  }
});

function extractPageContent() {
  // Remove unwanted elements
  const elementsToRemove = document.querySelectorAll('header, footer, nav, script, style, iframe, [role="complementary"]');
  const tempDoc = document.cloneNode(true);
  elementsToRemove.forEach(el => el.remove());

  // Get main content
  const article = document.querySelector('article') || 
                 document.querySelector('main') || 
                 document.querySelector('.post-content') ||
                 document.querySelector('.entry-content') ||
                 document.body;
                 
  // Remove any remaining scripts, styles, and comments
  const text = article.innerText
    .replace(/\s+/g, ' ')
    .replace(/(<([^>]+)>)/gi, '')
    .trim();
  
  return text;
}

async function getSummary(text) {
  const apiKey = await chrome.storage.local.get('huggingface_api_key');
  if (!apiKey.huggingface_api_key) {
    throw new Error('Please enter your HuggingFace API key first');
  }

  const cleanText = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Adjust max_length to ensure we get enough content for 4+ points
  const contentLength = cleanText.length;
  const maxLength = contentLength > 2000 ? 300 : 
                   contentLength > 1000 ? 250 : 
                   200; // Increased minimum length to get more content

  const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.huggingface_api_key}`
    },
    body: JSON.stringify({
      inputs: cleanText.substring(0, 1024),
      parameters: {
        max_length: maxLength,
        min_length: 100, // Increased from 40 to ensure more content
        do_sample: false,
        num_beams: 4 // Added for better summary quality
      }
    })
  });

  if (!response.ok) {
    throw new Error('API request failed. Please check your API key.');
  }

  const result = await response.json();
  
  if (!result[0]?.summary_text) {
    throw new Error('Invalid API response');
  }
  
  const summary = result[0].summary_text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x00-\x7F]/g, '');
    
  // Split into sentences and ensure meaningful points
  let sentences = summary
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => {
      // Filter for meaningful sentences
      return s.length > 25 && // Longer sentences tend to be more meaningful
             s.split(' ').length >= 5 && // At least 5 words
             !/^(however|therefore|thus|hence|so|but|and|or)$/i.test(s.trim()); // Avoid connector-only sentences
    });

  // If we have too few sentences, try to split longer ones at conjunctions
  if (sentences.length < 4) {
    sentences = summary
      .replace(/([.!?]+)/g, '$1|') // Mark existing sentence boundaries
      .replace(/,\s*(and|but|or|because|however|therefore)\s+/gi, '.|') // Split on conjunctions
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 25 && s.split(' ').length >= 5);
  }

  // Ensure we have at least 4 points if possible
  sentences = sentences.slice(0, Math.max(4, sentences.length));

  // Format with bullet points and highlighting
  return sentences.map(s => {
    s = s.trim();
    // Ensure sentence ends with proper punctuation
    if (!/[.!?]$/.test(s)) {
      s += '.';
    }

    // Highlight important phrases and numbers
    s = s
      // Highlight numbers and percentages
      .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
      // Highlight key phrases
      .replace(/(most important|key|significant|mainly|primarily|essential|crucial|major|notably|specifically|particularly|approximately|estimated|according to|up to|more than|less than)/gi, '<b>$1</b>')
      // Highlight quoted text
      .replace(/"([^"]+)"/g, '"<b>$1</b>"')
      // Highlight text between parentheses
      .replace(/\(([^)]+)\)/g, '(<b>$1</b>)');

    return `\u2022 ${s}`;
  }).join('\n');
}

async function checkCache(url) {
  const cache = await chrome.storage.local.get(url);
  if (cache[url] && (Date.now() - cache[url].timestamp) < CACHE_DURATION) {
    return cache[url].summary;
  }
  return null;
}

async function cacheResult(url, summary) {
  await chrome.storage.local.set({
    [url]: {
      summary,
      timestamp: Date.now()
    }
  });
}

function displaySummary(summary) {
  const summaryDiv = document.getElementById('summary');
  const controls = document.getElementById('controls');
  const refreshBtn = document.getElementById('refreshBtn');
  
  summaryDiv.innerHTML = summary;
  controls.style.display = 'flex';
  refreshBtn.disabled = false;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  
  // Remove any existing error messages
  const existingError = document.querySelector('.error');
  if (existingError) {
    existingError.remove();
  }
  
  // Insert error after the API key section
  const apiKeySection = document.getElementById('apiKeySection');
  apiKeySection.appendChild(errorDiv);
  
  // Remove error after 3 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

// Add this new function to handle clipboard input
async function getClipboardContent() {
  try {
    const text = await navigator.clipboard.readText();
    return text.trim();
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    return null;
  }
} 