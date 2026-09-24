'use strict';
// =====================================================================
//  SimpleCMS editor (Chrome extension build).
//  Manifest V3 pages run under CSP "script-src 'self'", so there is no
//  inline code anywhere: buttons carry data-action="..." and one delegated
//  listener dispatches them. This file and lib/jszip.min.js are removed
//  from the exported site.
// =====================================================================
const $ = id => document.getElementById(id);
const canvas = $('main-canvas');
const panel = $('admin-panel');

// Neutral inline placeholder (no external service, works offline)
const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">' +
    '<rect width="600" height="400" fill="#e4e4e4"/>' +
    '<circle cx="220" cy="150" r="36" fill="#c9c9c9"/>' +
    '<path d="M120 320 L260 190 L350 270 L410 220 L500 320 Z" fill="#c9c9c9"/></svg>');

// Bundled with the extension and copied into every exported site
const FONT_FILES = ['inter-latin-400-normal.woff2', 'inter-latin-600-normal.woff2', 'inter-latin-700-normal.woff2',
    'playfair-display-latin-700-normal.woff2', 'OFL-Inter.txt', 'OFL-PlayfairDisplay.txt'];

// ---------- helpers ----------
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const slugify = s => (s || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const safeName = n => n.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sections = () => [...canvas.querySelectorAll(':scope > section')];
const serialize = root => '<!DOCTYPE html>\n' + root.outerHTML;
// Copy the page into an inert document: nothing in it loads or runs (so rewriting
// image paths for the export doesn't make the browser go fetch them)
const inertClone = () => document.implementation.createHTMLDocument('').importNode(document.documentElement, true);

// Prompt for a section name -> safe, unique id (or null if cancelled/invalid)
function askSlug(msg, current) {
    const raw = prompt(msg, current || '');
    if (raw === null) return null;
    let s = slugify(raw);
    if (!s) { alert('Use letters, numbers, spaces or dashes.'); return null; }
    if (/^[0-9]/.test(s)) s = 's-' + s;
    if (s !== current && document.getElementById(s)) { alert(`"${s}" is already in use. Pick another name.`); return null; }
    return s;
}

function pickFile(accept, cb) {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.addEventListener('change', () => { if (i.files[0]) cb(i.files[0]); });
    i.click();
}
function pickImage(cb) {
    pickFile('image/*', f => {
        const r = new FileReader();
        r.onload = () => cb(r.result, f.name);
        r.readAsDataURL(f);
    });
}

function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- panel view prefs (workspace settings, not site content) ----------
const PREFS_KEY = 'simplecms-panel';
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* not fatal */ } };

// ---------- panel / preview ----------
const isOpen = () => panel.classList.contains('open');
const isDocked = () => prefs.dock && matchMedia('(min-width: 900px)').matches;

function setPanel(open) {
    panel.classList.toggle('open', open);
    document.body.classList.toggle('admin-open', open);
    document.body.classList.toggle('admin-docked', open && !!prefs.dock);
    $('toggle-admin').setAttribute('aria-expanded', open);
    if (open) refreshUI();
}
function toggleAdmin(e) { if (e) e.stopPropagation(); setPanel(!isOpen()); }

// Click off the panel closes it (unless docked, where you're meant to work beside it)
document.addEventListener('mousedown', (e) => {
    if (!isOpen() || isDocked()) return;
    if (panel.contains(e.target) || e.target.closest('#toggle-admin') || e.target.closest('#html-editor')) return;
    setPanel(false);
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen() && $('html-editor').hidden) setPanel(false);
});

function setPanelAlpha(v) {
    panel.style.setProperty('--panel-alpha', v / 100);
    $('panel-alpha').value = v;
    $('panel-alpha-val').textContent = v + '%';
    prefs.alpha = +v; savePrefs();
}
function setDock(on) {
    prefs.dock = !!on; savePrefs();
    $('panel-dock').checked = !!on;
    document.body.classList.toggle('admin-docked', !!on && isOpen());
}
function togglePreview() {
    const editing = document.body.classList.toggle('edit-mode');
    $('preview-btn').textContent = editing ? '👁 Preview' : '✏️ Back to Editing';
}

