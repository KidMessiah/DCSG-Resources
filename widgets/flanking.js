/*
Flanking Tool - plain DOM/CSS grid, no canvas library.

Tokens are positioned with percentage left/top/width/height inside a
position:relative board, so the whole thing is responsive for free -
there is no pixel math to recompute on resize, unlike a canvas-based
version of this. Placing/moving tokens uses ordinary click and native
HTML5 drag-and-drop instead of manual pointer tracking.
*/
window.renderWidget = function(container) {
  const GRID_SIZE = 12;

  // --- Icon glyphs (game-icons.net, CC BY 3.0 - see images/icons/ATTRIBUTION.md) ---
  const ICONS = {
    shield: '<svg viewBox="0 0 256 256"><circle cx="128" cy="128" r="101" fill="none" stroke="currentColor" stroke-width="18"/><path fill="currentColor" d="M64 94l64-38 64 38c0 32-48 108-64 108-16 .25-64-76-64-108z"/></svg>',
    skull: '<svg viewBox="0 0 256 256"><circle cx="128" cy="128" r="101" fill="none" stroke="currentColor" stroke-width="18"/><path fill="currentColor" d="M128 58c-32 0-64 16-64 37.838C64 154 96 142 96 142l-6 24h76l-6-24s32 12 32-52c0-16-32-32-64-32zm-26 38a16 16 0 0 1 16 16 16 16 0 0 1-16 16 16 16 0 0 1-16-16 16 16 0 0 1 16-16zm52 0a16 16 0 0 1 16 16 16 16 0 0 1-16 16 16 16 0 0 1-16-16 16 16 0 0 1 16-16zm-26 34l10 26h-20l10-26zm-28 51.002v17.996h56v-17.996h-56z"/></svg>',
    eye: '<svg viewBox="0 0 256 256"><circle cx="128" cy="128" r="101" fill="none" stroke="currentColor" stroke-width="18"/><path fill="currentColor" d="M128 68c-28 0-56 20-80 60 48 80 112 80 160 0-24-40-52-60-80-60zm0 22c20.9 0 38 17.1 38 38s-17.1 38-38 38-38-17.1-38-38c0-8.3 2.72-16.1 7.31-22.3A16 16 0 0 0 96 112a16 16 0 0 0 16 16 16 16 0 0 0 16-16 16 16 0 0 0-16-16 16 16 0 0 0-6.4 1.35c6.3-4.61 14-7.35 22.4-7.35z"/></svg>',
    move: '<svg viewBox="0 0 512 512"><path fill="currentColor" d="M256 34.47l-90.51 90.51h67.883v108.393H124.98V165.49L34.47 256l90.51 90.51v-67.883h108.393V387.02H165.49L256 477.53l90.51-90.51h-67.883V278.627H387.02v67.883L477.53 256l-90.51-90.51v67.883H278.627V124.98h67.883L256 34.47z"/></svg>',
    trash: '<svg viewBox="0 0 512 512"><path fill="currentColor" d="M199 103v50h-78v30h270v-30h-78v-50H199zm18 18h78v32h-78v-32zm-79.002 80l30.106 286h175.794l30.104-286H137.998zm62.338 13.38l.64 8.98 16 224 .643 8.976-17.956 1.283-.64-8.98-16-224-.643-8.976 17.956-1.283zm111.328 0l17.955 1.284-.643 8.977-16 224-.64 8.98-17.956-1.284.643-8.977 16-224 .64-8.98zM247 215h18v242h-18V215z"/></svg>',
    swap: '<svg viewBox="0 0 512 512"><path fill="currentColor" d="M258.148 20.822c-1.112.008-2.226.026-3.343.055-39.32 1.041-81.507 15.972-123.785 50.404l-6.028 4.91-5.732-5.25c-12.644-11.578-20.276-27.633-25.653-43.716-8.974 36.98-14.631 81.385-9.232 114.523 18.065.908 45.409-2.177 73.7-7.818 17.858-3.561 36.048-8.126 53.064-13.072-13.419-2.911-25.896-6.882-38.143-12.082l-16.088-6.832 14.906-9.127c46.367-28.393 80.964-40.686 120.235-35.553 33.105 4.327 69.357 20.867 119.066 47.271-25.373-36.314-62.243-64.737-104.728-76.994-15.402-4.443-31.553-6.828-48.239-6.719zM346 116c-46.667 0-46.666 0-46.666 46.666V349.4c0 9.596.007 17.19.414 23.242a664.804 664.804 0 0 1 50.656-12.223c24.649-4.915 48.367-8.224 67.916-8.41 6.517-.062 12.571.224 18.041.912l6.31.793 1.358 6.213c2.464 11.265 3.673 23.447 3.914 36.059 38.032-.19 38.057-3.06 38.057-46.65V162.665C486 116 486 116 439.334 116a226.98 226.98 0 0 1 3.978 7.64l12.624 25.536-25.004-13.648c-13.085-7.143-25.164-13.632-36.452-19.528zm-281.943.016c-38.032.19-38.057 3.06-38.057 46.65V349.4C26 396 26 396 72.666 396a226.98 226.98 0 0 1-3.978-7.64l-12.624-25.536 25.004 13.649c13.085 7.142 25.164 13.632 36.452 19.527H166c46.667 0 46.666 0 46.666-46.666V162.666c0-9.626-.006-17.24-.416-23.304a664.811 664.811 0 0 1-50.654 12.22c-32.865 6.554-64.077 10.25-85.957 7.498l-6.31-.793-1.358-6.213c-2.464-11.265-3.673-23.446-3.914-36.058zm354.619 254.078c-17.543.25-40.826 3.206-64.75 7.977-17.859 3.56-36.05 8.125-53.065 13.072 13.419 2.91 25.896 6.881 38.143 12.082l16.088 6.832-14.906 9.127c-46.367 28.392-80.964 40.685-120.235 35.553-33.105-4.327-69.357-20.868-119.066-47.272 25.373 36.315 62.243 64.738 104.728 76.994 52.573 15.166 113.872 6.343 175.367-43.74l6.028-4.91 5.732 5.25c12.644 11.579 20.276 27.633 25.653 43.717 8.974-36.981 14.631-81.386 9.232-114.524-2.788-.14-5.748-.204-8.95-.158z"/></svg>',
    broom: '<svg viewBox="0 0 512 512"><path fill="currentColor" d="M153.654 18l52.57 134.734c1.698 3.994 4.05 5.83 7.243 6.977 3.2 1.15 7.36 1.2 11.058.17 3.698-1.03 6.71-3.146 7.996-4.915 1.288-1.77 1.634-2.564.505-5.24l-.046-.112L181.57 18h-27.916zm94.168 120.143l1.88 4.81-.09-.223c3.346 7.937 1.828 16.822-2.532 22.82-4.36 5.996-10.773 9.734-17.723 11.67-6.95 1.937-14.653 2.065-21.98-.57-7.327-2.634-14.155-8.447-17.742-16.923l-.05-.118-1.757-4.5c-31.31 19.804-42.47 42.026-35.367 68.89 1.24 4.681 3.422 12.364 5.964 22.13 74.37-5.274 139.945-23.872 199.808-51.6-10.297-13.867-22.5-25.83-38.232-34.53-20.505-11.34-47.652-20.157-72.178-21.857zm120.557 71.52c-61.497 28.81-129.173 48.378-205.575 54.196 2.03 8.683 4.08 18.28 5.95 28.495 89.592-10.084 163.043-26.22 217.755-48.767-5.743-11.72-11.593-23.19-18.13-33.924zm26.04 50.16c-57.093 23.772-131.99 40.087-222.73 50.322C180.697 371.423 179.614 446.752 128 480c16.27 0 31.892-.152 46.926-.45 17.84-25.554 31.27-66.222 32.08-86.146 8.27 16.793 3.297 59.32-5.36 85.434 2.735-.093 5.435-.193 8.127-.297 11.824-12.397 11.724-28.632 14.72-47.284 3.324 14.92 7 32.967 9.505 46.156 11.273-.616 22.152-1.34 32.606-2.183 16.38-20.358 21.65-49.604 18.63-85.48 4.226 29.1 9.116 62.138 11.873 82.55 9.662-1.083 18.925-2.29 27.807-3.614 5.04-18.787-4.1-48.444-2.072-69.54 11.123 43.113 22.247 55.45 33.37 64.043 5.42-1.115 10.655-2.293 15.733-3.526-4.7-13.95 1.573-22.497 1.18-39.986 5.647 18.99 14.625 26.958 24.428 32.816 6.506-2.1 12.66-4.336 18.492-6.697-10.538-6.57-10.113-26.374-12.38-42.926 5.954 21.703 14.413 32.418 24.083 37.816 29.124-13.8 48.69-31.534 60.398-53.657-9.078-3.82-18.674-13.002-28.068-20.092 13.214 7.477 23.684 10.614 32.37 10.93 1.323-3.206 2.514-6.49 3.552-9.868-56.326-19.528-80.07-64.018-101.58-108.178z"/></svg>',
    book: '<svg viewBox="0 0 512 512"><path fill="currentColor" d="M149.688 85.625c-1.234.005-2.465.033-3.72.063-33.913.806-75.48 10.704-127.25 33.718V362.78c60.77-28.82 106.718-37.067 144.22-33.092 33.502 3.55 59.685 16.66 83.562 31.187v-242.97c-23.217-17.744-50.195-30.04-85.97-32-3.52-.192-7.142-.296-10.843-.28zm211.968 0c-3.7-.016-7.322.088-10.844.28-35.773 1.96-62.75 14.256-85.968 32v242.97c23.876-14.527 50.06-27.637 83.562-31.188 37.502-3.974 83.45 4.272 144.22 33.094V119.407c-51.77-23.014-93.337-32.912-127.25-33.72-1.255-.028-2.486-.056-3.72-.06z"/></svg>',
    target: '<svg viewBox="0 0 512 512"><path fill="currentColor" d="M256 96a160 160 0 1 0 .001 320.001A160 160 0 0 0 256 96zm0 40a120 120 0 1 1-.001 240.001A120 120 0 0 1 256 136zm0 50a70 70 0 1 0 .001 140.001A70 70 0 0 0 256 186zM40 236v40h60v-40H40zm372 0v40h60v-40h-60zM236 40h40v60h-40V40zm0 372h40v60h-40v-60z"/></svg>'
  };

  function icon(name, extraClass) {
    return `<span class="ft-icon${extraClass ? ' ' + extraClass : ''}">${ICONS[name]}</span>`;
  }

  // --- State ---
  let tokens = [];
  let nextId = 1;
  let armedSize = null;
  let draggingId = null;
  let hoveredId = null;
  let popover = null; // { kind: 'team' | 'menu', tokenId }
  let diagonalFlankingEnabled = false;

  // --- Build widget shell ---
  container.classList.add('flanking-tool');
  container.innerHTML = `
    <div class="ft-column ft-instructions">
      <p>Pick a token size, then click an empty square to place it and choose its team.</p>
      <p>Drag a placed token to move it. Click a token to delete it, swap its team, or toggle 6th sense. Hover a token to preview whether it can flank anything adjacent.</p>
      <p class="ft-credit">Icons by game-icons.net (CC BY 3.0).</p>
    </div>
    <div class="ft-column ft-board-column">
      <div class="ft-top-row">
        <div class="ft-palette" id="ft-palette"></div>
        <button type="button" id="ft-clear" class="ft-clear-btn">${icon('broom')} Clear</button>
      </div>
      <div class="ft-toolbar-secondary">
        <label class="ft-toggle">
          <input type="checkbox" id="ft-diagonal-toggle">
          ${icon('target')} Diagonal flanking
        </label>
        <select id="ft-examples">
          <option value="">Load example&hellip;</option>
          <option value="basic">Basic flanking</option>
          <option value="multi">Multi-side</option>
          <option value="sameside">Same-side allies</option>
          <option value="counter">Counter-flanking</option>
          <option value="sixthsense">6th sense</option>
          <option value="diagonal">Diagonal</option>
        </select>
      </div>
      <div class="ft-board-wrap">
        <div class="ft-board" id="ft-board"></div>
      </div>
      <p class="ft-hint" id="ft-hint">Select a size above, then click the grid.</p>
    </div>
    <div class="ft-column ft-rules">
      <h3>Flanking Rules</h3>
      <p>This optional rule rewards tactical cooperation by providing attack roll bonuses when multiple creatures surround an enemy.</p>
      <ul>
        <li>When you have an ally on the opposite side of a creature, you gain a +2 bonus to melee attack rolls against that creature.</li>
        <li>For each additional ally on any other side of the creature, you gain an additional +1 bonus (maximum +4).</li>
        <li>You lose all flanking bonuses if you are being flanked yourself, as your attention is divided.</li>
        <li>Creatures with blindsight, tremorsense, or truesight are immune to flanking, as their heightened senses prevent them from being caught off guard.</li>
      </ul>
      <p class="flanking-diagonal-status">Diagonal flanking: <strong id="ft-diagonal-status">OFF</strong></p>
    </div>
    <style>${STYLE}</style>
  `;

  const paletteEl = container.querySelector('#ft-palette');
  const boardEl = container.querySelector('#ft-board');
  const boardWrapEl = container.querySelector('.ft-board-wrap');
  const hintEl = container.querySelector('#ft-hint');
  const diagonalToggle = container.querySelector('#ft-diagonal-toggle');
  const diagonalStatus = container.querySelector('#ft-diagonal-status');
  const examplesSelect = container.querySelector('#ft-examples');
  const clearBtn = container.querySelector('#ft-clear');

  // --- Palette ---
  for (let size = 1; size <= 6; size++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ft-size-btn';
    btn.textContent = `${size}×${size}`;
    btn.dataset.size = String(size);
    btn.onclick = () => {
      armedSize = armedSize === size ? null : size;
      updatePaletteState();
      updateHint();
    };
    paletteEl.appendChild(btn);
  }

  function updatePaletteState() {
    paletteEl.querySelectorAll('.ft-size-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.size) === armedSize);
    });
    boardEl.classList.toggle('armed', armedSize !== null);
  }

  function updateHint() {
    if (armedSize) {
      hintEl.textContent = `Click the grid to place a ${armedSize}×${armedSize} token. Click the size again to cancel.`;
    } else {
      hintEl.textContent = 'Select a size above, then click the grid.';
    }
  }

  // --- Keep the board (plus everything above it) within the window's
  // visible height, so the tool never needs vertical scrolling to reach
  // the controls or see the whole grid at once.
  function updateBoardMaxSize() {
    const top = boardWrapEl.getBoundingClientRect().top;
    const hintRect = hintEl.getBoundingClientRect();
    const hintMarginTop = parseFloat(getComputedStyle(hintEl).marginTop) || 0;
    const bottomPadding = 24;
    const available = window.innerHeight - top - hintRect.height - hintMarginTop - bottomPadding;
    boardWrapEl.style.maxWidth = Math.max(220, available) + 'px';
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateBoardMaxSize, 100);
  });

  // --- Grid helpers ---
  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

  function isWithinGrid(row, col, size) {
    return row >= 0 && col >= 0 && row + size <= GRID_SIZE && col + size <= GRID_SIZE;
  }

  function overlaps(a, b) {
    return !(a.col >= b.col + b.size || a.col + a.size <= b.col ||
             a.row >= b.row + b.size || a.row + a.size <= b.row);
  }

  function isAreaFree(row, col, size, ignoreId) {
    const probe = { row, col, size };
    return !tokens.some(t => t.id !== ignoreId && overlaps(probe, t));
  }

  function eventToCell(e) {
    const rect = boardEl.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 0.999);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 0.999);
    return { col: Math.floor(x * GRID_SIZE), row: Math.floor(y * GRID_SIZE) };
  }

  function eventToPlacement(e, size) {
    const { row, col } = eventToCell(e);
    const half = Math.floor(size / 2);
    return {
      row: clamp(row - half, 0, GRID_SIZE - size),
      col: clamp(col - half, 0, GRID_SIZE - size)
    };
  }

  // --- Flanking logic (unchanged rules, adapted to plain token objects) ---
  function overlapsHorizontally(a, b) { return !(a.col >= b.col + b.size || a.col + a.size <= b.col); }
  function overlapsVertically(a, b) { return !(a.row >= b.row + b.size || a.row + a.size <= b.row); }
  function isAdjacentNorth(a, b) { return a.row + a.size === b.row && overlapsHorizontally(a, b); }
  function isAdjacentSouth(a, b) { return a.row === b.row + b.size && overlapsHorizontally(a, b); }
  function isAdjacentEast(a, b) { return a.col === b.col + b.size && overlapsVertically(a, b); }
  function isAdjacentWest(a, b) { return a.col + a.size === b.col && overlapsVertically(a, b); }
  function isAdjacentNE(a, b) { return a.row + a.size === b.row && a.col + a.size === b.col; }
  function isAdjacentNW(a, b) { return a.row + a.size === b.row && a.col === b.col + b.size; }
  function isAdjacentSE(a, b) { return a.row === b.row + b.size && a.col + a.size === b.col; }
  function isAdjacentSW(a, b) { return a.row === b.row + b.size && a.col === b.col + b.size; }

  function isAdjacent(a, b) {
    if (isAdjacentNorth(a, b) || isAdjacentSouth(a, b) || isAdjacentEast(a, b) || isAdjacentWest(a, b)) return true;
    if (diagonalFlankingEnabled) {
      return isAdjacentNE(a, b) || isAdjacentNW(a, b) || isAdjacentSE(a, b) || isAdjacentSW(a, b);
    }
    return false;
  }

  function findAdjacentEnemies(token) {
    const opposing = token.team === 'Ally' ? 'Enemy' : 'Ally';
    return tokens.filter(t => t.team === opposing && isAdjacent(token, t));
  }

  function isTokenFlanked(token) {
    if (!token.team || token.sixthSense) return false;
    const opposing = token.team === 'Ally' ? 'Enemy' : 'Ally';
    const enemies = tokens.filter(t => t.team === opposing && isAdjacent(t, token));

    const hasN = enemies.some(e => isAdjacentNorth(e, token));
    const hasS = enemies.some(e => isAdjacentSouth(e, token));
    const hasE = enemies.some(e => isAdjacentEast(e, token));
    const hasW = enemies.some(e => isAdjacentWest(e, token));
    if ((hasN && hasS) || (hasE && hasW)) return true;

    if (diagonalFlankingEnabled) {
      const hasNE = enemies.some(e => isAdjacentNE(e, token));
      const hasSW = enemies.some(e => isAdjacentSW(e, token));
      const hasNW = enemies.some(e => isAdjacentNW(e, token));
      const hasSE = enemies.some(e => isAdjacentSE(e, token));
      if ((hasNE && hasSW) || (hasNW && hasSE)) return true;
    }
    return false;
  }

  function calculateFlankingBonus(attacker, target) {
    if (!attacker.team || !target.team || attacker.team === target.team) return 0;
    if (target.sixthSense) return 0;
    if (!isAdjacent(attacker, target)) return 0;
    if (isTokenFlanked(attacker)) return 0;

    const allies = tokens.filter(t => t.id !== attacker.id && t.team === attacker.team && !isTokenFlanked(t));

    const isN = isAdjacentNorth(attacker, target), isS = isAdjacentSouth(attacker, target);
    const isE = isAdjacentEast(attacker, target), isW = isAdjacentWest(attacker, target);
    const isNE = diagonalFlankingEnabled && isAdjacentNE(attacker, target);
    const isNW = diagonalFlankingEnabled && isAdjacentNW(attacker, target);
    const isSE = diagonalFlankingEnabled && isAdjacentSE(attacker, target);
    const isSW = diagonalFlankingEnabled && isAdjacentSW(attacker, target);

    const hasS_ = allies.some(a => isAdjacentSouth(a, target));
    const hasN_ = allies.some(a => isAdjacentNorth(a, target));
    const hasW_ = allies.some(a => isAdjacentWest(a, target));
    const hasE_ = allies.some(a => isAdjacentEast(a, target));
    const hasNE_ = diagonalFlankingEnabled && allies.some(a => isAdjacentNE(a, target));
    const hasNW_ = diagonalFlankingEnabled && allies.some(a => isAdjacentNW(a, target));
    const hasSE_ = diagonalFlankingEnabled && allies.some(a => isAdjacentSE(a, target));
    const hasSW_ = diagonalFlankingEnabled && allies.some(a => isAdjacentSW(a, target));

    let bonus = 0;
    if ((isN && hasS_) || (isS && hasN_) || (isE && hasW_) || (isW && hasE_)) {
      bonus = 2;
    } else if (diagonalFlankingEnabled &&
      ((isNE && hasSW_) || (isSW && hasNE_) || (isNW && hasSE_) || (isSE && hasNW_))) {
      bonus = 2;
    }

    if (bonus === 2) {
      let extra = 0;
      if (!isN && !isS) { if (hasN_) extra++; if (hasS_) extra++; }
      if (!isE && !isW) { if (hasE_) extra++; if (hasW_) extra++; }
      if (diagonalFlankingEnabled) {
        if (!isNE && !isSW) { if (hasNE_) extra++; if (hasSW_) extra++; }
        if (!isNW && !isSE) { if (hasNW_) extra++; if (hasSE_) extra++; }
      }
      bonus += Math.min(extra, 2);
    }
    return bonus;
  }

  // --- Token CRUD ---
  function addToken(size, row, col, team) {
    const token = { id: nextId++, size, row, col, team: team || null, sixthSense: false };
    tokens.push(token);
    return token;
  }

  function removeToken(id) {
    tokens = tokens.filter(t => t.id !== id);
    if (hoveredId === id) hoveredId = null;
  }

  function clearTokens() {
    tokens = [];
    hoveredId = null;
    popover = null;
    render();
  }

  // --- Rendering ---
  function pct(n) { return (n / GRID_SIZE * 100) + '%'; }

  function render() {
    renderBoard();
  }

  function renderBoard() {
    boardEl.innerHTML = '';

    tokens.forEach(token => {
      const el = document.createElement('div');
      const teamClass = token.team ? `team-${token.team.toLowerCase()}` : 'team-none';
      el.className = `ft-token ${teamClass}`;
      el.style.left = pct(token.col);
      el.style.top = pct(token.row);
      el.style.width = pct(token.size);
      el.style.height = pct(token.size);

      const glyph = token.team === 'Ally' ? 'shield' : token.team === 'Enemy' ? 'skull' : 'move';
      el.innerHTML = icon(glyph, 'ft-token-icon');

      if (token.sixthSense) {
        const badge = document.createElement('span');
        badge.className = 'ft-sixth-sense-badge';
        badge.innerHTML = ICONS.eye;
        el.appendChild(badge);
      }

      attachTokenEvents(el, token);
      boardEl.appendChild(el);
    });

    if (hoveredId !== null) {
      const token = tokens.find(t => t.id === hoveredId);
      if (token) renderFlankingOverlay(token);
    }

    if (popover) renderPopover();
  }

  // Dragging is done with pointer events instead of native HTML5
  // drag-and-drop: native DnD has no live snap preview, feels laggy/
  // disconnected from the cursor across browsers, and doesn't work on
  // touch at all. This gives full control over the interaction and a
  // click (no movement) still opens the token's popover - the two are
  // told apart by a small movement threshold.
  //
  // The dragged token itself stays put (dimmed) for the whole gesture;
  // a separate dashed ghost box tracks the cursor, snapped to the grid,
  // colored for whether the spot under it is free. Nothing about the
  // token's real position changes until you release on a valid cell -
  // that also means a stray render() mid-drag (from hovering another
  // token, say) can't clobber the drag, since the token being dragged
  // never moves in the data until drop.
  function attachTokenEvents(el, token) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || armedSize !== null) return;
      e.preventDefault();
      e.stopPropagation();

      let moved = false;
      let ghost = null;
      let pending = null;

      // Claim draggingId immediately so a hover on another token can't
      // sneak in a render() (which would wipe boardEl.innerHTML, orphaning
      // el/ghost) during the brief window before the movement threshold
      // is crossed.
      draggingId = token.id;
      if (popover && popover.tokenId === token.id) popover = null;
      hoveredId = null;

      function onMove(ev) {
        const dx = ev.clientX - e.clientX;
        const dy = ev.clientY - e.clientY;
        if (!moved && Math.hypot(dx, dy) < 4) return;

        if (!moved) {
          moved = true;
          el.classList.add('dragging');

          ghost = document.createElement('div');
          ghost.className = 'ft-drag-ghost';
          ghost.style.width = pct(token.size);
          ghost.style.height = pct(token.size);
          boardEl.appendChild(ghost);
        }

        const { row, col } = eventToPlacement(ev, token.size);
        const valid = isAreaFree(row, col, token.size, token.id);
        ghost.style.left = pct(col);
        ghost.style.top = pct(row);
        ghost.classList.toggle('invalid', !valid);
        pending = valid ? { row, col } : null;
      }

      function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        draggingId = null;

        if (moved) {
          if (pending) {
            token.row = pending.row;
            token.col = pending.col;
          }
          if (ghost) ghost.remove();
          render();
        } else {
          popover = { kind: token.team ? 'menu' : 'team', tokenId: token.id };
          render();
        }
      }

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    if (token.team) {
      el.addEventListener('mouseenter', () => {
        if (armedSize !== null || draggingId !== null) return;
        hoveredId = token.id;
        render();
      });
      el.addEventListener('mouseleave', () => {
        if (hoveredId === token.id) {
          hoveredId = null;
          render();
        }
      });
    }
  }

  function renderFlankingOverlay(token) {
    const flanked = isTokenFlanked(token);

    if (token.sixthSense) {
      boardEl.appendChild(makeLabel(token, 'Unflankable', 'purple'));
      return;
    }

    if (flanked) {
      boardEl.appendChild(makeLabel(token, 'Flanked – cannot flank', 'danger'));

      const flankers = tokens.filter(t => t.team !== token.team && calculateFlankingBonus(t, token) > 0);
      flankers.forEach(f => boardEl.appendChild(makeHighlight(f, 'medium')));
      return;
    }

    findAdjacentEnemies(token).forEach(target => {
      if (target.sixthSense) {
        boardEl.appendChild(makeHighlight(target, 'purple'));
        boardEl.appendChild(makeLabel(target, 'Immune', 'purple'));
        return;
      }
      const bonus = calculateFlankingBonus(token, target);
      if (bonus > 0) {
        boardEl.appendChild(makeHighlight(target, 'accent'));
        boardEl.appendChild(makeLabel(target, `+${bonus} Flanking`, 'accent'));
      }
    });
  }

  function makeHighlight(token, tone) {
    const el = document.createElement('div');
    el.className = `ft-highlight tone-${tone}`;
    el.style.left = pct(token.col);
    el.style.top = pct(token.row);
    el.style.width = pct(token.size);
    el.style.height = pct(token.size);
    return el;
  }

  function makeLabel(token, text, tone) {
    const el = document.createElement('div');
    el.className = `ft-label tone-${tone}`;
    el.style.left = pct(token.col + token.size / 2);
    el.style.top = pct(token.row);
    el.textContent = text;
    return el;
  }

  // --- Popovers (team prompt / token menu) ---
  function positionPopover(el, token) {
    const boardRect = boardEl.getBoundingClientRect();
    const left = (token.col + token.size / 2) / GRID_SIZE * boardRect.width;
    const top = (token.row + token.size) / GRID_SIZE * boardRect.height;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function renderPopover() {
    const token = tokens.find(t => t.id === popover.tokenId);
    if (!token) { popover = null; return; }

    const el = document.createElement('div');
    el.className = 'ft-popover';

    if (popover.kind === 'team') {
      el.innerHTML = `
        <p class="ft-popover-title">Ally or enemy?</p>
        <div class="ft-popover-row">
          <button type="button" class="ft-popover-btn team-ally" data-action="ally">${icon('shield')} Ally</button>
          <button type="button" class="ft-popover-btn team-enemy" data-action="enemy">${icon('skull')} Enemy</button>
        </div>
      `;
      el.querySelector('[data-action="ally"]').onclick = () => { token.team = 'Ally'; popover = null; render(); };
      el.querySelector('[data-action="enemy"]').onclick = () => { token.team = 'Enemy'; popover = null; render(); };
    } else {
      el.innerHTML = `
        <button type="button" class="ft-menu-item" data-action="delete">${icon('trash')} Delete</button>
        <button type="button" class="ft-menu-item" data-action="swap">${icon('swap')} Swap team</button>
        <button type="button" class="ft-menu-item" data-action="sixth">${icon('eye')} ${token.sixthSense ? 'Remove' : 'Add'} 6th sense</button>
      `;
      el.querySelector('[data-action="delete"]').onclick = () => { removeToken(token.id); popover = null; render(); };
      el.querySelector('[data-action="swap"]').onclick = () => {
        token.team = token.team === 'Ally' ? 'Enemy' : 'Ally';
        popover = null;
        render();
      };
      el.querySelector('[data-action="sixth"]').onclick = () => {
        token.sixthSense = !token.sixthSense;
        popover = null;
        render();
      };
    }

    boardEl.appendChild(el);
    positionPopover(el, token);
  }

  document.addEventListener('click', e => {
    if (popover && !boardEl.contains(e.target)) {
      popover = null;
      render();
    }
  });

  // --- Board-level interaction (placing + dropping) ---
  boardEl.addEventListener('click', e => {
    if (e.target !== boardEl) return;
    if (popover) { popover = null; render(); return; }
    if (armedSize === null) return;

    const { row, col } = eventToPlacement(e, armedSize);
    if (isWithinGrid(row, col, armedSize) && isAreaFree(row, col, armedSize)) {
      const token = addToken(armedSize, row, col, null);
      armedSize = null;
      updatePaletteState();
      updateHint();
      popover = { kind: 'team', tokenId: token.id };
      render();
    }
  });

  // --- Diagonal toggle ---
  diagonalToggle.addEventListener('change', () => {
    diagonalFlankingEnabled = diagonalToggle.checked;
    diagonalStatus.textContent = diagonalFlankingEnabled ? 'ON' : 'OFF';
    render();
  });

  // --- Clear ---
  clearBtn.addEventListener('click', clearTokens);

  // --- Examples ---
  const mid = Math.floor(GRID_SIZE / 2) - 1; // top-left of the centered 2x2 enemy

  const examples = {
    basic() {
      addToken(2, mid, mid, 'Enemy');
      addToken(1, mid - 1, mid, 'Ally');
      addToken(1, mid + 2, mid, 'Ally');
    },
    multi() {
      addToken(2, mid, mid, 'Enemy');
      addToken(1, mid - 1, mid, 'Ally');
      addToken(1, mid + 2, mid, 'Ally');
      addToken(1, mid, mid - 1, 'Ally');
      addToken(1, mid, mid + 2, 'Ally');
    },
    sameside() {
      addToken(2, mid, mid, 'Enemy');
      addToken(1, mid - 1, mid, 'Ally');
      addToken(1, mid + 2, mid, 'Ally');
      addToken(1, mid + 2, mid + 1, 'Ally');
    },
    counter() {
      addToken(2, mid, mid, 'Enemy');
      addToken(1, mid - 1, mid, 'Ally');
      addToken(1, mid + 2, mid, 'Ally');
      addToken(1, mid, mid - 1, 'Ally');
      addToken(1, mid, mid + 2, 'Ally');
      addToken(1, mid - 2, mid, 'Enemy');
    },
    sixthsense() {
      const enemy = addToken(2, mid, mid, 'Enemy');
      enemy.sixthSense = true;
      addToken(1, mid - 1, mid, 'Ally');
      addToken(1, mid + 2, mid, 'Ally');
      addToken(1, mid, mid - 1, 'Ally');
      addToken(1, mid, mid + 2, 'Ally');
    },
    diagonal() {
      diagonalFlankingEnabled = true;
      diagonalToggle.checked = true;
      diagonalStatus.textContent = 'ON';
      addToken(2, mid, mid, 'Enemy');
      addToken(1, mid - 1, mid - 1, 'Ally');
      addToken(1, mid + 2, mid + 2, 'Ally');
    }
  };

  examplesSelect.addEventListener('change', () => {
    const key = examplesSelect.value;
    examplesSelect.value = '';
    if (!key || !examples[key]) return;
    clearTokens();
    examples[key]();
    render();
  });

  // --- Init ---
  updatePaletteState();
  updateHint();
  updateBoardMaxSize();
  render();

  return {
    clear: clearTokens,
    getTokens: () => tokens.map(t => ({ ...t }))
  };
};

