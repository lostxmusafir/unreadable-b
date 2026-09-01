import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOADED_BOOK_PATH = path.resolve(__dirname, 'media_1787771007461.html');
const OUTPUT_DIR = path.resolve(__dirname, 'book/the-unreadable/read');

// Make sure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read raw book content
const rawHtml = fs.readFileSync(UPLOADED_BOOK_PATH, 'utf-8');

// Parse chapters
const pageRegex = /<div class="page" id="page-(\d+)"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="page"|<\/div>\s*<\/div>|$)/g;

let match;
const pages = [];

while ((match = pageRegex.exec(rawHtml)) !== null) {
  const pageNum = parseInt(match[1]);
  const content = match[2];
  pages.push({ pageNum, content });
}

console.log(`Parsed ${pages.length} pages.`);

// Group pages by Chapter
const chapters = [];
let currentChapter = null;

pages.forEach((p) => {
  // Check if this page contains a chapter-title or a part-title
  const chapterTitleMatch = p.content.match(/<div class="chapter-title">([^<]+)<\/div>/);
  const partTitleMatch = p.content.match(/<div class="part-title">([^<]+)<\/div>/);
  
  if (chapterTitleMatch) {
    if (currentChapter) {
      chapters.push(currentChapter);
    }
    const fullTitle = chapterTitleMatch[1].trim();
    // Parse "Chapter X: Title" or "Epilogue: Title"
    const numMatch = fullTitle.match(/(Chapter\s+\d+(?:\s+\(cont\))?|Epilogue):/i);
    const titleMatch = fullTitle.match(/:\s*(.+)$/);
    
    let chapterNum;
    if (numMatch) {
      if (numMatch[1].toLowerCase().includes('epilogue')) {
        chapterNum = 'Epilogue';
      } else {
        chapterNum = numMatch[1].replace(/Chapter\s+/i, '');
      }
    } else {
      chapterNum = `Ch ${chapters.length + 1}`;
    }
    
    currentChapter = {
      id: chapters.length + 1,
      chapterNum: chapterNum,
      title: titleMatch ? titleMatch[1] : fullTitle,
      fullTitle: fullTitle,
      pages: [p],
      parts: []
    };
  } else if (partTitleMatch) {
    // If it's a part title page, it can be grouped with the next chapter, but we keep it
    if (currentChapter) {
      chapters.push(currentChapter);
    }
    const partTitle = partTitleMatch[1].trim();
    currentChapter = {
      id: chapters.length + 1,
      chapterNum: `Part`,
      title: partTitle,
      fullTitle: `Part - ${partTitle}`,
      pages: [p],
      parts: [partTitle]
    };
  } else {
    if (currentChapter) {
      currentChapter.pages.push(p);
    } else {
      // Cover page or early pages
      currentChapter = {
        id: 0,
        chapterNum: 'Intro',
        title: 'Introduction',
        fullTitle: 'Introduction',
        pages: [p],
        parts: []
      };
    }
  }
});

if (currentChapter) {
  chapters.push(currentChapter);
}

console.log(`Grouped into ${chapters.length} chapters.`);

// Generate Table of Contents navigation list
const tocItems = chapters.map((ch) => {
  const isPart = ch.chapterNum === 'Part';
  const isEpilogue = ch.chapterNum.toLowerCase() === 'epilogue';
  
  let label;
  if (isPart) {
    label = ch.title;
  } else if (isEpilogue) {
    label = `Epilogue: ${ch.title}`;
  } else {
    label = `Chapter ${ch.chapterNum}: ${ch.title}`;
  }
  
  let dirName;
  if (isPart) {
    dirName = `part-${ch.id}`;
  } else if (isEpilogue) {
    dirName = 'epilogue';
  } else {
    dirName = `chapter-${ch.chapterNum.replace(/\s+/g, '-').toLowerCase()}`;
  }
  
  return {
    id: ch.id,
    label: label,
    url: `/book/the-unreadable/read/${dirName}/`,
    isPart: isPart,
    chapterNum: ch.chapterNum
  };
});

