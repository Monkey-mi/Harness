# 临江阁 · 古文博客

一个安静的古文阅读处。目前收录苏轼《前赤壁赋》《后赤壁赋》两篇。

技术上是**纯静态 HTML + CSS**,零框架、零构建步骤、零第三方依赖。推到 GitHub 后用 Pages 即可直接上线,本地双击 `index.html` 也能正常浏览。

---

## 一、目录结构

```
.
├── index.html                  首页:站点前言 + 文章列表
├── archive.html                归档页:按年份分组 + 标签云
├── about.html                  关于页:站点说明
│
├── posts/                      ① 所有文章都放这里
│   ├── qian-chibi-fu.html      《前赤壁赋》
│   └── hou-chibi-fu.html       《后赤壁赋》
│
├── templates/
│   └── _template.html          ② 新文章模板,复制它开始写
│
├── assets/
│   ├── css/
│   │   ├── site.css            ③ 设计系统:颜色/字号/间距令牌、导航、卡片、页脚
│   │   └── essay.css           ④ 古籍排版:篇首、正文、名句、校勘记、页码导航
│   ├── js/
│   │   ├── posts.js            ⑤ 文章注册表 —— 全站唯一数据源
│   │   └── site.js             主题切换、阅读进度条、自动目录
│   └── img/
│       └── favicon.svg         站点图标
│
└── docs/                       项目文档(不影响站点运行)
```

### 为什么这样分层

| 目录 | 职责 | 扩展时你要动的地方 |
|---|---|---|
| `posts/` | 内容层 | **加文章必动** |
| `assets/css/site.css` | 全站视觉系统 | 换配色、改字号时动 |
| `assets/css/essay.css` | 古文正文排版 | 只想调正文观感时动 |
| `assets/js/posts.js` | 文章索引数据 | **加文章必动** |
| `templates/` | 写作起点 | 不用动 |
| `docs/` | 项目说明 | 不用动 |

**关键设计:文章列表不写死在 HTML 里。** 首页和归档页都从 `assets/js/posts.js` 读取数据后动态渲染。所以加一篇文章,不需要碰首页,列表、归档、标签都会自动更新。

---

## 二、怎么加一篇新文章

只需三步。

### 第 1 步:复制模板

```bash
cp templates/_template.html posts/你的文件名.html
```

文件名建议用英文短横线风格(会直接成为网址),例如 `yueyang-lou-ji.html`。

### 第 2 步:改内容

打开新文件,把所有 `[方括号]` 里的占位文字替换掉。正文里可用这几种结构:

| 写法 | 效果 |
|---|---|
| `<p>...</p>` | 普通段落,自动首行缩进两字 |
| `<p class="essay__verse"><span>上句,</span><span>下句。</span></p>` | 名句,居中 + 朱砂底色;`<span>` 用于对仗断行 |
| `<h2 class="essay__section">其一</h2>` | 分节小标题;出现两个以上会自动生成目录 |
| `<span class="essay__note">注释</span>` | 行内夹注,小字带竖线 |
| `<aside class="essay__colophon">…</aside>` | 篇末版本说明 / 校勘记 |

⚠️ 模板在 `posts/` 子目录里,**资源路径要带 `../`**,模板里已经写好了,别删。

### 第 3 步:登记到注册表

打开 `assets/js/posts.js`,在 `POSTS` 数组里加一条:

```js
{
  slug: 'yueyang-lou-ji',        // 必填,与 posts/ 下的文件名一致(不含 .html)
  title: '岳阳楼记',              // 必填
  author: '范仲淹',               // 选填
  dynasty: '宋',                  // 选填
  date: '2026-10-11',            // 必填,YYYY-MM-DD,决定排序与归档分组
  summary: '庆历四年春,滕子京谪守巴陵郡。',   // 选填,列表页摘要
  tags: ['古文', '记'],           // 选填
  featured: false,               // 选填
  draft: false                   // 选填,true 则不显示
}
```

**完成。** 刷新首页就能看到新文章。

---

## 三、本地预览

直接双击 `index.html` 即可。

若要更接近线上环境(推荐,因为 `file://` 协议偶尔会有小差异):

```bash
# 任选其一
python3 -m http.server 8000
npx serve .
```

然后访问 `http://localhost:8000`。

---

## 四、部署到 GitHub Pages

1. 把代码推送到仓库的 `main` 分支
2. 打开仓库 **Settings → Pages**
3. **Source** 选 `Deploy from a branch`
4. **Branch** 选 `main`,目录选 `/ (root)`,保存
5. 等一两分钟,访问 `https://<用户名>.github.io/<仓库名>/`

因为站点是纯静态且首页名为 `index.html`,无需任何额外配置。

---

## 五、设计说明

### 配色

取自宣纸与墨,辅以朱砂。所有颜色定义在 `site.css` 顶部的 CSS 变量里,改一处即可全站生效。

| 变量 | 用途 |
|---|---|
| `--paper` / `--paper-raised` | 底色 / 卡片表面 |
| `--ink` / `--ink-strong` | 正文 / 标题 |
| `--cinnabar` | 朱砂,用于强调、链接、印章 |

### 字体栈

不加载任何网络字体,全部使用系统字体,因而离线可用、零请求:

- **正文** `Songti SC`(宋体),逐级回退到 `Hiragino Mincho Pro`(明朝体,补繁体字形)与通用衬线
- **标题** `Kaiti SC`(楷体),更有书卷气
- **界面** 系统无衬线(苹方 / 微软雅黑)

### 排版要点

- 正文行高 `2.35`,字距 `0.06em`——比常规网页宽松,适配中文的方寸感
- 段首缩进两字,依循古籍通例
- 名句单独立出、居中、以朱砂淡底标记
- 提供日间 / 夜间两套配色,夜间用暖黑而非纯黑,久读不刺眼
- 支持打印:自动隐去导航与装饰,正文转为 11pt

### 可访问性

- 全部交互元素可键盘访问,焦点有可见轮廓
- 尊重系统 `prefers-reduced-motion` 设置
- 主题选择保存在 `localStorage`,并在样式应用前同步执行以避免闪白

---

## 六、许可

文章原文属公有领域。站点代码可自由取用。