const STYLE = `
.flanking-tool {
  font-family: var(--font-primary);
  color: var(--bone-100);
}

.ft-column { min-width: 0; margin-bottom: 28px; }

.ft-column h3 {
  font-family: var(--font-secondary);
  margin-top: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.ft-column p {
  color: var(--bone-dim);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  max-width: 60ch;
}

.ft-credit {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.ft-rules ul {
  color: var(--bone-dim);
  padding-left: 20px;
  margin: 0 0 20px;
}
.ft-rules li { margin-bottom: 10px; max-width: 60ch; }

.ft-top-row {
  display: flex;
  align-items: stretch;
  gap: 16px;
  margin-bottom: 12px;
}

.ft-palette { display: flex; flex: 1; gap: 6px; }

.ft-size-btn {
  flex: 1;
  background: var(--ink-900);
  border: 1px solid var(--line-strong);
  color: var(--bone-100);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 8px 10px;
  cursor: pointer;
  text-align: center;
}
.ft-size-btn:hover { background: var(--ink-800); }
.ft-size-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.ft-toolbar-secondary {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.ft-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--bone-dim);
  cursor: pointer;
}
.ft-toggle .ft-icon { width: 14px; height: 14px; color: var(--bone-dim); }

#ft-examples {
  background: var(--ink-900);
  border: 1px solid var(--line-strong);
  color: var(--bone-100);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 7px 8px;
}

.ft-clear-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--line-strong);
  color: var(--bone-100);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 7px 12px;
  cursor: pointer;
}
.ft-clear-btn:hover { border-color: var(--accent); color: var(--accent-strong); }
.ft-clear-btn .ft-icon { width: 14px; height: 14px; }

.ft-board-wrap {
  width: 100%;
}

.ft-board {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background-color: #f5f3ec;
  background-image:
    linear-gradient(to right, rgba(0, 0, 0, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
  background-size: calc(100% / 12) calc(100% / 12);
  overflow: visible;
  user-select: none;
}
.ft-board.armed { cursor: crosshair; }

.ft-hint {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--bone-dim);
  margin-top: 10px;
}

.ft-token {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
}
.ft-token.team-ally { background: #3f7d56; }
.ft-token.team-enemy { background: #a8483a; }
.ft-token.team-none { background: #9aa0a6; opacity: 0.85; }

.ft-token.dragging {
  cursor: grabbing;
  opacity: 0.35;
}

.ft-drag-ghost {
  position: absolute;
  box-sizing: border-box;
  border: 3px dashed #c9a24a;
  background: rgba(201, 162, 74, 0.15);
  pointer-events: none;
  z-index: 6;
}
.ft-drag-ghost.invalid {
  border-color: #a8483a;
  background: rgba(168, 72, 58, 0.15);
}

.ft-token-icon { width: 42%; height: 42%; color: #fff; }
.ft-icon { display: inline-flex; width: 1em; height: 1em; }
.ft-icon svg { width: 100%; height: 100%; }

.ft-sixth-sense-badge {
  position: absolute;
  top: 3%;
  right: 3%;
  width: 26%;
  height: 26%;
  min-width: 14px;
  min-height: 14px;
  background: var(--accent);
  color: #fff;
  border-radius: 50%;
  border: 1.5px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ft-sixth-sense-badge svg { width: 65%; height: 65%; }

.ft-highlight {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 3px solid transparent;
}
.ft-highlight.tone-accent { border-color: #c9a24a; }
.ft-highlight.tone-medium { border-color: #b3823f; }
.ft-highlight.tone-purple { border-color: #8e5fb0; }

.ft-label {
  position: absolute;
  transform: translate(-50%, -100%);
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  background: #1c1912;
  pointer-events: none;
}
.ft-label.tone-accent { color: #ddb965; }
.ft-label.tone-medium { color: #cf9f5e; }
.ft-label.tone-purple { color: #c9a6e0; }
.ft-label.tone-danger { color: #e2897d; }

.ft-popover {
  position: absolute;
  transform: translateX(-50%);
  margin-top: 6px;
  background: var(--ink-900);
  border: 1px solid var(--line-strong);
  padding: 8px;
  z-index: 10;
  min-width: 160px;
}

.ft-popover-title {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--bone-dim);
  margin: 2px 6px 8px;
  white-space: nowrap;
}

.ft-popover-row { display: flex; gap: 6px; }

.ft-popover-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: #fff;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 8px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.ft-popover-btn .ft-icon { width: 14px; height: 14px; }
.ft-popover-btn.team-ally:hover { background: #3f7d56; border-color: #3f7d56; }
.ft-popover-btn.team-enemy:hover { background: #a8483a; border-color: #a8483a; }

.ft-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  color: var(--bone-100);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: 8px 10px;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
}
.ft-menu-item:hover { background: var(--ink-800); }
.ft-menu-item .ft-icon { width: 14px; height: 14px; color: var(--bone-dim); }

@media (max-width: 760px) {
  .ft-top-row { flex-wrap: wrap; }
  .ft-palette { flex: 1 1 100%; }
  .ft-clear-btn { margin-left: auto; }
}
`;