// ---------- widgets ----------
const DEL_BTN = '<button type="button" class="edit-only item-del" title="Remove image">×</button>';
const galleryItem = title => `<div class="gallery-item">${DEL_BTN}<img src="${PLACEHOLDER}" alt=""><h4 contenteditable="true">${title}</h4><p contenteditable="true">Description...</p></div>`;

const widgetTemplates = {
    gallery: (id) => `<div class="widget-wrapper" id="${id}"><div class="gallery-grid">${galleryItem('Before')}${galleryItem('After')}</div></div>`,
    contact: (id) => `<div class="widget-wrapper" id="${id}"><h2 style="text-align:center" contenteditable="true">Get a Quote / Contact Us</h2><form class="contact-form"><input type="text" name="name" placeholder="Name"><input type="email" name="email" placeholder="Email"><textarea name="details" rows="5" placeholder="Details"></textarea><button type="button">Send</button></form></div>`,
    text: (id) => `<div class="widget-wrapper" id="${id}"><h2 contenteditable="true">Section Title</h2><p contenteditable="true" style="font-size:1.1rem;">Click here to edit your content. This is your default text widget.</p></div>`,
    table: (id) => `<div class="widget-wrapper" id="${id}"><table class="data-table"><thead contenteditable="true"><tr><th>Service</th><th>Price</th></tr></thead><tbody contenteditable="true"><tr><td>Weekly Mowing</td><td>$45+</td></tr></tbody></table></div>`,
    code: (id) => `<div class="widget-wrapper" id="${id}"><div style="background:#111; color:#0f0; padding:15px; font-family:monospace; border-radius:5px;" contenteditable="true"></div></div>`,
    html: (id) => `<div class="widget-wrapper" id="${id}"><div class="html-slot"><p><em>Custom HTML block</em></p></div></div>`
};
const WIDGETS = [['gallery', 'gall'], ['contact', 'cont'], ['text', 'text'], ['table', 'tabl'], ['code', 'code'], ['html', 'html']];

function addSection() {
    const id = askSlug('Section name:');
    if (!id) return;
    const s = document.createElement('section'); s.id = id;
    s.innerHTML = widgetTemplates.text(uid('text'));   // auto-add a text widget
    canvas.appendChild(s);
    refreshUI();
}

function addWidget(secId) {
    const t = prompt('[1] Gallery [2] Contact [3] Text [4] Table [5] Code [6] HTML');
    const w = WIDGETS[parseInt(t, 10) - 1];
    if (!w) return;
    $(secId).insertAdjacentHTML('beforeend', widgetTemplates[w[0]](uid(w[1])));
    refreshUI();
}

function addGalleryItem(wId) {
    $(wId).querySelector('.gallery-grid').insertAdjacentHTML('beforeend', galleryItem('Title'));
}

// Gallery clicks: one delegated listener, only active while editing
canvas.addEventListener('click', e => {
    if (!document.body.classList.contains('edit-mode')) return;
    const del = e.target.closest('.item-del');
    if (del) { if (confirm('Remove this image?')) del.closest('.gallery-item').remove(); return; }
    if (e.target.matches('.gallery-item img')) {
        const img = e.target;
        pickImage((src, name) => { img.src = src; img.dataset.file = safeName(name); });
    }
});
// Never let a contact form navigate away from the editor
canvas.addEventListener('submit', e => e.preventDefault());

