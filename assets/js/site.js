/* ==========================================================================
   site.js —— 站点交互
   1. 主题切换(浅色/暗色/跟随系统)并持久化
   2. 文章页阅读进度条
   3. 文章页自动生成目录(基于 .essay__section)
   ========================================================================== */
(function () {
  'use strict';

  var THEME_KEY = 'harness-theme';

  /* ----------------------------------------------------------------------
     1. 主题
     ---------------------------------------------------------------------- */
  var root = document.documentElement;

  function systemPrefersDark() {
    return window.matchMedia &&
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentEffectiveTheme() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    // theme: 'light' | 'dark' | 'auto'
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    var effective = currentEffectiveTheme();
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label',
        effective === 'dark' ? '切换到浅色模式' : '切换到暗色模式');
      btn.setAttribute('title', effective === 'dark' ? '切换到浅色模式' : '切换到暗色模式');
      btn.textContent = effective === 'dark' ? '☀' : '☾';
    }
    // 通知进度条等需要重算的元素
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: effective } }));
  }

  function readStoredTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'auto'; }
    catch (e) { return 'auto'; }
  }

  function storeTheme(theme) {
    try {
      if (theme === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  function initTheme() {
    applyTheme(readStoredTheme());

    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = currentEffectiveTheme() === 'dark' ? 'light' : 'dark';
        storeTheme(next);
        applyTheme(next);
      });
    }

    // 未手动选择时,跟随系统变化
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (readStoredTheme() === 'auto') applyTheme('auto');
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ----------------------------------------------------------------------
     2. 阅读进度条
     ---------------------------------------------------------------------- */
  function initProgress() {
    var bar = document.querySelector('.progress');
    if (!bar) return;

    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? (doc.scrollTop || document.body.scrollTop) / max : 0;
      bar.style.width = Math.min(100, Math.max(0, pct * 100)) + '%';
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ----------------------------------------------------------------------
     3. 自动目录
     把 .essay__section 收集起来,插入到 .essay-toc 容器里
     ---------------------------------------------------------------------- */
  function initToc() {
    var container = document.querySelector('[data-toc]');
    if (!container) return;

    var headings = document.querySelectorAll('.essay__body .essay__section');
    if (headings.length < 2) {
      container.remove();
      return;
    }

    var nav = document.createElement('nav');
    nav.className = 'essay-toc';
    nav.setAttribute('aria-label', '目录');

    var h2 = document.createElement('h2');
    h2.className = 'essay-toc__title';
    h2.textContent = '目次';
    nav.appendChild(h2);

    var ol = document.createElement('ol');
    ol.className = 'essay-toc__list';

    Array.prototype.forEach.call(headings, function (heading, i) {
      var id = heading.id || ('sec-' + (i + 1));
      heading.id = id;

      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = heading.textContent.trim();
      li.appendChild(a);
      ol.appendChild(li);
    });

    nav.appendChild(ol);
    container.appendChild(nav);
  }

  /* ----------------------------------------------------------------------
     4. 启动
     ---------------------------------------------------------------------- */
  function init() {
    initTheme();
    initProgress();
    initToc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
