(function () {
  const FAVORITES_KEY = 'polymer-review-favorites-v1';
  const FAVORITES_NOTICE_KEY = 'polymer-review-favorites-notice-v1';
  const cardsEl = document.getElementById('cards');
  const tocEl = document.getElementById('tocList');
  const courseMapEl = document.getElementById('courseMap');
  const contentPanel = document.querySelector('.content-panel');
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const exportFavoritesButton = document.getElementById('exportFavoritesButton');
  const favoriteNoticeModal = document.getElementById('favoriteNoticeModal');
  const favoriteNoticeConfirm = document.getElementById('favoriteNoticeConfirm');
  const resultCount = document.getElementById('resultCount');
  const emptyState = document.getElementById('emptyState');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  const sectionLinks = Array.from(document.querySelectorAll('[data-section-link]'));
  const sectionSegment = document.querySelector('.section-segment');
  const filterSegment = document.querySelector('.filter-segment');

  const KEY_TERMS = [
    '粘弹性', '剪切变稀', '拉伸硬化', '松弛时间', 'Deborah 数', 'Weissenberg 数', '毛细管数',
    '入口压力降', '出口胀大', '熔体破裂', '分子量分布', '长支链', '填料', '混合', '分散',
    '单螺杆', '双螺杆', '保压', '内应力', '模具温度', '模压', '压延', '浇铸', '取向', '固化'
  ];

  let activeFilter = 'all';
  let committedSearch = '';
  let favorites = loadFavorites();
  let cardObserver;
  let sectionObserver;

  function loadFavorites() {
    try {
      const data = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      return new Set(Array.isArray(data) ? data : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
  }

  function showFavoritesNoticeOnce() {
    if (localStorage.getItem(FAVORITES_NOTICE_KEY) === 'shown') return Promise.resolve();
    return new Promise((resolve) => {
      favoriteNoticeModal.hidden = false;
      favoriteNoticeConfirm.focus();
      const confirm = () => {
        favoriteNoticeModal.hidden = true;
        localStorage.setItem(FAVORITES_NOTICE_KEY, 'shown');
        favoriteNoticeConfirm.removeEventListener('click', confirm);
        resolve();
      };
      favoriteNoticeConfirm.addEventListener('click', confirm);
    });
  }

  async function toggleFavorite(id) {
    await showFavoritesNoticeOnce();
    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.add(id);
    }
    saveFavorites();
    render();
  }

  function exportFavorites() {
    const ids = Array.from(favorites).sort((a, b) => {
      const order = ['F', 'J', 'R', 'D', 'P'];
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      if (ai !== bi) return ai - bi;
      return Number(a.slice(1)) - Number(b.slice(1));
    });
    const lines = ids.length ? ids : ['暂无收藏题目'];
    const content = `聚合物成型加工复习题收藏题号\n导出时间：${new Date().toLocaleString()}\n\n${lines.join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '聚合物成型加工-收藏题号.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function normalize(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, '');
  }

  function matchesSearch(item, keyword) {
    if (!keyword) return true;
    const sourceText = item.sources.map((source) => `${source.week}${source.place}${source.topic}${source.file}`).join('');
    const text = normalize(`${item.id}${item.category}${item.title}${item.question}${item.analysis}${item.answer.join('')}${sourceText}`);
    return text.includes(normalize(keyword));
  }

  function getVisibleItems() {
    return window.REVIEW_DATA.filter((item) => {
      const favOk = activeFilter === 'all' || favorites.has(item.id);
      return favOk && matchesSearch(item, committedSearch);
    });
  }

  function highlight(text) {
    let output = String(text);
    KEY_TERMS.forEach((term) => {
      output = output.replaceAll(term, `<span class="key-term">${term}</span>`);
    });
    output = output.replaceAll('判断：正确', '<strong>判断：正确</strong>');
    output = output.replaceAll('判断：错误', '<strong>判断：错误</strong>');
    output = output.replaceAll('核心', '<strong>核心</strong>');
    output = output.replaceAll('原因', '<strong>原因</strong>');
    output = output.replaceAll('优化', '<strong>优化</strong>');
    output = output.replaceAll('解决', '<strong>解决</strong>');
    return output;
  }

  function sourceHref(source) {
    const base = encodeURI(source.file);
    if (source.kind === 'pdf' && source.page) {
      return `${base}#page=${source.page}`;
    }
    return base;
  }

  function sourcePayload(source) {
    return encodeURIComponent(JSON.stringify({
      href: `${sourceHref(source)}&toolbar=0`,
      title: `${source.week} ${source.place}`,
      kind: source.kind
    }));
  }

  function renderSources(sources) {
    return sources.map((source, index) => `
      <article class="source-card">
        <div class="source-info">
          <div class="source-title-row">
            <div>
              <strong>${source.week} · ${source.place}</strong>
              <span>${source.topic}</span>
              <span>${source.file}</span>
            </div>
            <button class="source-toggle" data-source='${sourcePayload(source)}' type="button" aria-expanded="false" aria-label="展开课件内容">&lt;</button>
          </div>
          <a class="source-link" href="${sourceHref(source)}" target="_blank" rel="noreferrer">打开原课件</a>
        </div>
        <div class="source-preview-shell" data-loaded="false">
          <div class="source-placeholder">点击右上角 <strong>&lt;</strong> 展开课件内容预览</div>
        </div>
      </article>
    `).join('');
  }

  function renderToc(items) {
    const parts = ['流变学', '成型加工'];
    tocEl.innerHTML = parts.map((part) => {
      const partItems = items.filter((item) => item.part === part);
      if (!partItems.length) return '';
      return `
        <section class="toc-group">
          <h2 class="toc-group-title">${part}</h2>
          ${partItems.map((item) => {
            const isFav = favorites.has(item.id);
            return `
              <div class="toc-item" data-toc-id="${item.id}">
                <a class="toc-link" href="#${item.id}">
                  <span class="toc-title">${item.id} ${item.title}</span>
                  <span class="toc-meta">${item.sources.map((source) => source.week).join(' / ')}</span>
                  <span class="toc-type">${item.type}</span>
                </a>
                <button class="toc-star ${isFav ? 'is-fav' : ''}" data-fav="${item.id}" type="button" aria-label="收藏 ${item.id}">${isFav ? '★' : '☆'}</button>
              </div>
            `;
          }).join('')}
        </section>
      `;
    }).join('');
  }

  function renderCards(items) {
    cardsEl.innerHTML = items.map((item) => {
      const isFav = favorites.has(item.id);
      return `
        <article id="${item.id}" class="card">
          <div class="card-head">
            <div>
              <h3>${item.id}. ${item.title}</h3>
              <div class="badges">
                <span class="badge part">${item.part}</span>
                <span class="badge type">${item.type}</span>
                <span class="badge">${item.category}</span>
                <span class="badge">${item.sources.length} 个课件来源</span>
              </div>
            </div>
            <button class="fav-button ${isFav ? 'is-fav' : ''}" data-fav="${item.id}" type="button">${isFav ? '已收藏' : '收藏'}</button>
          </div>

          <section class="section-block">
            <h4>原题目</h4>
            <p>${highlight(item.question)}</p>
          </section>

          <section class="section-block">
            <h4>题目分析</h4>
            <p>${highlight(item.analysis)}</p>
          </section>

          <section class="section-block">
            <h4>题目解答</h4>
            <ul>${item.answer.map((line) => `<li>${highlight(line)}</li>`).join('')}</ul>
          </section>

          <section class="section-block">
            <h4>答案内容来自的课件部分</h4>
            <div class="source-grid">${renderSources(item.sources)}</div>
          </section>
        </article>
      `;
    }).join('');
  }

  function renderCourseMap() {
    const data = window.COURSE_MAP;
    if (!courseMapEl || !data) return;

    courseMapEl.innerHTML = `
      <div class="map-head">
        <p class="eyebrow">Course Map</p>
        <h2>课程体系脉络</h2>
        <p>${data.thesis.summary}</p>
      </div>

      <div class="chain-card">
        <h3>${data.thesis.title}</h3>
        <div class="chain-flow">
          ${data.thesis.chain.map((step, index) => `
            <span class="chain-step">
              <strong>${index + 1}</strong>${step}
            </span>
          `).join('')}
        </div>
      </div>

      <div class="pillar-grid">
        ${data.pillars.map((pillar) => `
          <article class="pillar-card">
            <h3>${pillar.title}</h3>
            <ul>${pillar.points.map((point) => `<li>${point}</li>`).join('')}</ul>
          </article>
        `).join('')}
      </div>

      <div class="timeline-block">
        <div class="block-title">
          <p class="eyebrow">Weeks</p>
          <h3>周次主线</h3>
        </div>
        <div class="week-timeline">
          ${data.weeks.map((week) => `
            <article class="week-card">
              <div class="week-index">${week.week}</div>
              <div>
                <h4>${week.title}</h4>
                <p>${week.role}</p>
                <div class="keyword-row">${week.keywords.map((keyword) => `<span>${keyword}</span>`).join('')}</div>
                <small>${week.file}</small>
              </div>
            </article>
          `).join('')}
        </div>
      </div>

      <div class="framework-grid">
        <div class="block-title full-row">
          <p class="eyebrow">How To Think</p>
          <h3>做题与分析框架</h3>
        </div>
        ${data.frameworks.map((framework) => `
          <article class="framework-card">
            <h4>${framework.title}</h4>
            <p>${framework.method}</p>
          </article>
        `).join('')}
      </div>

      <div class="review-handles">
        <h3>复习抓手</h3>
        <ol>${data.reviewHandles.map((handle) => `<li>${handle}</li>`).join('')}</ol>
      </div>
    `;
  }

  function render() {
    const items = getVisibleItems();
    renderToc(items);
    renderCards(items);
    resultCount.textContent = `显示 ${items.length} / ${window.REVIEW_DATA.length} 题，已收藏 ${favorites.size} 题`;
    emptyState.hidden = items.length > 0;
    setupCardObserver();
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([cardsEl]).catch(() => {});
    }
  }

  function setFilter(filter) {
    activeFilter = filter;
    filterButtons.forEach((item) => item.classList.toggle('active', item.dataset.filter === filter));
    if (filterSegment) filterSegment.dataset.active = filter;
    render();
  }

  function setSection(section) {
    sectionLinks.forEach((item) => item.classList.toggle('active', item.dataset.sectionLink === section));
    if (sectionSegment) sectionSegment.dataset.active = section;
  }

  function setupSectionObserver() {
    if (!contentPanel) return;
    if (sectionObserver) sectionObserver.disconnect();
    sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      setSection(visible.target.id === 'courseMap' ? 'course' : 'questions');
    }, { root: contentPanel, threshold: [0.25, 0.5, 0.75] });
    ['courseMap', 'questionBank'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });
  }

  function setupCardObserver() {
    if (!contentPanel) return;
    if (cardObserver) cardObserver.disconnect();
    const cards = Array.from(document.querySelectorAll('.card'));
    if (!cards.length) return;
    cardObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      document.querySelectorAll('.toc-item.active').forEach((item) => item.classList.remove('active'));
      const tocItem = document.querySelector(`[data-toc-id="${id}"]`);
      if (tocItem) {
        tocItem.classList.add('active');
        tocItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, { root: contentPanel, threshold: [0.35, 0.6] });
    cards.forEach((card) => cardObserver.observe(card));
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setFilter(button.dataset.filter);
    });
  });

  searchButton.addEventListener('click', () => {
    committedSearch = searchInput.value.trim();
    render();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      committedSearch = searchInput.value.trim();
      render();
    }
  });

  exportFavoritesButton.addEventListener('click', exportFavorites);

  document.addEventListener('click', (event) => {
    const sourceButton = event.target.closest('.source-toggle');
    if (sourceButton) {
      const shell = sourceButton.closest('.source-card')?.querySelector('.source-preview-shell');
      if (!shell) return;
      const expanded = sourceButton.getAttribute('aria-expanded') === 'true';
      sourceButton.setAttribute('aria-expanded', String(!expanded));
      shell.classList.toggle('open', !expanded);
      sourceButton.classList.toggle('open', !expanded);
      if (!expanded && shell.dataset.loaded === 'false') {
        const source = JSON.parse(decodeURIComponent(sourceButton.dataset.source));
        if (source.kind === 'pdf') {
          shell.innerHTML = `<iframe class="pdf-preview" title="${source.title}" src="${source.href}"></iframe>`;
        } else {
          shell.innerHTML = '<div class="ppt-note">该课件无法直接内嵌预览，请点击“打开原课件”。</div>';
        }
        shell.dataset.loaded = 'true';
      }
      return;
    }

    const button = event.target.closest('[data-fav]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(button.dataset.fav);
  });

  function init() {
    renderCourseMap();
    setupSectionObserver();
    render();
  }

  init();
})();
