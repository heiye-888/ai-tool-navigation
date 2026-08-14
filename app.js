(function () {
  'use strict';

  const categoryMap = Object.fromEntries(CATEGORIES.map((cat) => [cat.key, cat]));
  const STORAGE_KEYS = {
    favorites: 'ai-nav-favorites',
    theme: 'ai-nav-theme'
  };

  const state = {
    query: '',
    category: 'all',
    filter: 'all',
    sort: 'recommend',
    favorites: new Set(loadFavorites()),
    theme: loadTheme()
  };

  const els = {
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    quickSearches: document.getElementById('quickSearches'),
    categoryChips: document.getElementById('categoryChips'),
    filterGroup: document.getElementById('filterGroup'),
    sortSelect: document.getElementById('sortSelect'),
    hotSection: document.getElementById('hotSection'),
    hotTrack: document.getElementById('hotTrack'),
    hotPrev: document.getElementById('hotPrev'),
    hotNext: document.getElementById('hotNext'),
    toolGrid: document.getElementById('toolGrid'),
    emptyState: document.getElementById('emptyState'),
    resetBtn: document.getElementById('resetBtn'),
    catalogTitle: document.getElementById('catalogTitle'),
    resultCount: document.getElementById('resultCount'),
    footerCount: document.getElementById('footerCount'),
    statTools: document.getElementById('statTools'),
    statCats: document.getElementById('statCats'),
    statHot: document.getElementById('statHot'),
    statCn: document.getElementById('statCn'),
    favCount: document.getElementById('favCount'),
    favoriteBtn: document.getElementById('favoriteBtn'),
    themeBtn: document.getElementById('themeBtn'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    toast: document.getElementById('toast'),
    backToTop: document.getElementById('backToTop')
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function icon(name) {
    return '<i data-lucide="' + name + '"></i>';
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]');
    } catch (error) {
      return [];
    }
  }

  function saveFavorites() {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...state.favorites]));
  }

  function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    els.themeBtn.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    refreshIcons();
  }

  function categoryOf(tool) {
    return categoryMap[tool.category] || { label: tool.category || '其他', color: '#5f6b66' };
  }

  function initialOf(tool) {
    const letter = String(tool.name).trim().charAt(0);
    return letter.toUpperCase();
  }

  function matchesTool(tool) {
    if (state.category !== 'all' && tool.category !== state.category) {
      return false;
    }

    const query = state.query.trim().toLowerCase();
    if (query) {
      const haystack = [
        tool.name,
        tool.desc,
        tool.price,
        categoryOf(tool).label,
        ...(tool.tags || []),
        ...(tool.features || [])
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (state.filter === 'favorites') {
      return state.favorites.has(tool.id);
    }
    if (state.filter === 'free') {
      return tool.price.indexOf('免费') !== -1;
    }
    if (state.filter === 'open') {
      return (tool.tags || []).indexOf('开源') !== -1 || tool.price === '开源';
    }
    if (state.filter === 'cn') {
      return (tool.tags || []).indexOf('国产') !== -1;
    }
    if (state.filter === 'oversea') {
      return (tool.tags || []).indexOf('海外') !== -1;
    }
    return true;
  }

  function sortedTools(list) {
    const copy = list.slice();
    if (state.sort === 'rating') {
      copy.sort((a, b) => b.rating - a.rating);
    } else if (state.sort === 'traffic') {
      copy.sort((a, b) => b.traffic - a.traffic);
    } else if (state.sort === 'newest') {
      copy.sort((a, b) => String(b.added).localeCompare(String(a.added)));
    } else {
      copy.sort((a, b) => {
        if (!!a.hot !== !!b.hot) {
          return a.hot ? -1 : 1;
        }
        return b.traffic - a.traffic;
      });
    }
    return copy;
  }

  function visibleTools() {
    return sortedTools(TOOLS.filter(matchesTool));
  }

  function tagClass(tag) {
    if (tag === '免费' || tag === '免费额度') {
      return 'free';
    }
    if (tag === '开源') {
      return 'open';
    }
    if (tag === '国产') {
      return 'home';
    }
    if (tag === '海外') {
      return 'global';
    }
    return 'paid';
  }

  function toolTags(tool) {
    const list = [tool.price];
    (tool.tags || []).forEach(function (tag) {
      if (list.indexOf(tag) === -1) {
        list.push(tag);
      }
    });
    return list;
  }

  function ratingStars(rating) {
    return Number(rating).toFixed(1);
  }

  function cardHtml(tool, index) {
    const cat = categoryOf(tool);
    const active = state.favorites.has(tool.id) ? ' is-active' : '';
    const tags = toolTags(tool)
      .map(function (tag) {
        return '<span class="tag ' + tagClass(tag) + '">' + escapeHtml(tag) + '</span>';
      })
      .join('');

    return (
      '<article class="tool-card" data-tool-id="' + tool.id + '" style="--card-color:' + escapeHtml(cat.color) + ';--card-index:' + Math.min(index, 14) + '">' +
        '<div class="card-top">' +
          '<span class="avatar" style="background:' + escapeHtml(tool.color) + ';--avatar-color:' + escapeHtml(tool.color) + '">' + escapeHtml(initialOf(tool)) + '</span>' +
          '<div class="card-title-wrap">' +
            '<h3 class="card-title"><span class="card-title-name">' + escapeHtml(tool.name) + '</span></h3>' +
            '<div class="card-category">' + escapeHtml(cat.label) + ' · ' + escapeHtml(tool.price) + '</div>' +
          '</div>' +
          (tool.hot ? '<span class="hot-flag">热门</span>' : '') +
        '</div>' +
        '<p class="card-desc">' + escapeHtml(tool.desc) + '</p>' +
        '<div class="card-tags">' + tags + '</div>' +
        '<div class="card-footer">' +
          '<div class="card-meta">' +
            '<span class="meta-item">' + icon('star') + ratingStars(tool.rating) + '</span>' +
            '<span class="meta-item">' + icon('flame') + tool.traffic + '</span>' +
          '</div>' +
          '<div class="card-actions card-actions-bottom">' +
            '<button class="icon-btn' + active + '" type="button" data-action="fav" data-tool-id="' + tool.id + '" aria-label="收藏 ' + escapeHtml(tool.name) + '" title="收藏">' + icon('heart') + '</button>' +
            '<a class="icon-btn" href="' + escapeHtml(tool.url) + '" target="_blank" rel="noopener noreferrer" aria-label="打开 ' + escapeHtml(tool.name) + ' 官网" title="打开官网">' + icon('arrow-up-right') + '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function hotCardHtml(tool) {
    const cat = categoryOf(tool);
    return (
      '<button class="hot-card" type="button" data-open-tool="' + tool.id + '" style="--hot-color:' + escapeHtml(tool.color) + '">' +
        '<span class="hot-avatar" style="background:' + escapeHtml(tool.color) + '">' + escapeHtml(initialOf(tool)) + '</span>' +
        '<span class="hot-info">' +
          '<strong>' + escapeHtml(tool.name) + '</strong>' +
          '<span>' + escapeHtml(cat.label) + ' · ' + ratingStars(tool.rating) + ' 分</span>' +
        '</span>' +
        '<i data-lucide="arrow-right" class="arrow"></i>' +
      '</button>'
    );
  }

  function renderChips() {
    const allCount = TOOLS.length;
    const chipParts = [
      '<button class="chip' + (state.category === 'all' ? ' active' : '') + '" type="button" data-cat="all" style="--chip-color:var(--accent)">' +
        '<span class="chip-dot" style="background:var(--accent)"></span>' +
        '<span>全部</span><span class="chip-count">' + allCount + '</span>' +
      '</button>'
    ];

    CATEGORIES.forEach(function (cat) {
      const count = TOOLS.filter(function (tool) { return tool.category === cat.key; }).length;
      chipParts.push(
        '<button class="chip' + (state.category === cat.key ? ' active' : '') + '" type="button" data-cat="' + cat.key + '" style="--chip-color:' + cat.color + '">' +
          '<span class="chip-dot" style="background:' + cat.color + '"></span>' +
          '<span>' + escapeHtml(cat.label) + '</span><span class="chip-count">' + count + '</span>' +
        '</button>'
      );
    });

    els.categoryChips.innerHTML = chipParts.join('');
  }

  function renderHot() {
    const hotTools = sortedTools(TOOLS.filter(function (tool) { return tool.hot; })).slice(0, 10);
    els.hotTrack.innerHTML = hotTools.map(hotCardHtml).join('');
    refreshIcons();
    startHotAuto();
  }

  function hotStepSize() {
    const card = els.hotTrack.querySelector('.hot-card');
    if (!card) {
      return 0;
    }
    const gap = parseFloat(getComputedStyle(els.hotTrack).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function hotMaxScroll() {
    return Math.max(0, els.hotTrack.scrollWidth - els.hotTrack.clientWidth);
  }

  function scrollHotTo(left) {
    els.hotTrack.scrollTo({ left: left, behavior: 'smooth' });
  }

  function nextHot() {
    const max = hotMaxScroll();
    const next = els.hotTrack.scrollLeft + hotStepSize();
    scrollHotTo(next >= max - 1 ? 0 : next);
  }

  function prevHot() {
    const max = hotMaxScroll();
    const prev = els.hotTrack.scrollLeft - hotStepSize();
    scrollHotTo(prev <= 0 ? max : prev);
  }

  let hotAutoTimer = null;
  const HOT_AUTO_DELAY = 3800;
  const HOT_AUTO_START_DELAY = 700;

  function stopHotAuto() {
    clearTimeout(hotAutoTimer);
    hotAutoTimer = null;
  }

  function restartHotAuto(delay) {
    stopHotAuto();
    hotAutoTimer = setTimeout(function tick() {
      nextHot();
      hotAutoTimer = setTimeout(tick, HOT_AUTO_DELAY);
    }, delay);
  }

  function startHotAuto() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    restartHotAuto(HOT_AUTO_START_DELAY);
  }

  function renderGrid() {
    const list = visibleTools();
    els.toolGrid.innerHTML = list.map(function (tool, index) {
      return cardHtml(tool, index);
    }).join('');
    els.emptyState.hidden = list.length !== 0;
    els.resultCount.textContent = '共 ' + list.length + ' 款工具';
    els.catalogTitle.textContent = catalogTitleText();
    refreshIcons();
  }

  function catalogTitleText() {
    if (state.filter === 'favorites') {
      return '我的收藏';
    }
    if (state.query.trim()) {
      return '搜索结果';
    }
    if (state.category === 'all') {
      return '全部工具';
    }
    return categoryMap[state.category].label + '工具';
  }

  function renderFavoritesBadge() {
    els.favCount.hidden = state.favorites.size === 0;
    els.favCount.textContent = String(state.favorites.size);
    document.querySelectorAll('.icon-btn[data-action="fav"]').forEach(function (btn) {
      btn.classList.toggle('is-active', state.favorites.has(btn.dataset.toolId));
    });
  }

  function render() {
    renderChips();
    renderHot();
    renderGrid();
    renderFavoritesBadge();
    els.footerCount.textContent = String(TOOLS.length);
    els.statTools.textContent = String(TOOLS.length);
    els.statCats.textContent = String(CATEGORIES.length);
    els.statHot.textContent = String(Math.min(TOOLS.filter(function (tool) { return tool.hot; }).length, 10));
    els.statCn.textContent = String(TOOLS.filter(function (tool) {
      return (tool.tags || []).indexOf('国产') !== -1;
    }).length);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      els.toast.classList.remove('show');
    }, 1800);
  }

  function toggleFavorite(id) {
    const tool = TOOLS.find(function (item) { return item.id === id; });
    if (!tool) {
      return;
    }
    const isFav = state.favorites.has(id);
    if (isFav) {
      state.favorites.delete(id);
      showToast('已取消收藏 ' + tool.name);
    } else {
      state.favorites.add(id);
      showToast('已收藏 ' + tool.name);
    }
    saveFavorites();
    renderFavoritesBadge();
    const modalFav = document.getElementById('modalFav');
    if (modalFav) {
      modalFav.classList.toggle('is-active', state.favorites.has(id));
    }
  }

  function relatedTools(tool) {
    return sortedTools(TOOLS.filter(function (item) {
      return item.category === tool.category && item.id !== tool.id;
    })).slice(0, 6);
  }

  function modalHtml(tool) {
    const cat = categoryOf(tool);
    const active = state.favorites.has(tool.id) ? ' is-active' : '';
    const tags = toolTags(tool)
      .map(function (tag) {
        return '<span class="tag ' + tagClass(tag) + '">' + escapeHtml(tag) + '</span>';
      })
      .join('');
    const features = (tool.features || []).map(function (item) {
      return '<li>' + icon('check') + escapeHtml(item) + '</li>';
    }).join('');
    const related = relatedTools(tool).map(function (item) {
      return (
        '<a class="related-item" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="hot-avatar" style="background:' + escapeHtml(item.color) + '">' + escapeHtml(initialOf(item)) + '</span>' +
          '<span>' + escapeHtml(item.name) + '</span>' +
        '</a>'
      );
    }).join('');

    return (
      '<div class="modal-head">' +
        '<span class="avatar" style="background:' + escapeHtml(tool.color) + '">' + escapeHtml(initialOf(tool)) + '</span>' +
        '<div>' +
          '<h2 id="modalName">' + escapeHtml(tool.name) + '</h2>' +
          '<div class="sub">' + escapeHtml(cat.label) + ' · ' + escapeHtml(tool.price) + '</div>' +
        '</div>' +
      '</div>' +
      '<p class="modal-desc">' + escapeHtml(tool.desc) + '</p>' +
      '<div class="modal-section">' +
        '<h3>核心能力</h3>' +
        '<ul class="feature-list">' + features + '</ul>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>基本信息</h3>' +
        '<div class="modal-meta">' +
          '<div class="meta-box"><span>评分</span><strong>' + ratingStars(tool.rating) + ' / 5.0</strong></div>' +
          '<div class="meta-box"><span>热度</span><strong>' + tool.traffic + '</strong></div>' +
          '<div class="meta-box"><span>收录时间</span><strong>' + escapeHtml(tool.added) + '</strong></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3>标签</h3>' +
        '<div class="modal-tags">' + tags + '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<a class="primary-btn" href="' + escapeHtml(tool.url) + '" target="_blank" rel="noopener noreferrer">' + icon('external-link') + '打开官网</a>' +
        '<button class="icon-btn' + active + '" id="modalFav" type="button" data-tool-id="' + tool.id + '" aria-label="收藏 ' + escapeHtml(tool.name) + '" title="收藏">' + icon('heart') + '</button>' +
      '</div>' +
      (related.length ? '<h3 class="related-head">同类工具</h3><div class="related-grid">' + related + '</div>' : '')
    );
  }

  function openModal(id) {
    const tool = TOOLS.find(function (item) { return item.id === id; });
    if (!tool) {
      return;
    }
    els.modalBody.innerHTML = modalHtml(tool);
    const modal = els.modalBody.closest('.modal');
    if (modal) {
      modal.style.setProperty('--modal-color', categoryOf(tool).color);
    }
    els.modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    refreshIcons();
  }

  function closeModal() {
    els.modalBackdrop.hidden = true;
    document.body.style.overflow = '';
  }

  els.searchInput.addEventListener('input', function () {
    state.query = els.searchInput.value;
    els.clearSearch.hidden = !state.query;
    renderGrid();
  });

  els.clearSearch.addEventListener('click', function () {
    state.query = '';
    els.searchInput.value = '';
    els.clearSearch.hidden = true;
    renderGrid();
    els.searchInput.focus();
  });

  els.quickSearches.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-query]');
    if (!btn) {
      return;
    }
    state.query = btn.dataset.query;
    els.searchInput.value = btn.dataset.query;
    els.clearSearch.hidden = false;
    renderGrid();
    document.querySelector('.catalog-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.categoryChips.addEventListener('click', function (event) {
    const chip = event.target.closest('[data-cat]');
    if (!chip) {
      return;
    }
    state.category = chip.dataset.cat;
    render();
  });

  els.filterGroup.addEventListener('click', function (event) {
    const pill = event.target.closest('[data-filter]');
    if (!pill) {
      return;
    }
    state.filter = pill.dataset.filter;
    els.filterGroup.querySelectorAll('.filter-pill').forEach(function (item) {
      item.classList.toggle('active', item === pill);
    });
    renderGrid();
  });

  els.sortSelect.addEventListener('change', function () {
    state.sort = els.sortSelect.value;
    renderGrid();
    renderHot();
  });

  els.resetBtn.addEventListener('click', function () {
    state.query = '';
    state.category = 'all';
    state.filter = 'all';
    els.searchInput.value = '';
    els.clearSearch.hidden = true;
    els.sortSelect.value = 'recommend';
    state.sort = 'recommend';
    els.filterGroup.querySelectorAll('.filter-pill').forEach(function (item) {
      item.classList.toggle('active', item.dataset.filter === 'all');
    });
    render();
  });

  els.hotTrack.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-open-tool]');
    if (btn) {
      openModal(btn.dataset.openTool);
    }
  });

  els.hotPrev.addEventListener('click', function () {
    prevHot();
    stopHotAuto();
  });

  els.hotNext.addEventListener('click', function () {
    nextHot();
    stopHotAuto();
  });

  els.hotSection.addEventListener('mouseenter', stopHotAuto);
  els.hotSection.addEventListener('mouseleave', startHotAuto);
  els.hotSection.addEventListener('focusin', stopHotAuto);
  els.hotSection.addEventListener('focusout', startHotAuto);
  els.hotTrack.addEventListener('touchstart', stopHotAuto, { passive: true });
  els.hotTrack.addEventListener('touchend', function () {
    setTimeout(startHotAuto, 2600);
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopHotAuto();
    } else {
      startHotAuto();
    }
  });

  els.toolGrid.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      return;
    }
    const favBtn = event.target.closest('[data-action="fav"]');
    if (favBtn) {
      toggleFavorite(favBtn.dataset.toolId);
      return;
    }
    const card = event.target.closest('[data-tool-id]');
    if (card) {
      openModal(card.dataset.toolId);
    }
  });

  els.toolGrid.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const card = event.target.closest('[data-tool-id]');
    if (card && !event.target.closest('a, button')) {
      event.preventDefault();
      openModal(card.dataset.toolId);
    }
  });

  els.favoriteBtn.addEventListener('click', function () {
    state.filter = 'favorites';
    els.filterGroup.querySelectorAll('.filter-pill').forEach(function (item) {
      item.classList.toggle('active', item.dataset.filter === 'favorites');
    });
    renderGrid();
    document.querySelector('.catalog-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.themeBtn.addEventListener('click', function () {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  els.backToTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', function () {
    els.backToTop.hidden = window.scrollY < 600;
  }, { passive: true });

  els.modalClose.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', function (event) {
    if (event.target === els.modalBackdrop) {
      closeModal();
    }
  });

  els.modalBody.addEventListener('click', function (event) {
    const favBtn = event.target.closest('#modalFav');
    if (favBtn) {
      toggleFavorite(favBtn.dataset.toolId);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !els.modalBackdrop.hidden) {
      closeModal();
    }
  });

  applyTheme(state.theme);
  render();
})();