// Template for a Chapter Page
function generateChapterHtml(chapter, index) {
  const isPart = chapter.chapterNum === 'Part';
  const isEpilogue = chapter.chapterNum.toLowerCase() === 'epilogue';
  
  let label;
  if (isPart) {
    label = chapter.title;
  } else if (isEpilogue) {
    label = `Epilogue: ${chapter.title}`;
  } else {
    label = `Chapter ${chapter.chapterNum}: ${chapter.title}`;
  }
  
  let dirName;
  if (isPart) {
    dirName = `part-${chapter.id}`;
  } else if (isEpilogue) {
    dirName = 'epilogue';
  } else {
    dirName = `chapter-${chapter.chapterNum.replace(/\s+/g, '-').toLowerCase()}`;
  }
  
  const prevChapter = index > 0 ? tocItems[index - 1] : null;
  const nextChapter = index < tocItems.length - 1 ? tocItems[index + 1] : null;
  
  const cleanContent = chapter.pages.map(p => {
    // Clean up internal page structure for a fluid reading experience
    let c = p.content;
    c = c.replace(/<div class="page-number[^"]*">[^<]*<\/div>/g, ''); // strip page numbers
    c = c.replace(/<div class="chapter-title">[^<]*<\/div>/g, ''); // strip duplicate title
    c = c.replace(/<div class="part-title"[^>]*>[^<]*<\/div>/g, ''); // strip duplicate part titles
    return `<div class="novel-page-content" data-page="${p.pageNum}">${c}</div>`;
  }).join('\n');

  // Build JSON-LD Breadcrumb
  const breadcrumbJson = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://theunreadablecursed.vercel.app/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Book Overview",
        "item": "https://theunreadablecursed.vercel.app/book/the-unreadable/"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": label,
        "item": `https://theunreadablecursed.vercel.app/book/the-unreadable/read/${dirName}/`
      }
    ]
  };

  // Build JSON-LD Chapter / Book
  const articleJson = {
    "@context": "https://schema.org",
    "@type": "BookSection",
    "name": label,
    "position": index + 1,
    "isPartOf": {
      "@type": "Book",
      "name": "Unreadable Cursed",
      "author": {
        "@type": "Person",
        "name": "Raj Patil",
        "url": "https://rajpatil-port.vercel.app/"
      }
    },
    "description": `Read ${label} of the contemporary novel 'Unreadable Cursed' by Raj Patil. Part of 'The Psychology of Love' creative writing project.`,
    "author": {
      "@type": "Person",
      "name": "Raj Patil",
      "url": "https://rajpatil-port.vercel.app/"
    }
  };

  // Generate TOC links list for Sidebar
  const tocHtmlList = tocItems.map(item => {
    const activeClass = item.id === chapter.id ? 'text-[#d4a574] font-medium border-l-2 border-[#d4a574] pl-2' : 'text-gray-400 hover:text-white hover:pl-1';
    const isPartHeader = item.isPart;
    if (isPartHeader) {
      return `<li class="mt-4 mb-2 text-xs uppercase tracking-wider text-[#d4a574]/60 font-semibold border-b border-white/10 pb-1">${item.label}</li>`;
    }
    return `<li><a href="${item.url}" class="block py-1 text-xs transition-all duration-200 ${activeClass}">${item.label}</a></li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${label} — Unreadable Cursed by Raj Patil</title>
  <meta name="description" content="Read ${label} of Unreadable Cursed by Raj Patil. Part of the contemporary literary project 'The Psychology of Love'. Dedicated chapter page with premium reading controls.">
  <link rel="canonical" href="https://theunreadablecursed.vercel.app/book/the-unreadable/read/${dirName}/">
  
  <!-- GEO & Location Meta Tags -->
  <meta name="geo.region" content="IN-GJ" />
  <meta name="geo.placename" content="Vadodara" />
  <meta name="geo.position" content="22.3072;73.1812" />
  <meta name="ICBM" content="22.3072, 73.1812" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="${label} — Unreadable Cursed by Raj Patil">
  <meta property="og:description" content="Read ${label} of Unreadable Cursed by Raj Patil. Part of the contemporary literary project 'The Psychology of Love'.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://theunreadablecursed.vercel.app/book/the-unreadable/read/${dirName}/">
  <meta property="og:site_name" content="Unreadable Cursed">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${label} — Unreadable Cursed by Raj Patil">
  <meta name="twitter:description" content="Read ${label} of Unreadable Cursed by Raj Patil. Part of the contemporary literary project 'The Psychology of Love'.">
  
  <!-- Typography & Styling -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&family=Cinzel:wght@400..700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  
  <!-- Assets compiled by Vite -->
  <link rel="stylesheet" href="/style.css">
  
  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(breadcrumbJson)}</script>
  <script type="application/ld+json">${JSON.stringify(articleJson)}</script>
</head>
<body class="bg-[#0f0907] text-[#ebdcc5] font-serif transition-colors duration-300 antialiased selection:bg-[#d4a574]/30 selection:text-white" id="reading-body">

  <!-- Header / Nav -->
  <header class="fixed top-0 left-0 w-full bg-black/80 backdrop-blur-md border-b border-white/5 py-4 px-6 flex items-center justify-between z-30 transition-all duration-300" id="reader-header">
    <div class="flex items-center space-x-4">
      <button id="toc-toggle" class="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none" aria-label="Toggle Table of Contents">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      <a href="/" class="font-sans font-semibold tracking-wider text-xs text-[#d4a574] hover:text-white uppercase transition-colors">
        unr34d4bl3 curs3d
      </a>
    </div>
    
    <div class="flex items-center space-x-6">
      <div class="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-full px-3 py-1 font-sans text-[10px]">
        <button id="font-dec" class="hover:text-[#d4a574] transition-colors font-medium">A-</button>
        <span class="w-px h-3 bg-white/20"></span>
        <button id="font-inc" class="hover:text-[#d4a574] transition-colors font-medium">A+</button>
      </div>
      <button id="theme-toggle" class="text-gray-400 hover:text-[#d4a574] transition-colors" aria-label="Toggle Theme">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 block dark-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      </button>
      <a href="/book/the-unreadable/" class="font-sans text-[10px] tracking-wider text-gray-400 hover:text-white uppercase border border-white/20 rounded px-2.5 py-1 transition-all hover:border-[#d4a574]">
        Overview
      </a>
    </div>
  </header>

  <!-- Reading Progress Bar -->
  <div class="fixed top-[53px] left-0 w-full h-[2px] bg-white/5 z-30">
    <div class="h-full bg-[#d4a574] w-0 transition-all duration-150" id="reading-progress"></div>
  </div>

  <!-- Sidebar Table of Contents -->
  <aside id="toc-sidebar" class="fixed top-0 left-0 h-screen w-80 bg-[#0c0705] border-r border-white/10 z-40 transform -translate-x-full transition-transform duration-300 ease-in-out flex flex-col pt-20">
    <div class="flex items-center justify-between px-6 pb-4 border-b border-white/5">
      <span class="font-sans font-semibold text-xs uppercase tracking-wider text-white">Table of Contents</span>
      <button id="toc-close" class="text-gray-400 hover:text-[#d4a574] transition-colors focus:outline-none" aria-label="Close Table of Contents">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <ul class="flex-1 overflow-y-auto px-6 py-4 space-y-1 scrollbar-thin">
      ${tocHtmlList}
    </ul>
  </aside>
  <!-- Sidebar Backdrop -->
  <div id="toc-backdrop" class="fixed inset-0 bg-black/60 opacity-0 pointer-events-none transition-opacity duration-300 z-35"></div>

  <!-- Main Content Layout -->
  <main class="max-w-2xl mx-auto px-6 pt-32 pb-24 font-serif text-lg leading-relaxed text-justify space-y-8 select-text">
    
    <!-- Chapter Header -->
    <div class="text-center mb-16 space-y-4">
      ${isPart ? '' : (isEpilogue ? `<span class="font-sans font-semibold text-[10px] text-[#d4a574] uppercase tracking-[0.25em]">Epilogue</span>` : `<span class="font-sans font-semibold text-[10px] text-[#d4a574] uppercase tracking-[0.25em]">Chapter ${chapter.chapterNum}</span>`)}
      <h1 class="font-cinzel text-3xl md:text-4xl text-white font-medium leading-tight">${chapter.title}</h1>
      <div class="flex items-center justify-center">
        <div class="w-16 h-px bg-[#d4a574]/40"></div>
        <span class="mx-3 text-xs text-[#d4a574]/60">✦</span>
        <div class="w-16 h-px bg-[#d4a574]/40"></div>
      </div>
    </div>

    <!-- Chapter Body Text -->
    <article class="novel-text-container space-y-6" id="novel-reader-body">
      ${cleanContent}
    </article>

    <!-- Chapter Footer Navigation -->
    <div class="pt-16 border-t border-white/10 flex flex-col md:flex-row justify-between gap-6 font-sans text-xs select-none">
      <div>
        ${prevChapter ? `
          <span class="block text-gray-500 uppercase tracking-widest text-[9px] mb-1">Previous</span>
          <a href="${prevChapter.url}" class="text-[#ebdcc5] hover:text-[#d4a574] transition-colors font-medium flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            ${prevChapter.label}
          </a>
        ` : ''}
      </div>
      
      <div class="text-right">
        ${nextChapter ? `
          <span class="block text-gray-500 uppercase tracking-widest text-[9px] mb-1">Next</span>
          <a href="${nextChapter.url}" class="text-[#ebdcc5] hover:text-[#d4a574] transition-colors font-medium flex items-center gap-1 justify-end">
            ${nextChapter.label}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        ` : `
          <span class="block text-gray-500 uppercase tracking-widest text-[9px] mb-1">The End</span>
          <a href="/book/the-unreadable/" class="text-[#d4a574] hover:text-white transition-colors font-medium">
            Return to Book Overview
          </a>
        `}
      </div>
    </div>
  </main>

  <!-- Interactive Controls Script -->
  <script>
    const body = document.getElementById('reading-body');
    const header = document.getElementById('reader-header');
    const tocSidebar = document.getElementById('toc-sidebar');
    const tocBackdrop = document.getElementById('toc-backdrop');
    
    // Sidebar Controls
    document.getElementById('toc-toggle').addEventListener('click', () => {
      tocSidebar.classList.remove('-translate-x-full');
      tocBackdrop.classList.remove('opacity-0', 'pointer-events-none');
    });
    
    const closeTOC = () => {
      tocSidebar.classList.add('-translate-x-full');
      tocBackdrop.classList.add('opacity-0', 'pointer-events-none');
    };
    document.getElementById('toc-close').addEventListener('click', closeTOC);
    tocBackdrop.addEventListener('click', closeTOC);

    // Font Adjustment
    const content = document.getElementById('novel-reader-body');
    let currentSize = parseFloat(localStorage.getItem('reading-font-size')) || 1.125; // in rem
    content.style.fontSize = currentSize + 'rem';
    
    document.getElementById('font-dec').addEventListener('click', () => {
      if (currentSize > 0.9) {
        currentSize -= 0.05;
        content.style.fontSize = currentSize + 'rem';
        localStorage.setItem('reading-font-size', currentSize);
      }
    });
    
    document.getElementById('font-inc').addEventListener('click', () => {
      if (currentSize < 1.6) {
        currentSize += 0.05;
        content.style.fontSize = currentSize + 'rem';
        localStorage.setItem('reading-font-size', currentSize);
      }
    });

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const setDarkTheme = (isDark) => {
      if (isDark) {
        body.classList.remove('bg-[#f5f1e8]', 'text-[#1c120c]');
        body.classList.add('bg-[#0f0907]', 'text-[#ebdcc5]');
        header.classList.remove('bg-[#f5f1e8]/90', 'border-black/5');
        header.classList.add('bg-black/80', 'border-white/5');
        localStorage.setItem('reading-theme', 'dark');
      } else {
        body.classList.remove('bg-[#0f0907]', 'text-[#ebdcc5]');
        body.classList.add('bg-[#f5f1e8]', 'text-[#1c120c]');
        header.classList.remove('bg-black/80', 'border-white/5');
        header.classList.add('bg-[#f5f1e8]/90', 'border-black/5');
        localStorage.setItem('reading-theme', 'light');
      }
    };
    
    // Init theme
    const savedTheme = localStorage.getItem('reading-theme') || 'dark';
    setDarkTheme(savedTheme === 'dark');
    
    themeToggle.addEventListener('click', () => {
      const isDark = body.classList.contains('bg-[#0f0907]');
      setDarkTheme(!isDark);
    });

    // Scroll Progress
    const progressBar = document.getElementById('reading-progress');
    window.addEventListener('scroll', () => {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      progressBar.style.width = scrolled + '%';
    });

    // Hide Header on Scroll Down, Show on Scroll Up
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      if (currentScroll > lastScroll && currentScroll > 80) {
        header.style.transform = 'translateY(-100%)';
      } else {
        header.style.transform = 'translateY(0)';
      }
      lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    });
  </script>
</body>
</html>`;
}

// Generate all chapter HTML files
chapters.forEach((ch, idx) => {
  const isPart = ch.chapterNum === 'Part';
  const isEpilogue = ch.chapterNum.toLowerCase() === 'epilogue';
  
  let dirName;
  if (isPart) {
    dirName = `part-${ch.id}`;
  } else if (isEpilogue) {
    dirName = 'epilogue';
  } else {
    dirName = `chapter-${ch.chapterNum.replace(/\s+/g, '-').toLowerCase()}`;
  }
  const chDir = path.resolve(OUTPUT_DIR, dirName);
  
  if (!fs.existsSync(chDir)) {
    fs.mkdirSync(chDir, { recursive: true });
  }
  
  const chHtml = generateChapterHtml(ch, idx);
  fs.writeFileSync(path.resolve(chDir, 'index.html'), chHtml);
  console.log(`Generated: ${dirName}/index.html`);
});

// Overwrite TOC in book overview index.html
const bookIndexFile = path.resolve(__dirname, 'book/the-unreadable/index.html');
if (fs.existsSync(bookIndexFile)) {
  let bookIndexHtml = fs.readFileSync(bookIndexFile, 'utf-8');
  const tocListHtml = tocItems.map(item => {
    if (item.isPart) {
      return `<li class="col-span-full mt-6 mb-2 text-[#d4a574] font-semibold uppercase tracking-wider text-[10px] border-b border-white/10 pb-1">${item.label}</li>`;
    }
    return `<li><a href="${item.url}" class="block py-1.5 hover:text-[#d4a574] transition-colors text-gray-400 text-xs">${item.label}</a></li>`;
  }).join('\n');
  
  bookIndexHtml = bookIndexHtml.replace('<!-- TOC_LIST -->', tocListHtml);
  fs.writeFileSync(bookIndexFile, bookIndexHtml);
  console.log('Injected TOC into book/the-unreadable/index.html');
}

// Generate sitemap.xml dynamically
const sitemapFile = path.resolve(__dirname, 'public/sitemap.xml');
const sitemapDir = path.dirname(sitemapFile);
if (!fs.existsSync(sitemapDir)) {
  fs.mkdirSync(sitemapDir, { recursive: true });
}

const sitemapUrls = [
  'https://theunreadablecursed.vercel.app/',
  'https://theunreadablecursed.vercel.app/author/raj-patil/',
  'https://theunreadablecursed.vercel.app/book/the-unreadable/',
  'https://theunreadablecursed.vercel.app/context/amrita-pritam/',
  'https://theunreadablecursed.vercel.app/context/sahir-ludhianvi/',
  'https://theunreadablecursed.vercel.app/context/imroz/'
];

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>2026-08-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${url.endsWith('/') && !url.includes('/read/') ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync(sitemapFile, sitemapContent);
console.log('Generated public/sitemap.xml successfully!');

console.log('Chapters generation complete!');