// Contact form destination: email (mailto) or a form-service URL
function setFormTarget(wId) {
    const form = $(wId).querySelector('.contact-form');
    const v = prompt('Where should messages go?\nEnter an email address, or a form service URL (https://...).\nLeave blank to turn sending off.', form.dataset.target || '');
    if (v === null) return;
    const t = v.trim(), btn = form.querySelector('button');
    if (t && !/^https:\/\//i.test(t) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) { alert('Enter an email address or an https:// URL.'); return; }
    ['action', 'method', 'enctype', 'data-target'].forEach(a => form.removeAttribute(a));
    btn.type = 'button';
    if (t) {
        if (/^https:\/\//i.test(t)) { form.setAttribute('action', t); }
        else { form.setAttribute('action', 'mailto:' + t); form.setAttribute('enctype', 'text/plain'); }
        form.setAttribute('method', 'post');
        form.dataset.target = t;
        btn.type = 'submit';
    }
    refreshUI();
}

// HTML widget editor (real HTML, not contenteditable text).
// Scripts in here don't run inside the editor (extension CSP); they do run on the exported site.
let htmlTarget = null;
function openHtmlEditor(wId) {
    const w = $(wId);
    htmlTarget = w.querySelector('.html-slot') || w.firstElementChild || w;
    $('html-editor-text').value = htmlTarget.innerHTML.trim();
    $('html-editor').hidden = false;
    $('html-editor-text').focus();
}
function closeHtmlEditor(apply) {
    if (apply && htmlTarget) {
        htmlTarget.innerHTML = $('html-editor-text').value;
        if (!htmlTarget.classList.contains('widget-wrapper')) {
            htmlTarget.removeAttribute('contenteditable');
            htmlTarget.classList.add('html-slot');
        }
    }
    $('html-editor').hidden = true;
    htmlTarget = null;
}

// Bring content from older versions of the editor up to date
function upgradeLegacy() {
    canvas.querySelectorAll('img[onclick^="handleImg"]').forEach(img => img.removeAttribute('onclick'));
    canvas.querySelectorAll('img[src*="via.placeholder.com"]').forEach(img => img.src = PLACEHOLDER);
    canvas.querySelectorAll('.gallery-item').forEach(item => {
        if (!item.querySelector('.item-del')) item.insertAdjacentHTML('afterbegin', DEL_BTN);
    });
}

// ---------- builder menu ----------
const btn = (action, label, data = {}, extra = '') =>
    `<button class="admin-btn" data-action="${action}"${Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}${extra}>${label}</button>`;

function refreshUI() {
    const nav = $('main-nav');
    const manager = $('hierarchy-manager');
    upgradeLegacy();
    const secs = sections();
    const visible = secs.filter(s => !s.classList.contains('hidden-item'));

    nav.innerHTML = visible.map(s => `<li><a href="#${esc(s.id)}">${esc(s.id.replace(/-/g, ' '))}</a></li>`).join('');
    if (visible[0]) $('logo-target').setAttribute('href', '#' + visible[0].id);

    manager.innerHTML = secs.map((sec, sIdx) => {
        const widgets = [...sec.querySelectorAll(':scope > .widget-wrapper')].map((w, wIdx) => {
            let extra = '';
            const form = w.querySelector('.contact-form');
            if (w.querySelector('.gallery-grid')) extra = btn('addGalleryItem', '+Img', { id: w.id }, ' title="Add an image"');
            else if (form) extra = btn('setFormTarget', '✉', { id: w.id }, ` title="${esc('Where messages go' + (form.dataset.target ? ': ' + form.dataset.target : ' (not set)'))}"`);
            else if (w.id.startsWith('html-')) extra = btn('openHtmlEditor', '&lt;/&gt;', { id: w.id }, ' title="Edit HTML"');
            return `<div class="widget-row">
                <span>${esc(w.id)}</span>
                <div style="display:flex; gap:2px;">
                    ${extra}
                    ${btn('moveSubItem', '↑', { sec: sec.id, idx: wIdx, dir: -1 })}
                    ${btn('moveSubItem', '↓', { sec: sec.id, idx: wIdx, dir: 1 })}
                    ${btn('toggleH', w.classList.contains('hidden-item') ? '👁️' : '🚫', { id: w.id })}
                    ${btn('delH', 'X', { id: w.id }, ' style="color:#ff8888"')}
                </div>
            </div>`;
        }).join('');

        return `<div class="section-block"><div style="display:flex; justify-content:space-between;"><b>Section: ${esc(sec.id)}</b></div>
            <div class="btn-row">
                ${btn('moveItem', '↑', { idx: sIdx, dir: -1 })}
                ${btn('moveItem', '↓', { idx: sIdx, dir: 1 })}
                ${btn('toggleH', sec.classList.contains('hidden-item') ? 'Unhide' : 'Hide', { id: sec.id })}
                ${btn('renameSection', 'Mod', { id: sec.id })}
                ${btn('delH', 'Del', { id: sec.id }, ' style="background:#d9534f"')}
            </div>
            ${btn('addWidget', '+ Add Widget', { id: sec.id }).replace('class="admin-btn"', 'class="admin-btn primary-btn"')}${widgets}</div>`;
    }).join('');
}

function renameSection(oldId) {
    const n = askSlug('New section name:', oldId);
    if (!n || n === oldId) return;
    $(oldId).id = n;
    refreshUI();
}
function moveItem(idx, dir) {
    const c = sections(), j = idx + dir;
    if (j < 0 || j >= c.length) return;
    if (dir === 1) canvas.insertBefore(c[j], c[idx]); else canvas.insertBefore(c[idx], c[j]);
    refreshUI();
}
function moveSubItem(secId, idx, dir) {
    const p = $(secId);
    const c = [...p.querySelectorAll(':scope > .widget-wrapper')], j = idx + dir;
    if (j < 0 || j >= c.length) return;
    if (dir === 1) p.insertBefore(c[j], c[idx]); else p.insertBefore(c[idx], c[j]);
    refreshUI();
}
function toggleH(id) { $(id).classList.toggle('hidden-item'); refreshUI(); }
function delH(id) { if (confirm('Delete?')) { $(id).remove(); refreshUI(); } }
function updateSEO() {
    document.title = $('seo-title-input').value;
    $('meta-description').setAttribute('content', $('seo-desc-input').value);
    scheduleSave();
}
function handleLogo() {
    pickImage((src, name) => {
        const logo = $('logo-target');
        const alt = logo.textContent.trim() || 'Home';
        const img = document.createElement('img');
        img.src = src; img.alt = alt; img.dataset.file = 'logo-' + safeName(name);
        logo.innerHTML = ''; logo.appendChild(img);
    });
}
function resetLogo() {
    const n = prompt('Logo text:', 'SimpleCMS');
    if (n === null) return;
    $('logo-target').textContent = n.trim() || 'SimpleCMS';
}
function updateTheme() {
    document.documentElement.style.setProperty('--primary', $('color-picker').value);
    document.body.style.fontFamily = $('font-picker').value;
    scheduleSave();
}

function syncControls() {
    $('seo-title-input').value = document.title;
    $('seo-desc-input').value = $('meta-description').getAttribute('content');
    const primary = document.documentElement.style.getPropertyValue('--primary').trim();
    $('color-picker').value = /^#[0-9a-f]{6}$/i.test(primary) ? primary : '#2d5a27';
    const norm = s => (s || '').replace(/["'\s]/g, '');
    const fp = $('font-picker');
    fp.selectedIndex = 0;
    [...fp.options].forEach(o => { if (norm(o.value) === norm(document.body.style.fontFamily)) fp.value = o.value; });
}

// ---------- project state: open / reset / save ----------
const STARTER = {
    canvas: '<section id="home"><div class="widget-wrapper" id="hero-main"><h1 contenteditable="true" style="text-align:center; font-size: 4rem;">SimpleCMS, simply simple.</h1><p contenteditable="true" style="text-align:center; max-width: 700px; margin: 0 auto;">Laid back ready when you are.</p></div></section>',
    footer: '<p contenteditable="true">thisguy@simplecms | CITY, STATE</p>',
    logo: 'SimpleCMS',
    title: 'SimpleCMS | Simply simple.',
    desc: 'SimpleCMS - Simple Local CMS from the Browser',
    primary: '', font: ''
};

function stateFromDoc(doc) {
    const meta = doc.getElementById('meta-description') || doc.querySelector('meta[name="description"]');
    return {
        canvas: doc.getElementById('main-canvas').innerHTML,
        footer: doc.querySelector('footer') ? doc.querySelector('footer').innerHTML : STARTER.footer,
        logo: doc.getElementById('logo-target') ? doc.getElementById('logo-target').innerHTML : STARTER.logo,
        title: doc.title,
        desc: meta ? meta.getAttribute('content') : '',
        primary: doc.documentElement.style.getPropertyValue('--primary').trim(),
        font: doc.body ? doc.body.style.fontFamily : ''
    };
}

// Replace the page with a state object
function applyState(st) {
    canvas.innerHTML = st.canvas;
    document.querySelector('footer').innerHTML = st.footer;
    $('logo-target').innerHTML = st.logo || 'SimpleCMS';
    document.title = st.title || '';
    $('meta-description').setAttribute('content', st.desc || '');
    if (st.primary) document.documentElement.style.setProperty('--primary', st.primary);
    else document.documentElement.style.removeProperty('--primary');
    document.body.style.fontFamily = st.font || '';
    prepareImported();
    syncControls();
    refreshUI();
    scheduleSave();
}

function resetSite() {
    if (!confirm('Start over with the starter page?\n\nThis clears all sections, images and settings on the page, including the autosave. Use Save Project first if you might want this version back.')) return;
    applyState(STARTER);
}

// Opened content: drop inline event handlers, restore editing hooks that export removed
function prepareImported() {
    // Inline handlers are stripped everywhere except inside HTML widgets, where you put code on purpose.
    // (The extension's CSP already stops them from running in the editor; they run on the exported site.)
    [canvas, document.querySelector('footer'), $('logo-target')].forEach(z => z.querySelectorAll('*').forEach(el => {
        if (el.closest('.html-slot')) return;
        [...el.attributes].forEach(a => { if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
    }));
    canvas.querySelectorAll('script').forEach(sc => { if (!sc.closest('.html-slot')) sc.remove(); });
    canvas.querySelectorAll('.widget-wrapper[id^="html-"] > div:first-child').forEach(d => d.classList.add('html-slot'));
    canvas.querySelectorAll('h1, h2, h3, h4, h5, h6, p, thead, tbody, .widget-wrapper[id^="code-"] > div').forEach(el => {
        if (el.closest('.html-slot, form')) return;
        if (el.parentElement.closest('[contenteditable]')) return;
        el.setAttribute('contenteditable', 'true');
    });
    document.querySelectorAll('footer p').forEach(p => p.setAttribute('contenteditable', 'true'));
    $('logo-target').setAttribute('contenteditable', 'true');
    canvas.querySelectorAll('form.contact-form[action]').forEach(f => {
        if (!f.dataset.target) f.dataset.target = f.getAttribute('action').replace(/^mailto:/i, '');
    });
}

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif' };

// Open: project file, exported .zip or index.html, or a file saved from the single-file editor
function importSite() {
    pickFile('.html,.htm,.zip', async f => {
        try {
            let htmlText, zip = null, base = '';
            if (/\.zip$/i.test(f.name)) {
                zip = await JSZip.loadAsync(f);
                const entry = Object.values(zip.files).filter(z => !z.dir && /(^|\/)index\.html?$/i.test(z.name))
                    .sort((a, b) => a.name.length - b.name.length)[0];
                if (!entry) { alert('No index.html found in that zip.'); return; }
                base = entry.name.replace(/[^/]*$/, '');
                htmlText = await entry.async('string');
            } else {
                htmlText = await f.text();
            }

            const doc = new DOMParser().parseFromString(htmlText, 'text/html');
            if (!doc.getElementById('main-canvas')) { alert("That file doesn't look like a SimpleCMS page (no main canvas found)."); return; }
            if (!confirm(`Replace the current page with "${f.name}"?\n\nThe current page and its autosave will be replaced.`)) return;

            // Pull zipped images back in as embedded data, remembering their filenames
            let missing = 0;
            for (const img of doc.querySelectorAll('#main-canvas img, #logo-target img')) {
                const p = img.getAttribute('src') || '';
                if (/^(data:|https?:|\/\/)/i.test(p)) continue;
                if (!zip) { if (p) missing++; continue; }
                const path = (base + p).replace(/^\.\//, '').replace(/\/\.\//g, '/');
                const file = zip.file(decodeURIComponent(path)) || zip.file(path);
                if (!file) { missing++; continue; }
                const ext = (path.split('.').pop() || '').toLowerCase();
                img.setAttribute('src', `data:${MIME[ext] || 'application/octet-stream'};base64,` + await file.async('base64'));
                img.dataset.file = path.split('/').pop();
            }

            applyState(stateFromDoc(doc));
            if (missing) alert(`${missing} image(s) point to files that weren't included. Open the exported .zip instead to bring images along, or re-add them by clicking each image.`);
        } catch (err) {
            alert('Could not open that file: ' + err.message);
        }
    });
}

// Project = the page with all editing info (hidden items, embedded images), minus the editor UI
function buildProjectClone() {
    const clone = inertClone();
    clone.querySelectorAll('#admin-panel, #toggle-admin, #admin-script, #jszip-lib, #editor-favicon, #html-editor')
        .forEach(el => el.remove());
    clone.querySelector('body').className = '';
    return clone;
}
function saveProject() {
    refreshUI();
    const name = (slugify(document.title.split('|')[0]) || 'simplecms') + '_project.html';
    download(new Blob([serialize(buildProjectClone())], { type: 'text/html' }), name);
    setStatus('Project file downloaded');
}

// ---------- export ----------
// Build the public page: no editor UI, no editor script, nothing editable
function buildSiteClone() {
    refreshUI();
    const clone = inertClone();
    clone.querySelectorAll('#admin-panel, #toggle-admin, #admin-script, #jszip-lib, #editor-favicon, .edit-only, .hidden-item')
        .forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    clone.querySelectorAll('[onclick^="handleImg"]').forEach(el => el.removeAttribute('onclick'));
    clone.querySelectorAll('form[data-target]').forEach(f => f.removeAttribute('data-target'));
    clone.querySelectorAll('.gallery-item img').forEach(img => {        // alt text from the caption
        if (!img.getAttribute('alt')) {
            const cap = img.parentElement.querySelector('h4');
            img.setAttribute('alt', cap ? cap.textContent.trim() : '');
        }
    });
    clone.querySelector('body').className = '';
    return clone;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' };
function uniqueName(name, used, fallbackExt) {
    const m = name.match(/^(.*?)(?:\.([a-z0-9]+))?$/i);
    const base = m[1] || 'image', ext = (m[2] || fallbackExt).toLowerCase();
    let cand = `${base}.${ext}`, i = 2;
    while (used.has(cand)) cand = `${base}-${i++}.${ext}`;
    used.add(cand);
    return cand;
}

// Export index.html + images/ + fonts/ as a zip
async function exportFinal() {
    const clone = buildSiteClone();
    const zip = new JSZip(), dir = zip.folder('images');
    const bySrc = new Map(), used = new Set();
    let n = 0;
    clone.querySelectorAll('img[src^="data:"]').forEach(img => {
        const src = img.getAttribute('src');
        let name = bySrc.get(src);                      // same picture used twice -> one file
        if (!name) {
            const comma = src.indexOf(',');
            const meta = src.slice(5, comma), data = src.slice(comma + 1);
            const mime = meta.split(';')[0];
            name = uniqueName(img.dataset.file || `image-${++n}`, used, EXT[mime] || 'img');
            if (meta.includes(';base64')) dir.file(name, data, { base64: true });
            else dir.file(name, decodeURIComponent(data));
            bySrc.set(src, name);
        }
        img.setAttribute('src', 'images/' + name);       // relative path: works in subfolders and file://
    });
    clone.querySelectorAll('[data-file]').forEach(el => el.removeAttribute('data-file'));

    // Self-hosted fonts: the site makes no third-party requests
    const fonts = zip.folder('fonts');
    await Promise.all(FONT_FILES.map(async f => {
        try { const r = await fetch('fonts/' + f); if (r.ok) fonts.file(f, await r.arrayBuffer()); } catch { /* skip */ }
    }));

    zip.file('index.html', serialize(clone));
    download(await zip.generateAsync({ type: 'blob' }), 'simplecms_site.zip');
    setStatus('Site exported');
}

// ---------- autosave (IndexedDB: roomy enough for embedded images) ----------
const db = (() => {
    let open;
    const get = () => open || (open = new Promise((res, rej) => {
        const r = indexedDB.open('simplecms', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
    const run = (mode, fn) => get().then(d => new Promise((res, rej) => {
        const t = d.transaction('kv', mode), req = fn(t.objectStore('kv'));
        t.oncomplete = () => res(req.result);
        t.onerror = () => rej(t.error);
    }));
    return { get: k => run('readonly', s => s.get(k)), set: (k, v) => run('readwrite', s => s.put(v, k)) };
})();

function setStatus(msg) {
    const t = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('save-status').textContent = `${msg} · ${t}`;
}

let saveTimer = null, autosaveReady = false;
function scheduleSave() {
    if (!autosaveReady) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        try { await db.set('autosave', serialize(buildProjectClone())); setStatus('Autosaved'); }
        catch (err) { $('save-status').textContent = 'Autosave failed: ' + err.message + ' (use Save Project)'; }
    }, 800);
}
// Watch only the site content (not the panel, or the status line would retrigger saves forever)
const watch = new MutationObserver(scheduleSave);
[canvas, document.querySelector('footer'), $('logo-target')].forEach(node => watch.observe(node, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['src', 'class', 'id', 'action', 'style', 'data-target', 'data-file', 'contenteditable']
}));

// ---------- wiring (no inline handlers under MV3) ----------
const ACTIONS = {
    toggleAdmin: (el, e) => toggleAdmin(e),
    uploadLogo: () => handleLogo(), resetLogo: () => resetLogo(),
    addSection: () => addSection(), importSite: () => importSite(), saveProject: () => saveProject(),
    resetSite: () => resetSite(), togglePreview: () => togglePreview(), exportFinal: () => exportFinal(),
    moveItem: el => moveItem(+el.dataset.idx, +el.dataset.dir),
    moveSubItem: el => moveSubItem(el.dataset.sec, +el.dataset.idx, +el.dataset.dir),
    toggleH: el => toggleH(el.dataset.id), delH: el => delH(el.dataset.id),
    renameSection: el => renameSection(el.dataset.id), addWidget: el => addWidget(el.dataset.id),
    addGalleryItem: el => addGalleryItem(el.dataset.id), setFormTarget: el => setFormTarget(el.dataset.id),
    openHtmlEditor: el => openHtmlEditor(el.dataset.id),
    htmlCancel: () => closeHtmlEditor(false), htmlApply: () => closeHtmlEditor(true)
};
document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || !el.closest('#admin-panel, #toggle-admin, #html-editor')) return;   // ignore page content
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
});
$('color-picker').addEventListener('input', updateTheme);
$('font-picker').addEventListener('change', updateTheme);
$('seo-title-input').addEventListener('input', updateSEO);
$('seo-desc-input').addEventListener('input', updateSEO);
$('panel-alpha').addEventListener('input', e => setPanelAlpha(e.target.value));
$('panel-dock').addEventListener('change', e => setDock(e.target.checked));

// ---------- start ----------
(async function init() {
    if (prefs.alpha) setPanelAlpha(prefs.alpha);
    $('panel-dock').checked = !!prefs.dock;
    try {
        const saved = await db.get('autosave');
        if (saved) {
            const doc = new DOMParser().parseFromString(saved, 'text/html');
            if (doc.getElementById('main-canvas')) applyState(stateFromDoc(doc));
            setStatus('Restored your last session');
        }
    } catch (err) {
        $('save-status').textContent = 'Could not load autosave: ' + err.message;
    }
    syncControls();
    refreshUI();
    autosaveReady = true;
})();
