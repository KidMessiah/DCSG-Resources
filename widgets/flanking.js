/*
Pixi-only 20x20 Grid Game Tool Widget for Desktop

- All UI (palette, team prompt, instructions) rendered in PixiJS.
- No HTML overlays or dependencies except PixiJS.
- Desktop-only with drag, drop, and hover interactions.
- Exposes createFlankingWidget(container, options) on window.
*/

// Ensure PIXI is loaded
if (typeof PIXI === 'undefined') {
  throw new Error(
    "PixiJS (PIXI) is not loaded. Please include PixiJS via " +
    "<script src='https://cdn.jsdelivr.net/npm/pixi.js@7.x/dist/pixi.min.js'></script> " +
    "before loading this widget."
  );
}

function createFlankingWidget(container, options = {}) {
  // --- Constants ---
  const GRID_SIZE = 20;
  // Updated team colors for white background
  const COLORS = { Ally: 0x00FF00, Enemy: 0xd32f2f, Neutral: 0xbdbdbd };
  const PALETTE = [1, 2, 3, 4, 5, 6];
  // Set background to white
  const BG_COLOR = 0xffffff;
  const INSTR_TEXT = "This tool simulates the rules I use for flanking in my games.\n\nIn order to begin, drag a token from the palette labelled 1x1, 2x2, etc. onto the grid and choose it's team\n\nOnce you have a token on the grid, you can do a few things:\n   1. Right click it to delete it, or change it's team.\n   2. Hover it to see if it is able to flank any units it is adjacent to.\n   3. Drag it around to see how it interacts with other units.";
  // Palette and UI constants - reduce margin between palette and grid
  const PALETTE_MARGIN = 10, PALETTE_BTN = 44, PALETTE_GAP = 8;
  const PROMPT_W = 220, PROMPT_H = 110;
  const CONTEXT_MENU_W = 120, CONTEXT_MENU_ITEM_H = 30;
  const COLUMN_MARGIN = 10;

  // --- State ---
  let tokens = [];
  let gridMap = Array.from({length: GRID_SIZE}, () => Array(GRID_SIZE).fill(null));
  let draggingToken = null, nextTokenId = 1;
  let teamPromptToken = null;
  let cellPx = 32, gridOrigin = {x:0, y:0};
  let tempGhost = null;
  let contextMenu = null;
  let contextMenuTarget = null;
  
  // UI state management
  const UIState = {
    IDLE: 'idle',
    DRAGGING: 'dragging',
    TEAM_SELECT: 'team-select',
    HOVERING: 'hovering',
    CONTEXT_MENU: 'context-menu'
  };
  let currentState = UIState.IDLE;

  // --- PixiJS Setup ---
  const initialWidth = container.clientWidth || options.width || 600;
  const initialHeight = container.clientHeight || options.height || 800;
  
  const app = new PIXI.Application({
    width: initialWidth,
    height: initialHeight,
    backgroundColor: BG_COLOR,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  });
  
  app.view.style.display = 'block';
  app.view.style.width = '100%';
  app.view.style.height = '100%';
  container.appendChild(app.view);
  
  // Prevent default context menu
  app.view.addEventListener('contextmenu', e => e.preventDefault());

  // --- Layers ---
  const gridLayer = new PIXI.Container();
  const tokenLayer = new PIXI.Container();
  const overlayLayer = new PIXI.Container();
  const promptLayer = new PIXI.Container();
  const menuLayer = new PIXI.Container();

  // Enable sortable children for proper z-indexing
  app.stage.sortableChildren = true;
  overlayLayer.sortableChildren = true;

  // Set z-index values for consistent stacking
  gridLayer.zIndex = 10;
  tokenLayer.zIndex = 20;
  overlayLayer.zIndex = 30;
  promptLayer.zIndex = 40;
  menuLayer.zIndex = 50;

  app.stage.addChild(gridLayer, tokenLayer, overlayLayer, promptLayer, menuLayer);

  // --- Instructions & Titles ---
  const leftTitle = new PIXI.Text("Flanking Tool", {
    fontSize: 22,
    fill: '#222', // dark text for white bg
    fontWeight: 'bold'
  });
  leftTitle.style.fontWeight = 'bold';
  app.stage.addChild(leftTitle);

  const rightTitle = new PIXI.Text("Flanking Rules", {
    fontSize: 22,
    fill: '#222',
    fontWeight: 'bold'
  });
  rightTitle.style.fontWeight = 'bold';
  app.stage.addChild(rightTitle);

  const instr = new PIXI.Text(INSTR_TEXT, {
    fontSize: 16, 
    fill: '#333', // darker text
    wordWrap: true,
    lineHeight: 22,
    align: 'left'
  });
  app.stage.addChild(instr);
  
  // Updated right column text with DnD 5e style rules
  const rightText = new PIXI.Text(
    "Variant Flanking - Small\n\n" +
    "This optional rule rewards tactical cooperation by providing attack roll bonuses when multiple creatures surround an enemy.\n\n" +
    "• When you have an ally on the opposite side of a creature, you gain a +2 bonus to melee attack rolls against that creature.\n\n" +
    "• For each additional ally on any other side of the creature, you gain an additional +1 bonus (maximum +4).\n\n" +
    "• You lose all flanking bonuses if you are being flanked yourself, as your attention is divided.\n\n" +
    "• Creatures with blindsight, tremorsense, or truesight are immune to flanking, as their heightened senses prevent them from being caught off guard.", {
    fontSize: 16,
    fill: '#333',
    wordWrap: true,
    lineHeight: 22,
    align: 'left'
  });
  
  app.stage.addChild(rightText);

  // Example Scenarios Button Container
  const exampleContainer = new PIXI.Container();
  app.stage.addChild(exampleContainer);

  // --- Palette ---
  const palette = new PIXI.Container();
  app.stage.addChild(palette);
  
  // --- Helper Functions ---
  function calculateColumnSizes(totalWidth) {
    const thirdWidth = Math.floor(totalWidth / 3);
    return {
      leftColumn: thirdWidth - COLUMN_MARGIN,
      centerColumn: thirdWidth,
      rightColumn: thirdWidth - COLUMN_MARGIN
    };
  }

  function gridToPx(row, col) {
    return { 
      x: Math.round(gridOrigin.x + col * cellPx), 
      y: Math.round(gridOrigin.y + row * cellPx) 
    };
  }
  
  function pxToGrid(x, y) {
    return {
      col: Math.floor((x - gridOrigin.x) / cellPx),
      row: Math.floor((y - gridOrigin.y) / cellPx)
    };
  }
  
  function isWithinGrid(row, col, size) {
    return row >= 0 && col >= 0 && row + size <= GRID_SIZE && col + size <= GRID_SIZE;
  }
  
  function isAreaFree(row, col, size, ignoreTokenId = null) {
    for (let r = row; r < row + size; ++r)
      for (let c = col; c < col + size; ++c)
        if (gridMap[r][c] && gridMap[r][c] !== ignoreTokenId) return false;
    return true;
  }
  
  function occupyGrid(token, occupy) {
    for (let r = token.row; r < token.row + token.size; ++r)
      for (let c = token.col; c < token.col + token.size; ++c)
        if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
          gridMap[r][c] = occupy ? token.id : null;
        }
  }

  function drawGrid() {
    gridLayer.removeChildren();
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0xcccccc, 1); // light gray grid lines
    for (let i = 0; i <= GRID_SIZE; ++i) {
      g.moveTo(gridOrigin.x + i * cellPx, gridOrigin.y)
       .lineTo(gridOrigin.x + i * cellPx, gridOrigin.y + GRID_SIZE * cellPx);
      g.moveTo(gridOrigin.x, gridOrigin.y + i * cellPx)
       .lineTo(gridOrigin.x + GRID_SIZE * cellPx, gridOrigin.y + i * cellPx);
    }
    gridLayer.addChild(g);
  }

  // --- Layout Management ---
  function updateLayout() {
    // Clear previous column backgrounds
    app.stage.children.forEach(child => {
      if (child instanceof PIXI.Graphics && 
          (child.columnBackground === 'left' || child.columnBackground === 'right')) {
        app.stage.removeChild(child);
      }
    });
    
    const availableWidth = app.screen.width;
    const availableHeight = app.screen.height;
    
    // Calculate columns based on 1/3 division
    const columns = calculateColumnSizes(availableWidth);
    
    const LEFT_COLUMN_WIDTH = columns.leftColumn;
    const RIGHT_COLUMN_WIDTH = columns.rightColumn;
    const CENTER_COLUMN_WIDTH = columns.centerColumn;
    
    // Position the palette at the top center
    const leftEdge = LEFT_COLUMN_WIDTH + COLUMN_MARGIN;
    updatePaletteLayout(CENTER_COLUMN_WIDTH, leftEdge);
    
    // Calculate grid metrics - reduce space between palette and grid
    const paletteBottom = palette.y + palette.height + 10; // Reduced margin
    const gridAreaHeight = availableHeight - paletteBottom - 20;
    
    updateGridMetrics(CENTER_COLUMN_WIDTH, gridAreaHeight, paletteBottom, leftEdge);
    
    // Create column backgrounds (light gray)
    const leftBg = new PIXI.Graphics();
    leftBg.beginFill(0xffffff, 1)
      .drawRect(0, 0, LEFT_COLUMN_WIDTH, app.screen.height)
      .endFill();
    leftBg.columnBackground = 'left';
    app.stage.addChildAt(leftBg, 0);
    
    const rightColumnX = leftEdge + CENTER_COLUMN_WIDTH + COLUMN_MARGIN;
    const rightBg = new PIXI.Graphics();
    rightBg.beginFill(0xffffff, 1)
      .drawRect(rightColumnX, 0, RIGHT_COLUMN_WIDTH, app.screen.height)
      .endFill();
    rightBg.columnBackground = 'right';
    app.stage.addChildAt(rightBg, 0);
    
    // Position text elements
    instr.x = 10;
    instr.y = 48;
    instr.style.wordWrapWidth = LEFT_COLUMN_WIDTH - 20;

    leftTitle.x = 10;
    leftTitle.y = 10;

    rightTitle.x = rightColumnX + 10;
    rightTitle.y = 10;

    rightText.x = rightColumnX + 10;
    rightText.y = rightTitle.y + rightTitle.height + 8;
    rightText.style.wordWrapWidth = RIGHT_COLUMN_WIDTH - 20;

    // Position and setup example buttons
    setupExampleButtons(rightColumnX, CENTER_COLUMN_WIDTH, rightText.y + rightText.height + 20, RIGHT_COLUMN_WIDTH);
  }

  function updatePaletteLayout(centerWidth, leftEdge) {
    palette.removeChildren();
    
    // Calculate palette buttons to fit the column width
    const availableWidth = centerWidth - (PALETTE_MARGIN * 2);
    const buttonSize = Math.min(PALETTE_BTN, 
      Math.floor((availableWidth - (PALETTE_GAP * (PALETTE.length - 1))) / PALETTE.length));
    const totalPaletteWidth = (buttonSize * PALETTE.length) + (PALETTE_GAP * (PALETTE.length - 1));
    
    palette.y = 10;
    palette.x = leftEdge + ((centerWidth - totalPaletteWidth) / 2);
    
    PALETTE.forEach((size, i) => {
      const btn = new PIXI.Graphics();
      btn.beginFill(0xf5f5f5).drawRoundedRect(0, 0, buttonSize, buttonSize, 8).endFill();
      btn.lineStyle(2, 0x888888, 0.7).drawRoundedRect(0, 0, buttonSize, buttonSize, 8);
      btn.x = i * (buttonSize + PALETTE_GAP);
      btn.y = 0;
      btn.interactive = true; 
      btn.buttonMode = true;

      // Remove token preview square, only show centered label
      const label = new PIXI.Text(`${size}x${size}`, {fontSize: 14, fill: '#222'});
      label.x = (buttonSize-label.width)/2; 
      label.y = (buttonSize-label.height)/2;
      btn.addChild(label);
      palette.addChild(btn);

      // Palette drag handler
      btn.on('pointerdown', (event) => {
        if (currentState !== UIState.IDLE) return;
      
        event.data.originalEvent.preventDefault();
        currentState = UIState.DRAGGING;
        
        // Create ghost token
        let ghost = createTokenGraphics(size, COLORS.Neutral);
        ghost.alpha = 0.7;
        ghost.zIndex = 1000; // Ensure ghost appears above other tokens
        tokenLayer.addChild(ghost);
        tempGhost = ghost;

        const onPointerMove = (e) => {
          const rect = app.view.getBoundingClientRect();
          const x = (e.clientX - rect.left) * (app.view.width / rect.width);
          const y = (e.clientY - rect.top) * (app.view.height / rect.height);
          
          const {col: cursorCol, row: cursorRow} = pxToGrid(x, y);
          
          // Calculate token position based on cursor
          const tokenRow = size % 2 === 0 ? cursorRow - (size/2) + 0.5 : cursorRow - Math.floor(size/2);
          const tokenCol = size % 2 === 0 ? cursorCol - (size/2) + 0.5 : cursorCol - Math.floor(size/2);
          
          const row = Math.round(tokenRow);
          const col = Math.round(tokenCol);
          
          const isInGrid = isWithinGrid(row, col, size);
          const isValid = isInGrid && isAreaFree(row, col, size);
          
          if (isInGrid) {
            const {x: snapX, y: snapY} = gridToPx(row, col);
            ghost.x = snapX;
            ghost.y = snapY;
            ghost.alpha = isValid ? 0.8 : 0.4;
            ghost.tint = isValid ? 0xffffff : 0xff0000;
          } else {
            ghost.x = x - (size * cellPx / 2);
            ghost.y = y - (size * cellPx / 2);
            ghost.alpha = 0.4;
            ghost.tint = 0xff0000;
          }
        };
        
        const onPointerUp = (e) => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          
          ghost.tint = 0xffffff;
          
          const rect = app.view.getBoundingClientRect();
          const x = (e.clientX - rect.left) * (app.view.width / rect.width);
          const y = (e.clientY - rect.top) * (app.view.height / rect.height);
          
          const {col: cursorCol, row: cursorRow} = pxToGrid(x, y);
          
          const tokenRow = size % 2 === 0 ? cursorRow - (size/2) + 0.5 : cursorRow - Math.floor(size/2);
          const tokenCol = size % 2 === 0 ? cursorCol - (size/2) + 0.5 : cursorCol - Math.floor(size/2);
          
          const row = Math.round(tokenRow);
          const col = Math.round(tokenCol);
          
          tokenLayer.removeChild(ghost);
          tempGhost = null;
          
          if (isWithinGrid(row, col, size) && isAreaFree(row, col, size)) {
            addToken(size, row, col);
          }
          
          currentState = UIState.IDLE;
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    });
  }
  
  function updateGridMetrics(centerWidth, gridAreaHeight, paletteBottom, leftEdge) {
    const maxGridWidth = centerWidth;
    const maxGridHeight = gridAreaHeight;
    
    cellPx = Math.floor(Math.min(maxGridWidth / GRID_SIZE, maxGridHeight / GRID_SIZE));
    
    const gridWidth = cellPx * GRID_SIZE;
    const gridHeight = cellPx * GRID_SIZE;
    
    gridOrigin.x = leftEdge + ((centerWidth - gridWidth) / 2);
    gridOrigin.y = paletteBottom + 10; // Reduced vertical gap
  }

  // --- Token Management ---
  function createTokenGraphics(size, color, label) {
    const g = new PIXI.Graphics();
    g.beginFill(color).drawRect(0, 0, size * cellPx, size * cellPx).endFill();
    g.lineStyle(2, 0x222222, 0.7).drawRect(0, 0, size * cellPx, size * cellPx);
    
    if (label) {
      const text = new PIXI.Text(label, {
        fontSize: Math.max(16, Math.floor(cellPx * 0.4)), 
        fill: color === COLORS.Ally ? '#fff' : '#fff',
        fontWeight: 'bold'
      });
      text.x = (size * cellPx - text.width) / 2;
      text.y = (size * cellPx - text.height) / 2;
      g.addChild(text);
    } else {
      // For neutral tokens, add drag hint
      const dragHint = new PIXI.Text("✥", {
        fontSize: Math.max(16, Math.floor(cellPx * 0.3)),
        fill: '#888888'
      });
      dragHint.x = (size * cellPx - dragHint.width) / 2;
      dragHint.y = (size * cellPx - dragHint.height) / 2;
      g.addChild(dragHint);
    }
    
    return g;
  }

  function updateTokenAppearance(token) {
    const label = token.team === 'Ally' ? 'A' : token.team === 'Enemy' ? 'E' : '';
    const color = token.team ? COLORS[token.team] : COLORS.Neutral;
    const alpha = token.team ? 1 : 0.7;
    
    // Remove old sprite and create new one
    if (token.sprite && token.sprite.parent) {
      token.sprite.parent.removeChild(token.sprite);
    }
    
    const sprite = createTokenGraphics(token.size, color, label);
    const {x, y} = gridToPx(token.row, token.col);
    sprite.x = x;
    sprite.y = y;
    sprite.alpha = alpha;
    sprite.interactive = true;
    sprite.buttonMode = true;
    sprite.tokenId = token.id;
    
    // Use sortableChildren to ensure proper z-indexing
    tokenLayer.addChild(sprite);
    token.sprite = sprite;
    
    setupTokenInteraction(token);
  }

  function setupTokenInteraction(token) {
    const sprite = token.sprite;
    
    sprite.removeAllListeners();
    sprite.interactive = true;
    sprite.buttonMode = true;
    sprite.token = token;
    
    sprite.on('rightdown', (event) => {
      event.stopPropagation();
      hideContextMenu();
      hideFlanking();
      showContextMenu(token, event.data.global.x, event.data.global.y);
    });
    
    sprite.on('mousedown', (event) => {
      // Only handle left mouse button
      if (event.data.originalEvent.button !== 0) return;
      
      hideFlanking();
      
      const origPos = { x: sprite.x, y: sprite.y };
      const mouseDownTime = Date.now();
      let hasMoved = false;
      const dragThreshold = 3;
      
      function handleMouseMove(e) {
        const rect = app.view.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (app.view.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (app.view.height / rect.height);
        
        const dx = mouseX - (origPos.x + token.size * cellPx / 2);
        const dy = mouseY - (origPos.y + token.size * cellPx / 2);
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (!hasMoved && distance > dragThreshold) {
          hasMoved = true;
          currentState = UIState.DRAGGING;
          draggingToken = token;
          occupyGrid(token, false);
          sprite.alpha = 0.7;
          sprite.zIndex = 1000; // Ensure dragged token appears above other tokens
        }
        
        if (hasMoved) {
          const {col: cursorCol, row: cursorRow} = pxToGrid(mouseX, mouseY);
          
          const tokenRow = token.size % 2 === 0 ? cursorRow - (token.size/2) + 0.5 : cursorRow - Math.floor(token.size/2);
          const tokenCol = token.size % 2 === 0 ? cursorCol - (token.size/2) + 0.5 : cursorCol - Math.floor(token.size/2);
          
          const row = Math.round(tokenRow);
          const col = Math.round(tokenCol);
          
          const isInGrid = isWithinGrid(row, col, token.size);
          const isValid = isInGrid && isAreaFree(row, col, token.size, token.id);
          
          if (isInGrid) {
            const snapPos = gridToPx(row, col);
            sprite.x = snapPos.x;
            sprite.y = snapPos.y;
            sprite.alpha = isValid ? 0.8 : 0.4;
            sprite.tint = isValid ? 0xffffff : 0xff6666;
          } else {
            sprite.x = mouseX - (token.size * cellPx / 2);
            sprite.y = mouseY - (token.size * cellPx / 2);
            sprite.alpha = 0.5;
            sprite.tint = 0xff9999;
          }
        }
      }
      
      function handleMouseUp(e) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        sprite.zIndex = 0;
        
        if (!hasMoved) {
          sprite.alpha = 1;
          sprite.tint = 0xffffff;
          
          if (token.team) {
            occupyGrid(token, true);
          }
          
          if (!token.team) {
            showTeamPrompt(token);
          }
          
          return;
        }
        
        sprite.alpha = 1;
        sprite.tint = 0xffffff;
        
        const rect = app.view.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (app.view.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (app.view.height / rect.height);
        
        const {col: cursorCol, row: cursorRow} = pxToGrid(mouseX, mouseY);
        const tokenRow = token.size % 2 === 0 ? cursorRow - (token.size/2) + 0.5 : cursorRow - Math.floor(token.size/2);
        const tokenCol = token.size % 2 === 0 ? cursorCol - (token.size/2) + 0.5 : cursorCol - Math.floor(token.size/2);
        
        const row = Math.round(tokenRow);
        const col = Math.round(tokenCol);
        
        if (isWithinGrid(row, col, token.size) && 
            isAreaFree(row, col, token.size, token.id)) {
          token.row = row;
          token.col = col;
          
          const snapPos = gridToPx(row, col);
          sprite.x = snapPos.x;
          sprite.y = snapPos.y;
          
          if (token.team) {
            occupyGrid(token, true);
          } else {
            showTeamPrompt(token);
          }
        } else {
          sprite.x = origPos.x;
          sprite.y = origPos.y;
          
          if (token.team) {
            occupyGrid(token, true);
          }
        }
        
        draggingToken = null;
        currentState = UIState.IDLE;
      }
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    });
    
    if (token.team) {
      sprite.on('mouseover', () => {
        if (currentState === UIState.IDLE) {
          currentState = UIState.HOVERING;
          showFlanking(token);
        }
      });
      
      sprite.on('mouseout', () => {
        if (currentState === UIState.HOVERING) {
          hideFlanking();
          currentState = UIState.IDLE;
        }
      });
    }
  }

  function addToken(size, row, col, team = null) {
    const id = nextTokenId++;
    const token = { id, size, team, row, col, sprite: null };
    tokens.push(token);
    
    updateTokenAppearance(token);
    
    if (team) {
      occupyGrid(token, true);
    } else {
      showTeamPrompt(token);
    }
    
    return token;
  }

  function removeToken(token) {
    occupyGrid(token, false);
    if (token.sprite && token.sprite.parent) {
      token.sprite.parent.removeChild(token.sprite);
    }
    tokens = tokens.filter(t => t.id !== token.id);
  }

  // --- Context Menu ---
  function showContextMenu(token, x, y) {
    currentState = UIState.CONTEXT_MENU;
    contextMenuTarget = token;
    
    const menuItems = ['Delete', 'Swap Team'];
    const menuHeight = CONTEXT_MENU_ITEM_H * menuItems.length;
    
    const menu = new PIXI.Container();
    
    // Light context menu background
    const bg = new PIXI.Graphics()
      .beginFill(0xf5f5f5, 0.98)
      .lineStyle(1, 0x888888, 0.8)
      .drawRoundedRect(0, 0, CONTEXT_MENU_W, menuHeight, 6)
      .endFill();
    menu.addChild(bg);
    
    menu.x = Math.min(x, app.screen.width - CONTEXT_MENU_W - 5);
    menu.y = Math.min(y, app.screen.height - menuHeight - 5);
    
    menuItems.forEach((item, index) => {
      const itemY = index * CONTEXT_MENU_ITEM_H;
      
      const itemContainer = new PIXI.Container();
      itemContainer.y = itemY;
      
      const itemBg = new PIXI.Graphics()
        .beginFill(0xf5f5f5, 0.01)
        .drawRect(0, 0, CONTEXT_MENU_W, CONTEXT_MENU_ITEM_H)
        .endFill();
      itemBg.interactive = true;
      itemBg.buttonMode = true;
      itemContainer.addChild(itemBg);
      
      const text = new PIXI.Text(item, {
        fontSize: 14,
        fill: 0x222222
      });
      text.x = 10;
      text.y = (CONTEXT_MENU_ITEM_H - text.height) / 2;
      itemContainer.addChild(text);
      
      itemContainer.action = item;
      
      itemBg.on('pointerover', () => {
        itemBg.clear()
          .beginFill(0xe0e0e0)
          .drawRect(0, 0, CONTEXT_MENU_W, CONTEXT_MENU_ITEM_H)
          .endFill();
      });
      
      itemBg.on('pointerout', () => {
        itemBg.clear()
          .beginFill(0xf5f5f5, 0.01)
          .drawRect(0, 0, CONTEXT_MENU_W, CONTEXT_MENU_ITEM_H)
          .endFill();
      });
      
      itemBg.on('pointerdown', (e) => {
        if (e.data.originalEvent.button !== 0) return;
        e.stopPropagation();
        
        if (contextMenuTarget) {
          if (item === 'Delete') {
            removeToken(contextMenuTarget);
          } else if (item === 'Swap Team') {
            contextMenuTarget.team = contextMenuTarget.team === 'Ally' ? 'Enemy' : 'Ally';
            updateTokenAppearance(contextMenuTarget);
          }
        }
        
        hideContextMenu();
      });
      
      menu.addChild(itemContainer);
    });
    
    menuLayer.addChild(menu);
    contextMenu = menu;
    
    app.stage.on('pointerdown', onStageClick);
  }
  
  function hideContextMenu() {
    if (contextMenu) {
      menuLayer.removeChild(contextMenu);
      contextMenu = null;
      contextMenuTarget = null;
      
      app.stage.off('pointerup', onStageClick);
      
      if (currentState === UIState.CONTEXT_MENU) {
        currentState = UIState.IDLE;
      }
    }
  }
  
  function onStageClick(e) {
    if (contextMenu) {
      let isClickInMenu = false;
      
      let target = e.target;
      while (target) {
        if (target === contextMenu || (target.parent && target.parent === contextMenu)) {
          isClickInMenu = true;
          break;
        }
        target = target.parent;
      }
      
      if (!isClickInMenu) {
        hideContextMenu();
      }
    }
  }

  // --- Team Selection ---
  function showTeamPrompt(token) {
    if (currentState === UIState.TEAM_SELECT) return;
    
    promptLayer.removeChildren();
    hideFlanking();
    
    teamPromptToken = token;
    currentState = UIState.TEAM_SELECT;
    
    const bg = new PIXI.Graphics();
    bg.beginFill(0xf5f5f5, 0.98).drawRoundedRect(0, 0, PROMPT_W, PROMPT_H, 12).endFill();
    bg.lineStyle(2, 0x888888, 0.7).drawRoundedRect(0, 0, PROMPT_W, PROMPT_H, 12);
    
    // Position centered over the grid
    const gridWidth = GRID_SIZE * cellPx;
    const gridHeight = GRID_SIZE * cellPx;
    bg.x = gridOrigin.x + (gridWidth - PROMPT_W)/2;
    bg.y = gridOrigin.y + (gridHeight - PROMPT_H)/2;
    
    promptLayer.addChild(bg);

    const txt = new PIXI.Text("Is this token an Ally or Enemy?", {fontSize: 16, fill: '#222'});
    txt.x = (PROMPT_W-txt.width)/2; 
    txt.y = 18;
    bg.addChild(txt);

    const btnAlly = new PIXI.Graphics();
    btnAlly.beginFill(COLORS.Ally).drawRoundedRect(0, 0, 80, 32, 8).endFill();
    btnAlly.lineStyle(2, 0x888888, 0.7).drawRoundedRect(0, 0, 80, 32, 8);
    btnAlly.x = 20; 
    btnAlly.y = PROMPT_H-48;
    btnAlly.interactive = true; 
    btnAlly.buttonMode = true;
    btnAlly.on('pointerdown', () => assignTeam('Ally'));
    
    const lblA = new PIXI.Text("Ally", {fontSize: 16, fill: '#fff'});
    lblA.x = (80-lblA.width)/2; 
    lblA.y = 6;
    btnAlly.addChild(lblA);
    bg.addChild(btnAlly);

    const btnEnemy = new PIXI.Graphics();
    btnEnemy.beginFill(COLORS.Enemy).drawRoundedRect(0, 0, 80, 32, 8).endFill();
    btnEnemy.lineStyle(2, 0x888888, 0.7).drawRoundedRect(0, 0, 80, 32, 8);
    btnEnemy.x = PROMPT_W-100; 
    btnEnemy.y = PROMPT_H-48;
    btnEnemy.interactive = true; 
    btnEnemy.buttonMode = true;
    btnEnemy.on('pointerdown', () => assignTeam('Enemy'));
    
    const lblE = new PIXI.Text("Enemy", {fontSize: 16, fill: '#fff'});
    lblE.x = (80-lblE.width)/2; 
    lblE.y = 6;
    btnEnemy.addChild(lblE);
    bg.addChild(btnEnemy);
  }

  function hideTeamPrompt() {
    promptLayer.removeChildren();
    teamPromptToken = null;
    if (currentState === UIState.TEAM_SELECT) {
      currentState = UIState.IDLE;
    }
  }

  function assignTeam(team) {
    if (!teamPromptToken) return;
    
    const token = teamPromptToken;
    token.team = team;
    
    occupyGrid(token, true);
    updateTokenAppearance(token);
    
    hideTeamPrompt();
  }

  // --- Flanking Logic ---
  function showFlanking(token) {
    if (currentState !== UIState.HOVERING || !token.team) return;
    
    const isHoveredTokenFlanked = isTokenFlanked(token);
    
    const opposingTeam = token.team === 'Ally' ? 'Enemy' : 'Ally';
    const adjacentEnemies = findAdjacentEnemies(token);
    
    try {
      if (PIXI.filters.GlowFilter) {
        token.sprite.filters = [
          new PIXI.filters.GlowFilter({
            distance: 8,
            color: isHoveredTokenFlanked ? 0xd32f2f : 0x1976d2,
            outerStrength: 2
          })
        ];
      } else {
        token.sprite.tint = isHoveredTokenFlanked ? 0xd32f2f : 0x1976d2;
      }
    } catch (e) {
      token.sprite.tint = isHoveredTokenFlanked ? 0xd32f2f : 0x1976d2;
    }

    if (isHoveredTokenFlanked) {
      // Create a container to hold both labels to ensure proper positioning
      const labelContainer = new PIXI.Container();
      labelContainer.zIndex = 100; // Ensure labels appear above tokens
      
      const label = new PIXI.Text("FLANKED", {
        fontSize: 14, 
        fill: '#d32f2f', 
        fontWeight: 'bold', 
        stroke: '#fff', 
        strokeThickness: 3
      });
      label.x = 0;
      label.y = -20; // Position above the container
      label.anchor.set(0.5, 0);
      labelContainer.addChild(label);
      
      const subLabel = new PIXI.Text("Cannot provide flanking", {
        fontSize: 12, 
        fill: '#222', 
        stroke: '#fff', 
        strokeThickness: 2
      });
      subLabel.x = 0;
      subLabel.y = -2; // Just below the main label
      subLabel.anchor.set(0.5, 0);
      labelContainer.addChild(subLabel);
      
      // Position the container at the center of the token
      labelContainer.x = token.sprite.x + (token.size * cellPx / 2);
      labelContainer.y = token.sprite.y;
      
      overlayLayer.addChild(labelContainer);
      
      const flankingUnits = tokens.filter(t => 
        t.team !== token.team && calculateFlankingBonus(t, token) > 0
      );
      
      flankingUnits.forEach(flanker => {
        const highlight = new PIXI.Graphics();
        highlight.lineStyle(3, 0xff9800)
          .drawRect(0, 0, flanker.size * cellPx, flanker.size * cellPx);
        highlight.x = flanker.sprite.x;
        highlight.y = flanker.sprite.y;
        overlayLayer.addChild(highlight);
        
        const lineGraphic = new PIXI.Graphics();
        lineGraphic.lineStyle(2, 0xff9800, 0.7)
          .moveTo(
            token.sprite.x + (token.size * cellPx / 2),
            token.sprite.y + (token.size * cellPx / 2)
          )
          .lineTo(
            flanker.sprite.x + (flanker.size * cellPx / 2),
            flanker.sprite.y + (flanker.size * cellPx / 2)
          );
        overlayLayer.addChild(lineGraphic);
      });
    }
    
    if (!isHoveredTokenFlanked) {
      adjacentEnemies.forEach(target => {
        const bonus = calculateFlankingBonus(token, target);
        
        if (bonus > 0) {
          const highlight = new PIXI.Graphics();
          highlight.lineStyle(3, 0xffeb3b)
            .drawRect(0, 0, target.size * cellPx, target.size * cellPx);
          highlight.x = target.sprite.x;
          highlight.y = target.sprite.y;
          overlayLayer.addChild(highlight);
          
          const label = new PIXI.Text(`+${bonus} Flanking`, {
            fontSize: 14, 
            fill: '#ffb300', 
            fontWeight: 'bold', 
            stroke: '#fff', 
            strokeThickness: 3
          });
          label.x = target.sprite.x + (target.size * cellPx / 2);
          label.y = target.sprite.y - 10;
          label.anchor.set(0.5, 1);
          overlayLayer.addChild(label);
          
          try {
            if (PIXI.filters.GlowFilter) {
              target.sprite.filters = [
                new PIXI.filters.GlowFilter({
                  distance: 8, 
                  color: 0xffb300,
                  outerStrength: 2
                })
              ];
            } else {
              target.sprite.tint = 0xffb300;
            }
          } catch (e) {
            target.sprite.tint = 0xffb300;
          }
          
          const lineGraphic = new PIXI.Graphics();
          lineGraphic.lineStyle(2, 0x888888, 0.7)
            .moveTo(
              token.sprite.x + (token.size * cellPx / 2),
              token.sprite.y + (token.size * cellPx / 2)
            )
            .lineTo(
              target.sprite.x + (target.size * cellPx / 2),
              target.sprite.y + (target.size * cellPx / 2)
            );
          
          overlayLayer.addChild(lineGraphic);
        }
      });
    }
  }
  
  function findAdjacentEnemies(token) {
    const opposingTeam = token.team === 'Ally' ? 'Enemy' : 'Ally';
    const enemies = tokens.filter(t => t.team === opposingTeam);
    
    return enemies.filter(enemy => 
      isAdjacentNorth(token, enemy) || 
      isAdjacentSouth(token, enemy) || 
      isAdjacentEast(token, enemy) || 
      isAdjacentWest(token, enemy)
    );
  }

  function hideFlanking() {
    overlayLayer.removeChildren();
    
    tokens.forEach(t => {
      if (t.sprite) {
        if (t !== draggingToken || currentState !== UIState.DRAGGING) {
          t.sprite.filters = null;
          t.sprite.tint = 0xffffff;
          t.sprite.alpha = 1;
        }
      }
    });
    
    if (currentState === UIState.HOVERING) {
      currentState = UIState.IDLE;
    }
  }

  function isTokenFlanked(token) {
    if (!token || !token.team) return false;
    
    const opposingTeam = token.team === 'Ally' ? 'Enemy' : 'Ally';
    const enemies = tokens.filter(t => t.team === opposingTeam);
    
    const adjacentEnemies = enemies.filter(enemy => 
      isAdjacentNorth(enemy, token) || 
      isAdjacentSouth(enemy, token) || 
      isAdjacentEast(enemy, token) || 
      isAdjacentWest(enemy, token)
    );
    
    const hasNorthEnemy = adjacentEnemies.some(e => isAdjacentNorth(e, token));
    const hasSouthEnemy = adjacentEnemies.some(e => isAdjacentSouth(e, token));
    const hasEastEnemy = adjacentEnemies.some(e => isAdjacentEast(e, token));
    const hasWestEnemy = adjacentEnemies.some(e => isAdjacentWest(e, token));
    
    return (hasNorthEnemy && hasSouthEnemy) || (hasEastEnemy && hasWestEnemy);
  }

  function calculateFlankingBonus(attacker, target) {
    if (!attacker || !target || attacker.team === target.team) return 0;
    
    const isAdjacent = isAdjacentNorth(attacker, target) || 
                      isAdjacentSouth(attacker, target) || 
                      isAdjacentEast(attacker, target) || 
                      isAdjacentWest(attacker, target);
    
    if (!isAdjacent) return 0;
    
    if (isTokenFlanked(attacker)) {
      return 0;
    }
    
    const friendlyUnits = tokens.filter(t => 
      t.id !== attacker.id && 
      t.team === attacker.team && 
      !isTokenFlanked(t)
    );
    
    const isNorth = isAdjacentNorth(attacker, target);
    const isSouth = isAdjacentSouth(attacker, target);
    const isEast = isAdjacentEast(attacker, target);
    const isWest = isAdjacentWest(attacker, target);
    
    const hasSouthAlly = friendlyUnits.some(ally => isAdjacentSouth(ally, target));
    const hasNorthAlly = friendlyUnits.some(ally => isAdjacentNorth(ally, target));
    const hasWestAlly = friendlyUnits.some(ally => isAdjacentWest(ally, target));
    const hasEastAlly = friendlyUnits.some(ally => isAdjacentEast(ally, target));
    
    let bonus = 0;
    if ((isNorth && hasSouthAlly) || (isSouth && hasNorthAlly) || 
        (isEast && hasWestAlly) || (isWest && hasEastAlly)) {
      bonus = 2;
    }
    
    if (bonus === 2) {
      let additionalSides = 0;
      
      if (!isNorth && !isSouth) {
        if (hasNorthAlly) additionalSides++;
        if (hasSouthAlly) additionalSides++;
      }
      
      if (!isEast && !isWest) {
        if (hasEastAlly) additionalSides++;
        if (hasWestAlly) additionalSides++;
      }
      
      bonus += Math.min(additionalSides, 2);
    }
    
    return bonus;
  }

  // Helper functions for adjacency checks
  function isAdjacentNorth(token1, token2) {
    return token1.row + token1.size === token2.row && 
           overlapsHorizontally(token1, token2);
  }
  
  function isAdjacentSouth(token1, token2) {
    return token1.row === token2.row + token2.size && 
           overlapsHorizontally(token1, token2);
  }
  
  function isAdjacentEast(token1, token2) {
    return token1.col === token2.col + token2.size && 
           overlapsVertically(token1, token2);
  }
  
  function isAdjacentWest(token1, token2) {
    return token1.col + token1.size === token2.col && 
           overlapsVertically(token1, token2);
  }
  
  function overlapsHorizontally(token1, token2) {
    return !(token1.col >= token2.col + token2.size || 
             token1.col + token1.size <= token2.col);
  }
  
  function overlapsVertically(token1, token2) {
    return !(token1.row >= token2.row + token2.size || 
             token1.row + token1.size <= token2.row);
  }

  // --- Responsive Resize ---
  function resize() {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    if (containerWidth <= 0 || containerHeight <= 0) return;
    
    app.renderer.resize(containerWidth, containerHeight);
    
    updateLayout();
    drawGrid();
    
    tokens.forEach(token => {
      updateTokenAppearance(token);
    });
    
    hideContextMenu();
    
    // Don't hide the team prompt on resize, just reposition it if it's active
    if (currentState === UIState.TEAM_SELECT && teamPromptToken) {
      // If a prompt is active, reposition it
      const prompt = promptLayer.children[0];
      if (prompt) {
        // Center prompt over the grid, not the whole screen
        const gridWidth = GRID_SIZE * cellPx;
        const gridHeight = GRID_SIZE * cellPx;
        prompt.x = gridOrigin.x + (gridWidth - PROMPT_W)/2;
        prompt.y = gridOrigin.y + (gridHeight - PROMPT_H)/2;
      } else {
        // If the prompt was removed somehow, recreate it
        showTeamPrompt(teamPromptToken);
      }
    } else {
      // No active prompt, make sure the layer is clear
      hideTeamPrompt();
    }
    
    hideFlanking();
  }
  
  window.addEventListener('resize', resize);
  
  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }

  // Initialize layout
  updateLayout();
  drawGrid();

  // --- Example Scenarios ---
  function setupExampleButtons(rightColumnX, centerWidth, startY, rightColumnWidth) {
    exampleContainer.removeChildren();
    
    const buttonWidth = rightColumnWidth - 20;
    const buttonHeight = 40;
    const buttonGap = 10;
    const buttonX = rightColumnX + 10;
    
    const examples = [
      { label: "Example 1: Basic Flanking", scenario: loadExample1 },
      { label: "Example 2: Multi-Side Flanking", scenario: loadExample2 },
      { label: "Example 3: Same-Side Allies", scenario: loadExample3 },
      { label: "Example 4: Counter-Flanking", scenario: loadExample4 }
    ];
    
    examples.forEach((example, index) => {
      const button = new PIXI.Graphics();
      button.beginFill(0x4e6b9f)
        .drawRoundedRect(0, 0, buttonWidth, buttonHeight, 8)
        .endFill();
      
      button.x = buttonX;
      button.y = startY + (index * (buttonHeight + buttonGap));
      button.interactive = true;
      button.buttonMode = true;
      
      const label = new PIXI.Text(example.label, {
        fontSize: 16,
        fill: 0xffffff,
        fontWeight: 'bold'
      });
      
      label.x = (buttonWidth - label.width) / 2;
      label.y = (buttonHeight - label.height) / 2;
      button.addChild(label);
      
      button.on('mouseover', () => {
        button.alpha = 0.8;
      });
      
      button.on('mouseout', () => {
        button.alpha = 1;
      });
      
      button.on('pointerdown', () => {
        clearTokens();
        example.scenario();
      });
      
      exampleContainer.addChild(button);
    });
  }

  function clearTokens() {
    tokens.forEach(removeToken);
    tokens = [];
    nextTokenId = 1;
  }

  // Example 1: Basic flanking with two allies on opposite sides
  function loadExample1() {
    // Add a 2x2 enemy in the middle
    const enemyToken = addToken(2, 9, 9, 'Enemy');
    
    // Add allies on opposite sides
    addToken(1, 8, 9, 'Ally');  // Tim
    addToken(1, 11, 9, 'Ally'); // Jerry
  }

  // Example 2: Flanking with allies on multiple sides for maximum bonus
  function loadExample2() {
    // Add a 2x2 enemy in the middle
    const enemyToken = addToken(2, 9, 9, 'Enemy');
    
    // Add allies on all four sides
    addToken(1, 8, 9, 'Ally');  // Tim
    addToken(1, 11, 9, 'Ally'); // Jerry
    addToken(1, 9, 8, 'Ally');  // Clarence
    addToken(1, 9, 11, 'Ally'); // Claus
  }

  // Example 3: Multiple allies on the same side
  function loadExample3() {
    // Add a 2x2 enemy in the middle
    const enemyToken = addToken(2, 9, 9, 'Enemy');
    
    // Add allies, with two on the same side
    addToken(1, 8, 9, 'Ally');  // Tim
    addToken(1, 11, 9, 'Ally'); // Jerry
    addToken(1, 11, 10, 'Ally'); // Claus (same side as Jerry)
  }

  // Example 4: Flanking negated by being flanked
  function loadExample4() {
    // Add a 2x2 enemy in the middle
    const enemyToken = addToken(2, 9, 9, 'Enemy');
    
    // Add allies on all sides
    addToken(1, 8, 9, 'Ally');  // Tim
    addToken(1, 11, 9, 'Ally'); // Jerry
    addToken(1, 9, 8, 'Ally');  // Clarence
    addToken(1, 9, 11, 'Ally'); // Claus
    
    // Add an enemy ally that flanks one of our allies
    addToken(1, 7, 9, 'Enemy'); // Cave Drake's ally
  }

  // --- Public API ---
  return {
    app,
    addToken,
    removeToken,
    resize,
    getTokens: () => tokens.map(t => ({id:t.id, size:t.size, team:t.team, row:t.row, col:t.col})),
    clear: () => { 
      tokens.forEach(removeToken);
      hideTeamPrompt();
      hideFlanking(); 
      hideContextMenu();
      currentState = UIState.IDLE;
      draggingToken = null;
    },
    resetState: () => {
      currentState = UIState.IDLE;
      draggingToken = null;
      hideContextMenu();
      hideFlanking();
      hideTeamPrompt();
      
      tokens.forEach(token => {
        if (token.sprite) {
          token.sprite.alpha = 1;
          token.sprite.tint = 0xffffff;
          token.sprite.filters = null;
          
          const pos = gridToPx(token.row, token.col);
          token.sprite.x = pos.x;
          token.sprite.y = pos.y;
        }
      });
      
      resize();
    }
  };
}

// Make available globally for browser usage
window.createFlankingWidget = createFlankingWidget;

// Add widget loader compatibility
window.renderWidget = function(container) {
  if (!container.style.position || container.style.position === 'static') {
    container.style.position = 'relative';
  }

  // Calculate minimum height needed for the text columns above the grid
  function getMinHeight() {
    // Estimate: titles + instructions + right text + palette + margins
    // These values are based on font sizes and spacing in the widget
    const titleHeight = 32; // leftTitle/rightTitle
    const instrLines = 9; // INSTR_TEXT lines
    const instrLineHeight = 22;
    const instrHeight = instrLines * instrLineHeight;
    const rightTextLines = 15;
    const rightTextLineHeight = 22;
    const rightTextHeight = rightTextLines * rightTextLineHeight;
    const paletteHeight = 44 + 12; // PALETTE_BTN + margin
    const buttonHeight = 40 * 4 + 10 * 3; // 4 example buttons + gaps
    const verticalMargins = 48 + 20 + 20; // top, between, bottom

    // Take the max of left and right columns
    const leftCol = titleHeight + instrHeight + verticalMargins + paletteHeight;
    const rightCol = titleHeight + rightTextHeight + buttonHeight + verticalMargins;

    // Add some extra for grid and padding
    return Math.max(leftCol, rightCol) + 500;
  }

  if (!container.style.height) {
    const minHeight = getMinHeight();
    container.style.height = minHeight + 'px';
    container.style.minHeight = minHeight + 'px';
  }

  const widget = createFlankingWidget(container);

  window.resetFlankingWidget = function() {
    widget.resetState();
    return "Widget state has been reset";
  };

  return widget;
};
