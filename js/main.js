/* ============================================================
   NASA PUNK / ANIM-01 — interactions
   No dependencies. Everything degrades to plain documents.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (selector, scope) { return (scope || document).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };

  function pad(value) { return String(value).padStart(2, '0'); }

  function copyText(text, done) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
      document.body.removeChild(area);
      done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }).catch(fallback);
    } else {
      fallback();
    }
  }

  /* ---------- interface clock (site timezone) ---------- */

  var clock = $('[data-clock]');
  function updateClock() {
    if (!clock) return;
    var zone = clock.getAttribute('data-timezone') || 'Asia/Shanghai';
    var now = new Date();
    var text = '';
    var iso = '';
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(now).reduce(function (acc, part) {
        acc[part.type] = part.value;
        return acc;
      }, {});
      text = parts.year + '.' + parts.month + '.' + parts.day + ' / ' + parts.hour + ':' + parts.minute;
      iso = parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
    } catch (error) {
      text = now.getFullYear() + '.' + pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + ' / ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      iso = now.toISOString().slice(0, 16);
    }
    clock.textContent = text;
    clock.setAttribute('datetime', iso);
  }
  updateClock();
  window.setInterval(updateClock, 30000);

  /* ---------- light / dark ---------- */

  var motionMedia = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var motionEnabled = root.getAttribute('data-motion') === 'on' && !(motionMedia && motionMedia.matches);

  var toggle = $('[data-theme-toggle]');
  var themeLabel = $('[data-theme-label]');

  function syncThemeUi() {
    var dark = root.getAttribute('data-theme') === 'dark';
    if (themeLabel) themeLabel.textContent = dark ? 'DKT' : 'LGT';
    if (toggle) {
      toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
      toggle.setAttribute('title', dark ? '切换到亮色 / LIGHT MODE' : '切换到暗色 / DARK MODE');
    }
  }
  syncThemeUi();

  function applyTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('rnp-theme', next); } catch (error) {}
    syncThemeUi();
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (motionEnabled && document.startViewTransition) {
        try { document.startViewTransition(function () { applyTheme(next); }); }
        catch (error) { applyTheme(next); }
      } else {
        applyTheme(next);
      }
    });
  }

  if (window.matchMedia) {
    var scheme = window.matchMedia('(prefers-color-scheme: dark)');
    var onSchemeChange = function (event) {
      if (root.getAttribute('data-mode') !== 'auto') return;
      try { if (localStorage.getItem('rnp-theme')) return; } catch (error) {}
      root.setAttribute('data-theme', event.matches ? 'dark' : 'light');
      syncThemeUi();
    };
    if (scheme.addEventListener) scheme.addEventListener('change', onSchemeChange);
    else if (scheme.addListener) scheme.addListener(onSchemeChange);
  }

  /* ---------- reading progress + toc scrollspy ---------- */

  var progress = $('[data-progress]');
  var body = $('[data-post-body]');
  var headings = $$('.post-body h2[id], .post-body h3[id]');
  var tocLinks = $$('.toc .toc-link');
  var tocMap = {};

  tocLinks.forEach(function (link) {
    var href = link.getAttribute('href') || '';
    if (href.charAt(0) !== '#') return;
    var id = href.slice(1);
    try { id = decodeURIComponent(id); } catch (error) {}
    if (!tocMap[id]) tocMap[id] = [];
    tocMap[id].push(link);
  });

  var scrollQueued = false;
  function updateOnScroll() {
    scrollQueued = false;

    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.style.width = (ratio * 100).toFixed(2) + '%';
    }

    if (headings.length && tocLinks.length) {
      var current = headings[0];
      for (var i = 0; i < headings.length; i += 1) {
        if (headings[i].getBoundingClientRect().top <= 120) current = headings[i];
        else break;
      }
      tocLinks.forEach(function (link) { link.classList.remove('is-active'); });
      var active = tocMap[current.id] || [];
      active.forEach(function (link) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'true');
      });
      tocLinks.forEach(function (link) {
        if (active.indexOf(link) === -1) link.removeAttribute('aria-current');
      });
    }
  }

  function requestScrollUpdate() {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(updateOnScroll);
  }

  if (progress || headings.length) {
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate);
    updateOnScroll();
  }

  /* ---------- headings, tables, images, code ---------- */

  if (body) {
    var pageTitle = $('.post__title');
    var firstH1 = body.querySelector('h1');
    if (firstH1 && pageTitle && firstH1.textContent.trim() === pageTitle.textContent.trim()) {
      firstH1.parentNode.removeChild(firstH1);
    }

    $$('h1[id], h2[id], h3[id], h4[id]', body).forEach(function (heading) {
      if (heading.querySelector('.h-anchor')) return;
      var anchor = document.createElement('a');
      anchor.className = 'h-anchor';
      anchor.href = '#' + heading.id;
      anchor.setAttribute('aria-label', '此节链接 / LINK TO THIS SECTION');
      anchor.textContent = '#';
      heading.appendChild(anchor);
    });

    $$('table', body).forEach(function (table) {
      if (table.closest('figure.highlight')) return;
      if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    var figureNo = 0;
    $$('img', body).forEach(function (img) {
      if (img.closest('figure') || img.closest('a') || img.closest('.fig')) return;
      var parent = img.parentElement;
      if (!parent || parent.tagName !== 'P') return;
      var onlyImage = Array.prototype.every.call(parent.childNodes, function (node) {
        return node === img || (node.nodeType === 3 && !node.textContent.trim()) || node.nodeName === 'BR';
      });
      if (!onlyImage) return;

      var figure = document.createElement('figure');
      figure.className = 'fig';
      parent.parentNode.insertBefore(figure, parent);
      figure.appendChild(img);
      if (img.alt) {
        figureNo += 1;
        var caption = document.createElement('figcaption');
        caption.className = 'fig-cap';
        caption.textContent = 'FIG. ' + pad(figureNo) + ' / ' + img.alt;
        figure.appendChild(caption);
      }
      parent.parentNode.removeChild(parent);
    });

    $$('figure.highlight', body).forEach(function (figure) {
      if (figure.querySelector('.code-head')) return;
      var language = 'LISTING';
      Array.prototype.forEach.call(figure.classList, function (name) {
        if (name !== 'highlight' && language === 'LISTING') {
          language = name.toUpperCase();
        }
      });

      var head = document.createElement('div');
      head.className = 'code-head';

      var left = document.createElement('div');
      left.className = 'code-head__left';
      var dot = document.createElement('span');
      dot.className = 'code-head__dot';
      var lang = document.createElement('span');
      lang.className = 'code-head__lang';
      lang.textContent = language;
      var source = document.createElement('span');
      source.textContent = '/ SOURCE';
      left.appendChild(dot);
      left.appendChild(lang);
      left.appendChild(source);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = 'COPY';
      button.setAttribute('aria-label', '复制代码');

      head.appendChild(left);
      head.appendChild(button);
      figure.insertBefore(head, figure.firstChild);

      button.addEventListener('click', function () {
        var code = figure.querySelector('td.code') || figure.querySelector('pre');
        if (!code) return;
        copyText(code.textContent.replace(/\n$/, ''), function (ok) {
          button.textContent = ok ? 'COPIED' : 'FAILED';
          button.classList.toggle('is-done', ok);
          window.setTimeout(function () {
            button.textContent = 'COPY';
            button.classList.remove('is-done');
          }, 1600);
        });
      });
    });
  }

  /* ---------- copy article permalink ---------- */

  $$('[data-copy-link]').forEach(function (button) {
    button.addEventListener('click', function () {
      var url = button.getAttribute('data-url') || window.location.href;
      var label = button.querySelector('[data-copy-label]');
      if (!label) return;
      var original = label.textContent;
      copyText(url, function (ok) {
        label.textContent = ok ? (button.getAttribute('data-copied') || 'COPIED / 已复制') : 'COPY FAILED / 复制失败';
        button.classList.toggle('is-done', ok);
        window.setTimeout(function () {
          label.textContent = original;
          button.classList.remove('is-done');
        }, 1800);
      });
    });
  });

  /* ---------- close the mobile table of contents after a jump ---------- */

  $$('[data-toc-mobile] a').forEach(function (link) {
    link.addEventListener('click', function () {
      var details = link.closest('[data-toc-mobile]');
      if (details) details.open = false;
    });
  });

  /* ---------- motion / Anim ---------- */

  function animateCounter(element) {
    if (element.getAttribute('data-counted') === 'done') return;
    var target = parseInt(element.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    var padWidth = parseInt(element.getAttribute('data-pad'), 10) || 0;
    element.setAttribute('data-counted', 'done');
    var duration = 820;
    var startedAt = 0;

    function render(value) {
      element.textContent = String(value).padStart(padWidth, '0');
    }

    function frame(timestamp) {
      if (!startedAt) startedAt = timestamp;
      var progress = Math.min(1, (timestamp - startedAt) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      render(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(frame);
      else render(target);
    }

    render(0);
    window.requestAnimationFrame(frame);
  }

  function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;

    var observer = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.35 });
    }

    counters.forEach(function (element, index) {
      var rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
        window.setTimeout(function () { animateCounter(element); }, 380 + index * 55);
      } else if (observer) {
        observer.observe(element);
      }
    });
  }

  function initReveal() {
    if (!('IntersectionObserver' in window)) return;

    var selector = '.entry, .archive-year, .index-row, .tag-cell, .about-stat, .panel, .adjacent, .post__footer, .footer__top > *';
    var candidates = $$(selector).filter(function (element) {
      if (element.classList.contains('reveal-pending')) return false;
      var rect = element.getBoundingClientRect();
      return rect.top > window.innerHeight * 0.92;
    });
    if (!candidates.length) return;

    var groups = new Map();
    candidates.forEach(function (element) {
      var parent = element.parentElement || document.body;
      var count = groups.get(parent) || 0;
      groups.set(parent, count + 1);
      element.style.setProperty('--reveal-delay', Math.min(count, 6) * 45 + 'ms');
      element.classList.add('reveal-pending');
    });

    function reveal(element) {
      if (element.classList.contains('reveal-in')) return;
      element.classList.add('reveal-in');

      var cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        element.classList.remove('reveal-pending');
        element.classList.remove('reveal-in');
        element.style.removeProperty('--reveal-delay');
      }

      element.addEventListener('transitionend', function (event) {
        if (event.target === element && event.propertyName === 'opacity') cleanup();
      });
      window.setTimeout(cleanup, 1600);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });

    candidates.forEach(function (element) { observer.observe(element); });

    window.setTimeout(function () {
      $$('.reveal-pending').forEach(reveal);
    }, 6000);
  }

  function initMotion() {
    if (!motionEnabled) return;
    initCounters();
    initReveal();
  }

  window.setTimeout(initMotion, 80);

  /* ---------- local index search ---------- */

  var searchRoot = $('[data-search]');
  if (!searchRoot) return;

  var openButtons = $$('[data-search-open]');
  var closeButtons = $$('[data-search-close]');
  var searchForm = $('[data-search-form]', searchRoot);
  var searchInput = $('#search-input', searchRoot);
  var resultsRoot = $('[data-search-results]', searchRoot);
  var statusRoot = $('[data-search-status]', searchRoot);
  var searchUrl = searchRoot.getAttribute('data-search-url') || '/search.json';
  var index = null;
  var loading = false;
  var loadingFailed = false;
  var activeResult = -1;
  var debounceTimer = null;
  var lastFocused = null;

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function termsOf(query) {
    return query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  }

  function countMatches(haystack, term) {
    if (!term) return 0;
    var count = 0;
    var from = 0;
    while (count < 4) {
      var spot = haystack.indexOf(term, from);
      if (spot === -1) break;
      count += 1;
      from = spot + term.length;
    }
    return count;
  }

  function runSearch() {
    var query = searchInput.value.trim();
    resultsRoot.innerHTML = '';
    activeResult = -1;

    if (!query) {
      statusRoot.textContent = index ? index.length + ' RECORDS INDEXED / 索引就绪' : 'SIGNAL READY / 输入关键词开始检索';
      return;
    }
    if (!index) {
      if (!loading && !loadingFailed) loadIndex();
      return;
    }

    var terms = termsOf(query);
    if (!terms.length) return;

    var hits = [];
    index.forEach(function (post) {
      var title = (post.title || '').toLowerCase();
      var tags = (post.tags || []).join(' ').toLowerCase();
      var cats = (post.categories || []).join(' ').toLowerCase();
      var text = (post.text || '').toLowerCase();
      var haystack = title + ' ' + tags + ' ' + cats + ' ' + text;
      var matchesAll = terms.every(function (term) { return haystack.indexOf(term) !== -1; });
      if (!matchesAll) return;

      var score = 0;
      terms.forEach(function (term) {
        if (title.indexOf(term) !== -1) score += 12;
        if (tags.indexOf(term) !== -1) score += 7;
        if (cats.indexOf(term) !== -1) score += 3;
        score += countMatches(text, term);
      });
      hits.push({ post: post, score: score });
    });

    hits.sort(function (a, b) { return b.score - a.score; });
    renderHits(hits, terms);
  }

  function renderHits(hits, terms) {
    resultsRoot.innerHTML = '';
    activeResult = -1;

    if (!hits.length) {
      statusRoot.textContent = 'NO RECORDS MATCHED / 无匹配档案';
      var empty = document.createElement('div');
      empty.className = 'search__empty';
      var code = document.createElement('p');
      code.className = 'search__empty-code';
      code.textContent = 'NO RECORDS MATCHED';
      var note = document.createElement('p');
      note.className = 'search__empty-text';
      note.textContent = '没有匹配的档案。试试标题中的词、标签名，或更短的关键词。';
      empty.appendChild(code);
      empty.appendChild(note);
      resultsRoot.appendChild(empty);
      return;
    }

    statusRoot.textContent = hits.length + ' RECORD' + (hits.length > 1 ? 'S' : '') + ' MATCHED / 找到 ' + hits.length + ' 条';
    var fragment = document.createDocumentFragment();

    hits.slice(0, 12).forEach(function (hit, resultIndex) {
      var post = hit.post;
      var link = document.createElement('a');
      link.className = 'search-result';
      link.href = post.path;
      link.style.animationDelay = (resultIndex * 24) + 'ms';

      var meta = document.createElement('div');
      meta.className = 'search-result__meta';
      var bits = [post.date];
      if (post.categories && post.categories.length) bits.push(post.categories[0]);
      if (post.tags && post.tags.length) bits.push(post.tags.slice(0, 3).map(function (tag) { return '#' + tag; }).join(' '));
      meta.textContent = bits.filter(Boolean).join(' · ');

      var title = document.createElement('h3');
      title.className = 'search-result__title';
      appendHighlighted(title, post.title, terms);

      var text = document.createElement('p');
      text.className = 'search-result__text';
      var snippet = makeSnippet(post.text || '', terms);
      appendHighlighted(text, snippet, terms);

      link.appendChild(meta);
      link.appendChild(title);
      link.appendChild(text);
      fragment.appendChild(link);
    });

    resultsRoot.appendChild(fragment);
  }

  function makeSnippet(text, terms) {
    if (!text) return '';
    var lower = text.toLowerCase();
    var spot = -1;
    terms.forEach(function (term) {
      var found = lower.indexOf(term);
      if (found !== -1 && (spot === -1 || found < spot)) spot = found;
    });
    if (spot === -1) return text.slice(0, 150);
    var start = Math.max(0, spot - 54);
    var end = Math.min(text.length, spot + 130);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function appendHighlighted(container, text, terms) {
    if (!text) return;
    var pattern = terms.map(escapeRegExp).join('|');
    if (!pattern) {
      container.textContent = text;
      return;
    }
    var regex = new RegExp('(' + pattern + ')', 'gi');
    var last = 0;
    var match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        container.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      var mark = document.createElement('mark');
      mark.textContent = match[0];
      container.appendChild(mark);
      last = match.index + match[0].length;
      if (match[0].length === 0) regex.lastIndex += 1;
    }
    if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
  }

  function loadIndex() {
    if (index || loading) return;
    loading = true;
    loadingFailed = false;
    statusRoot.textContent = 'LOADING INDEX / 正在载入索引…';
    fetch(searchUrl, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      index = data && data.posts ? data.posts : [];
      loading = false;
      statusRoot.textContent = index.length + ' RECORDS INDEXED / 索引就绪';
      if (searchInput.value.trim()) runSearch();
    }).catch(function () {
      loading = false;
      loadingFailed = true;
      statusRoot.textContent = 'INDEX UNAVAILABLE / 索引载入失败';
      resultsRoot.innerHTML = '';
      var empty = document.createElement('div');
      empty.className = 'search__empty';
      var code = document.createElement('p');
      code.className = 'search__empty-code';
      code.textContent = 'INDEX UNAVAILABLE';
      var note = document.createElement('p');
      note.className = 'search__empty-text';
      note.textContent = '没有找到 search.json。确认主题的 search 选项已开启，并重新执行 hexo generate。';
      empty.appendChild(code);
      empty.appendChild(note);
      resultsRoot.appendChild(empty);
    });
  }

  function openSearch() {
    lastFocused = document.activeElement;
    searchRoot.hidden = false;
    document.body.classList.add('search-open');
    window.setTimeout(function () { searchInput.focus(); }, 20);
    loadIndex();
  }

  function closeSearch() {
    searchRoot.hidden = true;
    document.body.classList.remove('search-open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  openButtons.forEach(function (button) {
    button.addEventListener('click', openSearch);
  });
  closeButtons.forEach(function (button) {
    button.addEventListener('click', closeSearch);
  });

  searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var first = resultsRoot.querySelector('.search-result');
    if (first) window.location.href = first.href;
    else runSearch();
  });

  searchInput.addEventListener('input', function () {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runSearch, 90);
  });

  searchInput.addEventListener('keydown', function (event) {
    var links = $$('.search-result', resultsRoot);
    if (!links.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      var step = event.key === 'ArrowDown' ? 1 : -1;
      activeResult = Math.max(0, Math.min(links.length - 1, activeResult + step));
      links.forEach(function (link) { link.classList.remove('is-active'); });
      links[activeResult].classList.add('is-active');
      links[activeResult].scrollIntoView({ block: 'nearest' });
    }

    if (event.key === 'Enter' && activeResult > -1) {
      event.preventDefault();
      window.location.href = links[activeResult].href;
    }
  });

  document.addEventListener('keydown', function (event) {
    var target = event.target;
    var typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

    if (searchRoot.hidden) {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openSearch();
      } else if (event.key === '/' && !typing) {
        event.preventDefault();
        openSearch();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
    }
  });

  document.addEventListener('click', function (event) {
    if (event.target === searchRoot) closeSearch();
  });
})();
