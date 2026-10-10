/* ==========================================================================
   admin.js —— 临江阁管理界面
   --------------------------------------------------------------------------
   功能:口令登录 → 配置 GitHub 令牌 → 填表 → 生成排版 → 原子提交并发布

   【安全边界,务必知悉】
   本站是纯静态站点,本文件任何人下载后都能读到。其中的口令校验
   (SHA-256 比对)只能起到「隐藏入口」的作用,NOT 安全边界。
   真正的权限由 GitHub 令牌在服务器端控制:没有令牌,即使绕过登录
   也无法修改仓库。因此请勿在此界面处理任何敏感数据。
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     配置
     ------------------------------------------------------------------------ */
  var CONFIG = {
    // 口令的 SHA-256(不存放明文)。更换口令的方法:
    //   node -e "console.log(require('crypto').createHash('sha256').update('新口令','utf8').digest('hex'))"
    // 把输出替换到下一行即可。
    passwordHash: '29b69744cac8b4f847f0c5f73fdc54c054a9d7320cb79ad314e4b706fbb3ac6d',
    owner: 'Monkey-mi',
    repo: 'Harness',
    branch: 'main',
    // 站点线上地址,用于预览时把相对资源路径指向真实样式
    siteBase: 'https://monkey-mi.github.io/Harness/'
  };

  var KEYS = {
    session: 'harness-admin-auth',
    token: 'harness-admin-token'
  };

  /* ------------------------------------------------------------------------
     小工具
     ------------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.innerHTML = text || '';
    el.className = 'admin__status' + (kind ? ' admin__status--' + kind : '');
  }

  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function b64encodeUtf8(str) {
    // 先转 UTF-8 字节,再 base64,避免中文出错
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64decodeUtf8(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  var CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  /** 数字转中文,用于「五百三十七字」这类标注 */
  function toChineseNumber(n) {
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 0) return '';
    if (n === 0) return '零';
    if (n >= 10000) {
      var wan = Math.floor(n / 10000);
      var rem = n % 10000;
      return toChineseNumber(wan) + '万' + (rem ? toChineseNumber(rem) : '');
    }
    if (n >= 1000) {
      var thousands = Math.floor(n / 1000);
      var r1000 = n % 1000;
      var s = CN_NUM[thousands] + '千';
      if (r1000 === 0) return s;
      if (r1000 < 100) s += '零';
      return s + toChineseNumber(r1000);
    }
    if (n < 10) return CN_NUM[n];
    if (n < 20) return '十' + (n % 10 ? CN_NUM[n % 10] : '');
    if (n < 100) {
      return CN_NUM[Math.floor(n / 10)] + '十' + (n % 10 ? CN_NUM[n % 10] : '');
    }
    var hundreds = Math.floor(n / 100);
    var rest = n % 100;
    var out = CN_NUM[hundreds] + '百';
    if (rest === 0) return out;
    if (rest < 10) return out + '零' + CN_NUM[rest];
    if (rest < 20) return out + '一十' + (rest % 10 ? CN_NUM[rest % 10] : '');
    return out + CN_NUM[Math.floor(rest / 10)] + '十' + (rest % 10 ? CN_NUM[rest % 10] : '');
  }

  function countHan(text) {
    var m = text.match(/[\u4e00-\u9fff]/g);
    return m ? m.length : 0;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------------
     正文排版
     把纯文本转换成 essay__body 内的 HTML
       - 【xxx】 单独一行  → 分节小标题
       - 较短且以句末标点收尾的一整句 → 名句(essay__verse)
       - 其余 → 普通段落(由 CSS 首行缩进两字)
     ------------------------------------------------------------------------ */
  // 句末标点。名句判据中用来数「一句话里有几个句末停顿」,
  // 多句的段落即使是佳句(如「浩浩乎…;飘飘乎…」)也按普通段落排,
  // 以免整段被居中,反而破坏阅读节奏。
  // 用码点转义书写,避免全角标点在编辑过程中被误作半角。
  var SENTENCE_END = /[\u3002\uFF01\uFF1F!?]/g;   // 。!?!?
  // 用于拆分对仗句的分号:全角 U+FF1B、半角 U+003B
  var SEMICOLONS = /[\uFF1B;]/;

  /** 判断某个停顿是否在引号之内(对白不宜居中) */
  function hasQuoteMarks(text) {
    return /[“”「」『』]/.test(text);
  }

  function formatBody(raw) {
    var lines = String(raw || '').split(/\r?\n/);
    var blocks = [];
    // 名句上限:汉字数不多于 24,且全段只有一处句末停顿
    var VERSE_MAX_HAN = 24;

    lines.forEach(function (line) {
      var text = line.trim();
      if (!text) return;

      // 分节小标题
      var sec = text.match(/^[【\[](.+?)[】\]]$/);
      if (sec) {
        blocks.push('<h2 class="essay__section">' + escapeHtml(sec[1]) + '</h2>');
        return;
      }

      var hanCount = countHan(text);
      var stops = (text.match(SENTENCE_END) || []).length;
      var isVerse = hanCount > 0 &&
                    hanCount <= VERSE_MAX_HAN &&
                    stops <= 1 &&
                    !hasQuoteMarks(text);

      if (!isVerse) {
        blocks.push('<p>' + escapeHtml(text) + '</p>');
        return;
      }

      // 含分号的对仗句拆成两行
      var parts = text.split(SEMICOLONS).map(function (s) { return s.trim(); })
                      .filter(function (s) { return s; });
      if (parts.length > 1) {
        blocks.push('<p class="essay__verse">\n' +
          parts.map(function (s) {
            return '  <span>' + escapeHtml(s) + '</span>';
          }).join('\n') + '\n</p>');
      } else {
        blocks.push('<p class="essay__verse">\n  <span>' +
          escapeHtml(text) + '</span>\n</p>');
      }
    });

    return blocks.map(function (b) { return '    ' + b; }).join('\n\n');
  }

  /** 由篇名生成候选 slug(仅能用 ASCII 时才有意义,否则留空让用户填) */
  function suggestSlug(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/[\u4e00-\u9fff]+/g, '')   // 中文无法直转,交给用户
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* ------------------------------------------------------------------------
     GitHub API
     ------------------------------------------------------------------------ */
  var API = 'https://api.github.com';

  function api(path, opts, token) {
    opts = opts || {};
    opts.headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': 'Bearer ' + token
    }, opts.headers || {});
    return fetch(API + path, opts).then(function (res) {
      return res.text().then(function (body) {
        var data;
        try { data = body ? JSON.parse(body) : {}; } catch (e) { data = { raw: body }; }
        if (!res.ok) {
          var err = new Error(data.message || ('HTTP ' + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function repoPath(p) {
    return '/repos/' + CONFIG.owner + '/' + CONFIG.repo + p;
  }

  /** 校验令牌有效性与权限 */
  function verifyToken(token) {
    return api('/user', {}, token).then(function (user) {
      return api(repoPath(''), {}, token).then(function (repo) {
        var perms = repo.permissions || {};
        if (!perms.push) {
          throw new Error('该令牌对 ' + CONFIG.owner + '/' + CONFIG.repo + ' 没有写入权限');
        }
        return { login: user.login, repo: repo.full_name };
      });
    });
  }

  /* --- posts.js 解析与重建 ------------------------------------------------ */
  var POSTS_MARKER = 'var POSTS = [';
  var POSTS_END = '\n  ];';

  /**
   * 提交前的最后一道防线:校验重建后的注册表
   * 曾在真实发布中两次写出语法错误的 posts.js,导致整站 JS 失效。
   * 这里用 new Function 实际编译一次,并检查条目数量与 slug 唯一性,
   * 任何一项不过就中止发布,绝不把坏文件推到线上。
   *
   * @param {string} source  原始 posts.js 全文
   * @param {string} rebuilt 重建后的全文
   * @param {string} newSlug 本次新增的 slug
   */
  function validateRebuilt(source, rebuilt, newSlug) {
    // 1. 必须能被当作 JavaScript 编译
    try {
      /* eslint-disable no-new-func */
      new Function(rebuilt);
    } catch (err) {
      throw new Error('生成的 posts.js 语法无效,已中止发布:' + err.message);
    }

    // 2. 必须仍能加载出注册表,且条目数恰好增加一条
    var sandbox = {};
    try {
      new Function('window', rebuilt)(sandbox);
    } catch (err) {
      throw new Error('生成的 posts.js 无法执行,已中止发布:' + err.message);
    }
    if (!sandbox.HarnessPosts || typeof sandbox.HarnessPosts.all !== 'function') {
      throw new Error('生成的 posts.js 未导出 HarnessPosts,已中止发布');
    }

    var before = extractSlugs(source);
    var after = extractSlugs(rebuilt);

    if (after.length !== before.length + 1) {
      throw new Error('注册表条目数异常:发布前 ' + before.length +
                      ' 条,发布后 ' + after.length + ' 条(应增加 1 条),已中止发布');
    }

    // 3. 原有篇目一条都不能少
    var missing = before.filter(function (s) { return after.indexOf(s) === -1; });
    if (missing.length) {
      throw new Error('原有篇目丢失:' + missing.join('、') + ',已中止发布');
    }

    // 4. slug 不得重复
    var seen = {}, dup = [];
    after.forEach(function (s) {
      if (seen[s]) dup.push(s);
      seen[s] = true;
    });
    if (dup.length) {
      throw new Error('slug 重复:' + dup.join('、') + ',已中止发布');
    }

    if (after.indexOf(newSlug) === -1) {
      throw new Error('新篇目 ' + newSlug + ' 未写入注册表,已中止发布');
    }

    return true;
  }

  /** 从 posts.js 源码中取出所有 slug,用于数量与唯一性校验 */
  function extractSlugs(source) {
    var out = [];
    extractEntryTexts(source).forEach(function (entry) {
      var m = entry.match(/slug:\s*'([^']*)'/);
      if (m) out.push(m[1]);
    });
    return out;
  }

  /**
   * 从 posts.js 源码中取出已经序列化好的条目文本(保留原格式,减少 diff)
   * 注意:必须保留条目之间的分隔逗号,否则重建后数组语法会出错。
   */
  function extractEntryTexts(source) {
    var start = source.indexOf(POSTS_MARKER);
    if (start === -1) throw new Error('posts.js 结构异常:找不到 POSTS 数组');
    var bodyStart = start + POSTS_MARKER.length;
    var end = source.indexOf(POSTS_END, bodyStart);
    if (end === -1) throw new Error('posts.js 结构异常:POSTS 数组未闭合');
    var body = source.slice(bodyStart, end);

    var entries = [];
    var current = null;
    var CLOSE = '    }';

    body.split('\n').forEach(function (line) {
      if (/^\s{4}\{\s*$/.test(line)) {
        // 新条目开始:先收束上一条
        if (current !== null) entries.push(current);
        current = [line];
        return;
      }
      if (current === null) return;   // 数组开头的空白行,跳过

      if (line.indexOf(CLOSE) === 0) {
        // 收尾行:保留 } 之后的内容(即分隔逗号),否则重建后条目会粘连
        current.push(line);
        entries.push(current);
        current = null;
      } else {
        current.push(line);
      }
    });
    if (current !== null) entries.push(current);

    return entries.map(function (e) { return e.join('\n').replace(/\s+$/, ''); })
                  .filter(function (e) { return e.trim(); });
  }

  /** 把一条记录序列化成与现有风格一致的源码 */
  function serializeEntry(post) {
    var lines = ['    {'];
    lines.push("      slug: '" + post.slug + "',");
    lines.push("      title: '" + post.title + "',");
    if (post.author) lines.push("      author: '" + post.author + "',");
    if (post.dynasty) lines.push("      dynasty: '" + post.dynasty + "',");
    lines.push("      date: '" + post.date + "',");
    if (post.summary) lines.push("      summary: '" + post.summary + "',");
    if (post.tags && post.tags.length) {
      lines.push("      tags: [" + post.tags.map(function (t) {
        return "'" + t + "'";
      }).join(', ') + "],");
    }
    if (post.featured) lines.push('      featured: true');

    // 去掉最后一个字段行末尾多余的逗号
    var last = lines.length - 1;
    lines[last] = lines[last].replace(/,\s*$/, '');

    lines.push('    }');
    return lines.join('\n');
  }

  /**
   * 生成新的 posts.js 全文
   * @param {string} source 原 posts.js 源码
   * @param {string} newEntryText 新增条目(serializeEntry 的产物,末尾不带逗号)
   * 旧条目一律补上分隔逗号:数组最后一条在原文里没有逗号,
   * 直接拼接会让它与新条目粘连,导致语法错误。
   */
  function rebuildPostsModule(source, newEntryText) {
    var start = source.indexOf(POSTS_MARKER);
    if (start === -1) throw new Error('posts.js 结构异常:找不到 POSTS 数组');
    var bodyStart = start + POSTS_MARKER.length;
    var end = source.indexOf(POSTS_END, bodyStart);
    if (end === -1) throw new Error('posts.js 结构异常:POSTS 数组未闭合');

    var head = source.slice(0, bodyStart);
    var tail = source.slice(end);

    var oldEntries = extractEntryTexts(source).map(function (t) {
      return t.replace(/,\s*$/, '');   // 统一去掉尾逗号,避免出现双重逗号
    });
    var all = oldEntries.concat([newEntryText.replace(/,\s*$/, '')]);
    var merged = all.map(function (t) { return t + ','; }).join('\n');
    merged = merged.replace(/,\s*$/, '');   // 最后一条不要逗号

    return head + '\n' + merged + '\n' + tail.replace(/^\n/, '');
  }

  /** 读取仓库中的某个文本文件 */
  function getFileText(path, token) {
    return api(repoPath('/contents/' + path + '?ref=' + CONFIG.branch), {}, token)
      .then(function (data) {
        return { text: b64decodeUtf8(data.content), sha: data.sha };
      });
  }

  /* --- 原子发布:一次提交写入两个文件 ------------------------------------ */
  function publish(post, html) {
    var token = getToken();
    var steps = [];
    var headSha, baseTreeSha, postsSource;

    return api(repoPath('/git/ref/heads/' + CONFIG.branch), {}, token)
      .then(function (ref) {
        headSha = ref.object.sha;
        return api(repoPath('/git/commits/' + headSha), {}, token);
      })
      .then(function (commit) {
        baseTreeSha = commit.tree.sha;
        return getFileText('assets/js/posts.js', token);
      })
      .then(function (file) {
        postsSource = file.text;
        var entryText = serializeEntry(post);
        var newModule = rebuildPostsModule(postsSource, entryText);
        // 提交前校验:语法、条目数、原有篇目完整性、slug 唯一性
        validateRebuilt(postsSource, newModule, post.slug);
        return createBlob(newModule, token);
      })
      .then(function (postsBlob) {
        steps.push({ path: 'assets/js/posts.js', sha: postsBlob });
        return createBlob(html, token);
      })
      .then(function (htmlBlob) {
        steps.push({ path: 'posts/' + post.slug + '.html', sha: htmlBlob });
        return api(repoPath('/git/trees'), {
          method: 'POST',
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: steps.map(function (s) {
              return { path: s.path, mode: '100644', type: 'blob', sha: s.sha };
            })
          })
        }, token);
      })
      .then(function (tree) {
        return api(repoPath('/git/commits'), {
          method: 'POST',
          body: JSON.stringify({
            message: '新增篇目:' + post.title + (post.author ? '(' + post.dynasty + post.author + ')' : ''),
            tree: tree.sha,
            parents: [headSha]
          })
        }, token);
      })
      .then(function (commit) {
        return api(repoPath('/git/refs/heads/' + CONFIG.branch), {
          method: 'PATCH',
          body: JSON.stringify({ sha: commit.sha, force: false })
        }, token).then(function () { return commit; });
      });
  }

  function createBlob(content, token) {
    return api(repoPath('/git/blobs'), {
      method: 'POST',
      body: JSON.stringify({ content: b64encodeUtf8(content), encoding: 'base64' })
    }, token).then(function (b) { return b.sha; });
  }

  /* ------------------------------------------------------------------------
     模板填充
     ------------------------------------------------------------------------ */
  var POSTHTML_TOKEN = '@POSTHTML@';

  function readTemplate() {
    // 模板存放在 <template> 中:浏览器把其内容解析为惰性的 DocumentFragment,
    // 既不渲染,也不会像未知类型的 <script> 那样把内容当 HTML 显示。
    //
    // 模板内含 </script>,若直接书写会提前闭合外层 <template>,
    // 因此每个结束标签后跟一个 @POSTHTML@ 令牌;读取时把令牌剔除,
    // 生成的文章与 templates/_template.html 完全一致。
    var el = $('post-template');
    return el.innerHTML.split(POSTHTML_TOKEN).join('');
  }

  function buildHtml(post) {
    var tpl = readTemplate();
    var dateDisplay = (post.date || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/,
      function (_, y, m, d) { return y + ' 年 ' + parseInt(m, 10) + ' 月 ' + parseInt(d, 10) + ' 日'; });

    var bodyHtml = formatBody(post.body);

    var colophon = '';
    if (post.colophon && post.colophon.trim()) {
      colophon = '\n  <aside class="essay__colophon">\n    <h2>版本说明</h2>\n' +
        post.colophon.split(/\r?\n/).filter(function (l) { return l.trim(); })
          .map(function (l) { return '    <p>' + escapeHtml(l.trim()) + '</p>'; })
          .join('\n') +
        '\n  </aside>\n';
    }

    var description = post.summary || (post.title + '全文');

    return tpl
      .replace(/__TITLE__/g, escapeHtml(post.title))
      .replace(/__DESCRIPTION__/g, escapeHtml(description))
      .replace(/__EYEBROW__/g, escapeHtml(post.eyebrow || ''))
      .replace(/__BYLINE_LINE__/g, '')
      .replace(/__DYNASTY__/g, escapeHtml(post.dynasty || ''))
      .replace(/__AUTHOR__/g, escapeHtml(post.author || ''))
      .replace(/__DATE_DISPLAY__/g, escapeHtml(dateDisplay))
      .replace(/__DATE__/g, escapeHtml(post.date || ''))
      .replace(/__GENRE__/g, escapeHtml(post.genre || '文'))
      .replace(/__ORDINAL__/g, escapeHtml(post.ordinal || ''))
      .replace(/__BODY__/g, bodyHtml)
      .replace(/__COLOPHON__/g, colophon)
      .replace(/__SLUG__/g, post.slug);
  }

  /** 预览用:把相对资源路径指向线上真实文件,使样式与线上一致 */
  function toPreviewHtml(html) {
    return html
      .replace(/(href|src)="\.\.\/assets\//g, '$1="' + CONFIG.siteBase + 'assets/')
      .replace(/(href|src)="assets\//g, '$1="' + CONFIG.siteBase + 'assets/');
  }

  /* ------------------------------------------------------------------------
     form ⇄ post
     ------------------------------------------------------------------------ */
  function collectPost() {
    var title = $('f-title').value.trim();
    var slug = $('f-slug').value.trim();
    var date = $('f-date').value;
    var body = $('f-body').value;

    if (!title) throw new Error('请填写篇名');
    if (!slug) throw new Error('请填写网址标识(slug)');
    if (!/^[a-z0-9\-]+$/.test(slug)) throw new Error('网址标识只能用小写字母、数字和连字符');
    if (!date) throw new Error('请选择日期');
    if (!body.trim()) throw new Error('正文不能为空');

    var tags = $('f-tags').value.split(/[,,\s]+/).map(function (t) {
      return t.trim();
    }).filter(function (t) { return t; });

    var ordinal = $('f-ordinal').value.trim() || toChineseNumber(countHan(body));

    return {
      slug: slug,
      title: title,
      author: $('f-author').value.trim(),
      dynasty: $('f-dynasty').value.trim(),
      date: date,
      summary: $('f-summary').value.trim(),
      tags: tags,
      genre: $('f-genre').value.trim(),
      eyebrow: $('f-eyebrow').value.trim(),
      ordinal: ordinal,
      body: body,
      colophon: $('f-colophon').value
    };
  }

  /* ------------------------------------------------------------------------
     登录状态
     ------------------------------------------------------------------------ */
  function isAuthed() {
    try { return sessionStorage.getItem(KEYS.session) === 'ok'; } catch (e) { return false; }
  }
  function setAuthed(v) {
    try {
      if (v) sessionStorage.setItem(KEYS.session, 'ok');
      else sessionStorage.removeItem(KEYS.session);
    } catch (e) {}
  }

  function getToken() {
    try {
      return localStorage.getItem(KEYS.token) || sessionStorage.getItem(KEYS.token) || '';
    } catch (e) { return ''; }
  }
  function setToken(tok, remember) {
    try {
      if (remember) localStorage.setItem(KEYS.token, tok);
      else sessionStorage.setItem(KEYS.token, tok);
    } catch (e) {}
  }
  function clearToken() {
    try { localStorage.removeItem(KEYS.token); sessionStorage.removeItem(KEYS.token); } catch (e) {}
  }

  /* ------------------------------------------------------------------------
     界面流程
     ------------------------------------------------------------------------ */
  function showLogin() {
    var modal = $('login-modal');
    modal.hidden = false;
    $('admin-app').hidden = true;
    var inp = $('login-password');
    inp.value = '';
    $('login-error').hidden = true;
    setTimeout(function () { inp.focus(); }, 30);
  }

  function hideLogin() { $('login-modal').hidden = true; }

  function showAdmin() {
    hideLogin();
    $('admin-app').hidden = false;
    if (getToken()) {
      $('token-gate').hidden = true;
      $('workspace').hidden = false;
      refreshAccount();
    } else {
      $('token-gate').hidden = false;
      $('workspace').hidden = true;
      $('token-input').focus();
    }
  }

  function refreshAccount() {
    var token = getToken();
    if (!token) return;
    api('/user', {}, token).then(function (u) {
      $('account-info').innerHTML =
        '已连接 <strong>' + escapeHtml(u.login) + '</strong> · ' +
        escapeHtml(CONFIG.owner + '/' + CONFIG.repo) + ' · ' + CONFIG.branch;
    }).catch(function () {
      $('account-info').textContent = '令牌可能已失效,请清除后重新配置';
    });
  }

  /* ------------------------------------------------------------------------
     初始化
     ------------------------------------------------------------------------ */
  function init() {
    // 默认日期为今天
    var today = new Date();
    $('f-date').value = today.toISOString().slice(0, 10);

    // 篇名 → 自动建议 slug
    var slugTouched = false;
    on($('f-slug'), 'input', function () { slugTouched = true; });
    on($('f-title'), 'input', function () {
      if (slugTouched) return;
      var s = suggestSlug($('f-title').value);
      if (s) $('f-slug').value = s;
    });

    // 登录
    on($('login-form'), 'submit', function (e) {
      e.preventDefault();
      var val = $('login-password').value;
      sha256Hex(val).then(function (hex) {
        if (hex === CONFIG.passwordHash) {
          setAuthed(true);
          showAdmin();
        } else {
          var err = $('login-error');
          err.textContent = '口令不正确';
          err.hidden = false;
          $('login-password').value = '';
          $('login-password').focus();
        }
      });
    });

    // 关闭弹框
    document.querySelectorAll('[data-close]').forEach(function (el) {
      on(el, 'click', function () {
        hideLogin();
        if (location.hash.indexOf('admin') !== -1) {
          history.replaceState(null, '', location.pathname);
        }
      });
    });
    on(document, 'keydown', function (e) {
      if (e.key === 'Escape' && !$('login-modal').hidden) {
        hideLogin();
        if (location.hash.indexOf('admin') !== -1) {
          history.replaceState(null, '', location.pathname);
        }
      }
    });

    // 令牌
    on($('btn-save-token'), 'click', function () {
      var tok = $('token-input').value.trim();
      if (!tok) { setStatus($('token-status'), '请输入令牌', 'err'); return; }
      setStatus($('token-status'), '正在验证…', 'busy');
      verifyToken(tok).then(function (info) {
        setToken(tok, $('token-remember').checked);
        setStatus($('token-status'),
          '✅ 验证通过:' + escapeHtml(info.login) + ' → ' + escapeHtml(info.repo), 'ok');
        setTimeout(function () {
          $('token-gate').hidden = true;
          $('workspace').hidden = false;
          refreshAccount();
        }, 600);
      }).catch(function (err) {
        setStatus($('token-status'), '❌ ' + escapeHtml(err.message), 'err');
      });
    });

    on($('btn-forget-token'), 'click', function () {
      clearToken();
      $('token-input').value = '';
      $('workspace').hidden = true;
      $('token-gate').hidden = false;
      setStatus($('token-status'), '令牌已清除', 'ok');
    });

    on($('btn-logout'), 'click', function () {
      setAuthed(false);
      $('admin-app').hidden = true;
      showLogin();
    });

    // 预览
    on($('btn-preview'), 'click', function () {
      try {
        var post = collectPost();
        var html = buildHtml(post);
        $('preview-frame').srcdoc = toPreviewHtml(html);
        setStatus($('publish-status'),
          '已生成预览 · 正文 ' + countHan(post.body) + ' 字 · 标注「' + post.ordinal + '字」', 'ok');
      } catch (err) {
        setStatus($('publish-status'), '❌ ' + escapeHtml(err.message), 'err');
      }
    });

    // 表单任意改动后自动刷新预览(防抖)
    var timer = null;
    on($('post-form'), 'input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        try { $('preview-frame').srcdoc = toPreviewHtml(buildHtml(collectPost())); } catch (e) {}
      }, 600);
    });

    // 发布
    on($('post-form'), 'submit', function (e) {
      e.preventDefault();
      var post, html;
      try {
        post = collectPost();
        html = buildHtml(post);
      } catch (err) {
        setStatus($('publish-status'), '❌ ' + escapeHtml(err.message), 'err');
        return;
      }

      var btn = $('btn-publish');
      btn.disabled = true;
      setStatus($('publish-status'), '正在提交到 GitHub…', 'busy');

      // 先确认文件不存在,避免覆盖已有文章
      getFileText('posts/' + post.slug + '.html', getToken())
        .then(function () {
          throw new Error('已存在同名的 posts/' + post.slug + '.html,请换一个网址标识');
        })
        .catch(function (err) {
          if (err.status !== 404) throw err;
          return publish(post, html);
        })
        .then(function (commit) {
          var url = 'https://github.com/' + CONFIG.owner + '/' + CONFIG.repo +
                    '/commit/' + commit.sha;
          setStatus($('publish-status'),
            '✅ 发布成功!提交 <a href="' + url + '" target="_blank" rel="noopener">' +
            commit.sha.slice(0, 7) + '</a><br>' +
            'GitHub Pages 通常需 1–2 分钟重新部署,稍后访问:<br>' +
            '<a href="' + CONFIG.siteBase + 'posts/' + post.slug + '.html" target="_blank" rel="noopener">' +
            CONFIG.siteBase + 'posts/' + post.slug + '.html</a>', 'ok');
        })
        .catch(function (err) {
          setStatus($('publish-status'), '❌ 发布失败:' + escapeHtml(err.message), 'err');
        })
        .then(function () { btn.disabled = false; });
    });

    // 路由
    function route() {
      if (location.hash.indexOf('admin') === -1) {
        hideLogin();
        $('admin-app').hidden = true;
        return;
      }
      if (isAuthed()) showAdmin();
      else showLogin();
    }
    on(window, 'hashchange', route);
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
