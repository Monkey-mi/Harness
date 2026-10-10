/* ==========================================================================
   posts.js —— 文章注册表(全站唯一数据源)
   --------------------------------------------------------------------------
   【新增一篇文章的完整流程】
     1. 复制 templates/_template.html → posts/你的文件名.html,改好内容
     2. 在下面 POSTS 数组里加一条记录
     3. 完成。首页、归档页、标签都会自动出现这篇文章。
   --------------------------------------------------------------------------
   【字段说明】
     slug     必填  posts/ 下的文件名(不含 .html),同时用作文章 URL
     title    必填  文章标题
     author   选填  作者
     dynasty  选填  朝代,显示在作者前
     date     必填  发布日期 YYYY-MM-DD,用于排序与归档分组
     summary  选填  列表页摘要(一两句,宜短)
     tags     选填  标签数组
     featured 选填  true 表示首页突出显示
     draft    选填  true 表示草稿,列表页不显示
   ========================================================================== */
(function (global) {
  'use strict';

  var POSTS = [
    {
      slug: 'qian-chibi-fu',
      title: '前赤壁赋',
      author: '苏轼',
      dynasty: '宋',
      date: '2026-10-10',
      summary: '壬戌之秋,七月既望,苏子与客泛舟游于赤壁之下。清风徐来,水波不兴。',
      tags: ['古文', '赤壁赋', '苏轼'],
      featured: true
    },
    {
      slug: 'hou-chibi-fu',
      title: '后赤壁赋',
      author: '苏轼',
      dynasty: '宋',
      date: '2026-10-10',
      summary: '是岁十月之望,步自雪堂,将归于临皋。霜露既降,木叶尽脱。',
      tags: ['古文', '赤壁赋', '苏轼'],
      featured: true
    },
    {
      slug: 'qian-chibi-fu',
      title: '前赤壁赋',
      author: '苏轼',
      dynasty: '宋',
      date: '2026-10-10',
      summary: '壬戌之秋,七月既望,苏子与客泛舟游于赤壁之下。清风徐来,水波不兴。',
      tags: ['古文', '赤壁赋', '苏轼'],
      featured: true
    },
    {
      slug: 'hou-chibi-fu',
      title: '后赤壁赋',
      author: '苏轼',
      dynasty: '宋',
      date: '2026-10-10',
      summary: '是岁十月之望,步自雪堂,将归于临皋。霜露既降,木叶尽脱。',
      tags: ['古文', '赤壁赋', '苏轼'],
      featured: true
    }
    {
      slug: 'dsh-diag',
      title: '诊断稿',
      date: '2026-10-10'
    }
  ];

  /* ----------------------------------------------------------------------
     工具函数
     ---------------------------------------------------------------------- */

  /** 只保留非草稿,并按日期倒序排列 */
  function published() {
    return POSTS
      .filter(function (p) { return !p.draft; })
      .slice()
      .sort(function (a, b) {
        if (a.date === b.date) return 0;
        return a.date < b.date ? 1 : -1;
      });
  }

  /** 拼出文章链接。prefix 为从当前页到站点根目录的相对路径 */
  function url(post, prefix) {
    return (prefix || '') + 'posts/' + post.slug + '.html';
  }

  /** 按标签筛选 */
  function byTag(tag) {
    return published().filter(function (p) {
      return (p.tags || []).indexOf(tag) !== -1;
    });
  }

  /** 收集全部标签及计数 */
  function allTags() {
    var counts = {};
    published().forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }

  /** 取相邻文章,用于上一篇 / 下一篇 */
  function neighbors(slug) {
    var list = published();
    var i = -1;
    for (var k = 0; k < list.length; k++) {
      if (list[k].slug === slug) { i = k; break; }
    }
    if (i === -1) return { prev: null, next: null };
    // 列表是倒序的:索引更小 = 更新,索引更大 = 更旧
    return {
      prev: i + 1 < list.length ? list[i + 1] : null,  // 更早的一篇
      next: i - 1 >= 0 ? list[i - 1] : null             // 更晚的一篇
    };
  }

  /* ----------------------------------------------------------------------
     渲染
     ---------------------------------------------------------------------- */

  /** 创建元素的小工具 */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /** 生成一张文章卡片 <li> */
  function buildCard(post, prefix) {
    var li = el('li', 'post-card');

    var meta = el('div', 'post-card__meta');
    var time = el('time', null, post.date);
    time.setAttribute('datetime', post.date);
    meta.appendChild(time);
    if (post.dynasty || post.author) {
      meta.appendChild(el('span', 'dot', '·'));
      meta.appendChild(el('span', null, (post.dynasty || '') + (post.author || '')));
    }
    li.appendChild(meta);

    var h = el('h3', 'post-card__title');
    var a = el('a', null, post.title);
    a.href = url(post, prefix);
    h.appendChild(a);
    li.appendChild(h);

    if (post.summary) {
      li.appendChild(el('p', 'post-card__excerpt', post.summary));
    }

    if (post.tags && post.tags.length) {
      var tags = el('div', 'post-card__tags');
      post.tags.forEach(function (t) {
        tags.appendChild(el('span', 'tag', t));
      });
      li.appendChild(tags);
    }

    return li;
  }

  /**
   * 把文章列表渲染进容器
   * @param {HTMLElement} container 目标容器
   * @param {Object} opts { prefix, limit, tag, showCount }
   */
  function renderList(container, opts) {
    if (!container) return;
    opts = opts || {};
    var list = opts.tag ? byTag(opts.tag) : published();
    if (opts.limit) list = list.slice(0, opts.limit);

    container.innerHTML = '';

    if (!list.length) {
      var note = el('p', 'empty-note', '这里还没有文章。');
      container.appendChild(note);
      return;
    }

    var ul = el('ul', 'post-list');
    list.forEach(function (p) {
      ul.appendChild(buildCard(p, opts.prefix || ''));
    });
    container.appendChild(ul);

    // 若指定了数量上限且还有更多,给一个「查看全部」
    var total = published().length;
    if (opts.limit && total > opts.limit) {
      var more = el('p', 'list-more');
      var link = el('a', null, '查看全部 ' + total + ' 篇 →');
      link.href = (opts.prefix || '') + 'archive.html';
      more.appendChild(link);
      container.appendChild(more);
    }
  }

  /**
   * 把文章按年份分组渲染进容器(用于归档页)
   * @param {HTMLElement} container 目标容器
   * @param {Object} opts { prefix }
   */
  function renderArchive(container, opts) {
    if (!container) return;
    opts = opts || {};
    container.innerHTML = '';

    var list = published();
    if (!list.length) {
      container.appendChild(el('p', 'empty-note', '这里还没有文章。'));
      return;
    }

    // 按年分组
    var groups = [];
    var index = {};
    list.forEach(function (p) {
      var year = (p.date || '').slice(0, 4) || '未标日期';
      if (index[year] == null) {
        index[year] = groups.length;
        groups.push({ year: year, posts: [] });
      }
      groups[index[year]].posts.push(p);
    });

    groups.forEach(function (g) {
      container.appendChild(el('h2', 'archive-year', g.year));

      var ul = el('ul', 'archive-list');
      g.posts.forEach(function (p) {
        var li = document.createElement('li');

        var time = el('time', null, p.date);
        time.setAttribute('datetime', p.date);
        li.appendChild(time);

        var a = el('a', null, p.title);
        a.href = url(p, opts.prefix || '');
        li.appendChild(a);

        if (p.author) {
          li.appendChild(el('span', 'by', (p.dynasty || '') + p.author));
        }
        ul.appendChild(li);
      });
      container.appendChild(ul);
    });
  }

  /**
   * 渲染标签云
   * @param {HTMLElement} container 目标容器
   * @param {Object} opts { prefix }
   */
  function renderTags(container, opts) {
    if (!container) return;
    opts = opts || {};
    var counts = allTags();
    var names = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a] || (a < b ? -1 : 1);
    });
    container.innerHTML = '';
    if (!names.length) return;

    names.forEach(function (name) {
      var span = el('span', 'tag', name + ' ' + counts[name]);
      container.appendChild(span);
    });
  }

  /**
   * 渲染上一篇 / 下一篇导航
   * @param {HTMLElement} container 目标容器
   * @param {string} slug 当前文章 slug
   * @param {string} prefix 相对站点根目录的前缀
   */
  function renderPostNav(container, slug, prefix) {
    if (!container) return;
    var nb = neighbors(slug);
    container.innerHTML = '';

    var items = [];
    if (nb.prev) items.push({ post: nb.prev, label: '← 上一篇', cls: 'post-nav__item--prev' });
    if (nb.next) items.push({ post: nb.next, label: '下一篇 →', cls: 'post-nav__item--next' });
    if (!items.length) { container.remove(); return; }
    if (items.length === 1) container.classList.add('post-nav--single');

    items.forEach(function (it) {
      var a = el('a', 'post-nav__item ' + it.cls);
      a.href = url(it.post, prefix || '');
      a.appendChild(el('span', 'post-nav__label', it.label));
      a.appendChild(el('span', 'post-nav__title', it.post.title));
      container.appendChild(a);
    });
  }

  /* ----------------------------------------------------------------------
     导出
     ---------------------------------------------------------------------- */
  global.HarnessPosts = {
    all: published,
    byTag: byTag,
    allTags: allTags,
    neighbors: neighbors,
    renderList: renderList,
    renderArchive: renderArchive,
    renderTags: renderTags,
    renderPostNav: renderPostNav
  };
})(window);
