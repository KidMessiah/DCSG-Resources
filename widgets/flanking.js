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
  const COLORS = { Ally: 0x2ecc40, Enemy: 0xe74c3c, Neutral: 0x888888 };
  const PALETTE = [1, 2, 3, 4];
  const BG_COLOR = 0x222222;
  const INSTR_TEXT = "Drag a token onto the grid. After placing, choose Ally or Enemy. Hover over tokens to see flanking bonuses. Right-click for more options.";
  const PALETTE_MARGIN = 12, PALETTE_BTN = 44, PALETTE_GAP = 12;
  const PROMPT_W = 220, PROMPT_H = 110;
  const CONTEXT_MENU_W = 120, CONTEXT_MENU_ITEM_H = 30;

  // --- State ---
  let tokens = [];
  let gridMap = Array.from({length: GRID_SIZE}, () => Array(GRID_SIZE).fill(null));
  let draggingToken = null, nextTokenId = 1;
  let teamPromptToken = null;
  let cellPx = 32, gridOrigin = {x:0, y:0};
  let tempGhost = null; // For palette drag ghost
  let contextMenu = null; // For right-click menu
  let contextMenuTarget = null; // Token being context-menued
  
  // Track UI state to avoid conflicts
  const UIState = {
    IDLE: 'idle',
    DRAGGING: 'dragging',
    TEAM_SELECT: 'team-select',
    HOVERING: 'hovering',
    CONTEXT_MENU: 'context-menu'
  };
  let currentState = UIState.IDLE;

  // --- PixiJS Setup ---
  const width = options.width || 600, height = options.height || 700;
  const app = new PIXI.Application({
    width, height, backgroundColor: BG_COLOR,
    resolution: window.devicePixelRatio || 1, autoDensity: true, antialias: true,
  });
  container.appendChild(app.view);
  
  // Prevent default context menu on the entire canvas
  app.view.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // --- Layers ---
  const gridLayer = new PIXI.Container();
  const tokenLayer = new PIXI.Container();
  const overlayLayer = new PIXI.Container();
  const promptLayer = new PIXI.Container();
  const menuLayer = new PIXI.Container(); // Layer for context menu
  app.stage.addChild(gridLayer, tokenLayer, overlayLayer, promptLayer, menuLayer);

  // --- Instructions ---
  const instr = new PIXI.Text(INSTR_TEXT, {fontSize: 16, fill: '#fff', wordWrap: true, wordWrapWidth: width-20});
  instr.x = 10; instr.y = 10;
  app.stage.addChild(instr);

  // --- Palette ---
  const paletteY = instr.y + instr.height + PALETTE_MARGIN;
  const palette = new PIXI.Container();
  palette.x = 10; palette.y = paletteY;
  app.stage.addChild(palette);
  PALETTE.forEach((size, i) => {
    const btn = new PIXI.Graphics();
    btn.beginFill(0x444444).drawRoundedRect(0, 0, PALETTE_BTN, PALETTE_BTN, 8).endFill();
    btn.lineStyle(2, 0xffffff, 0.7).drawRoundedRect(0, 0, PALETTE_BTN, PALETTE_BTN, 8);
    btn.x = i * (PALETTE_BTN + PALETTE_GAP);
    btn.interactive = true; btn.buttonMode = true;

    // Draw token preview
    btn.beginFill(COLORS.Neutral).drawRect(10, 10, size*8, size*8).endFill();
    const label = new PIXI.Text(`${size}x${size}`, {fontSize: 14, fill: '#fff'});
    label.x = (PALETTE_BTN-label.width)/2; label.y = PALETTE_BTN-18;
    btn.addChild(label);
    palette.addChild(btn);

    // --- Drag from palette ---
    btn.on('pointerdown', (event) => {
      if (currentState !== UIState.IDLE) return;
      
      event.data.originalEvent.preventDefault();
      currentState = UIState.DRAGGING;
      
      // Create ghost token
      let ghost = createTokenGraphics(size, COLORS.Neutral);
      ghost.alpha = 0.7;
      ghost.zIndex = 1000;
      tokenLayer.addChild(ghost);
      tempGhost = ghost;

      const onPointerMove = (e) => {
        const rect = app.view.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (app.view.width / rect.width);
        const y = (e.clientY - rect.top) * (app.view.height / rect.height);
        
        // Determine which grid cell the cursor is over (important for large tokens)
        const {col: cursorCol, row: cursorRow} = pxToGrid(x, y);
        
        // Calculate the top-left corner of a token that would be centered on this cursor position
        // For even-sized tokens (2x2, 4x4), we need to offset by half a cell
        const tokenRow = size % 2 === 0 ? cursorRow - (size/2) + 0.5 : cursorRow - Math.floor(size/2);
        const tokenCol = size % 2 === 0 ? cursorCol - (size/2) + 0.5 : cursorCol - Math.floor(size/2);
        
        // Convert to rounded grid coordinates
        const row = Math.round(tokenRow);
        const col = Math.round(tokenCol);
        
        // Check if this position would be valid
        const isInGrid = isWithinGrid(row, col, size);
        const isValid = isInGrid && isAreaFree(row, col, size);
        
        if (isInGrid) {
            // Snap directly to grid cell
            const {x: snapX, y: snapY} = gridToPx(row, col);
            ghost.x = snapX;
            ghost.y = snapY;
            
            // Visual feedback based on validity
            ghost.alpha = isValid ? 0.8 : 0.4;
            ghost.tint = isValid ? 0xffffff : 0xff0000;
        } else {
            // Outside grid - follow cursor with center of token
            ghost.x = x - (size * cellPx / 2);
            ghost.y = y - (size * cellPx / 2);
            ghost.alpha = 0.4;
            ghost.tint = 0xff0000;
        }
      };
      
      const onPointerUp = (e) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        
        // Reset tint
        ghost.tint = 0xffffff;
        
        const rect = app.view.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (app.view.width / rect.width);
        const y = (e.clientY - rect.top) * (app.view.height / rect.height);
        
        // Get grid cell under cursor
        const {col: cursorCol, row: cursorRow} = pxToGrid(x, y);
        
        // Calculate token position that would center it on cursor
        const tokenRow = size % 2 === 0 ? cursorRow - (size/2) + 0.5 : cursorRow - Math.floor(size/2);
        const tokenCol = size % 2 === 0 ? cursorCol - (size/2) + 0.5 : cursorCol - Math.floor(size/2);
        
        // Round to get final grid position
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

  // --- Grid Placement ---
  const gridY = palette.y + PALETTE_BTN + PALETTE_MARGIN;
  function updateGridMetrics() {
    const availW = width-20, availH = height-gridY-20;
    cellPx = Math.floor(Math.min(availW, availH) / GRID_SIZE);
    gridOrigin.x = 10 + Math.floor((availW - cellPx*GRID_SIZE)/2);
    gridOrigin.y = gridY + Math.floor((availH - cellPx*GRID_SIZE)/2);
  }
  updateGridMetrics();

  // --- Draw Grid ---
  function drawGrid() {
    gridLayer.removeChildren();
    updateGridMetrics();
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0x888888, 1);
    for (let i = 0; i <= GRID_SIZE; ++i) {
      g.moveTo(gridOrigin.x + i * cellPx, gridOrigin.y)
       .lineTo(gridOrigin.x + i * cellPx, gridOrigin.y + GRID_SIZE * cellPx);
      g.moveTo(gridOrigin.x, gridOrigin.y + i * cellPx)
       .lineTo(gridOrigin.x + GRID_SIZE * cellPx, gridOrigin.y + i * cellPx);
    }
    gridLayer.addChild(g);
  }
  drawGrid();

  // --- Helpers ---
  function gridToPx(row, col) {
    // Make sure we're returning exact pixel coordinates for accurate grid snapping
    return { 
      x: Math.round(gridOrigin.x + col * cellPx), 
      y: Math.round(gridOrigin.y + row * cellPx) 
    };
  }
  
  function pxToGrid(x, y) {
    // Adjust for grid origin to ensure accurate conversion
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

  // --- Token Creation ---
  function createTokenGraphics(size, color, label) {
    const g = new PIXI.Graphics();
    g.beginFill(color).drawRect(0, 0, size * cellPx, size * cellPx).endFill();
    g.lineStyle(2, 0xffffff, 0.7).drawRect(0, 0, size * cellPx, size * cellPx);
    
    if (label) {
      const text = new PIXI.Text(label, {
        fontSize: Math.max(16, Math.floor(cellPx * 0.4)), 
        fill: color === COLORS.Ally ? '#000' : '#fff',
        fontWeight: 'bold'
      });
      text.x = (size * cellPx - text.width) / 2;
      text.y = (size * cellPx - text.height) / 2;
      g.addChild(text);
    }
    
    // Add a visual cue that tokens are draggable
    if (!label) { // For neutral tokens from palette
        const dragHint = new PIXI.Text("✥", {
            fontSize: Math.max(16, Math.floor(cellPx * 0.3)),
            fill: '#ffffff'
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
    
    tokenLayer.addChild(sprite);
    token.sprite = sprite;
    
    // Setup event handlers
    setupTokenInteraction(token);
  }

  // Token interaction - refactored for cleaner implementation
  function setupTokenInteraction(token) {
    const sprite = token.sprite;
    
    // Clean event listeners
    sprite.removeAllListeners();
    
    // Make all tokens interactive, not just ones with teams
    sprite.interactive = true;
    sprite.buttonMode = true;
    
    // Store token reference on the sprite
    sprite.token = token;
    
    // Handle right-click for context menu
    sprite.on('rightdown', handleRightClick);
    
    // Handle drag operations
    sprite.on('mousedown', handleDragStart);
    
    // Only add hover events for tokens with teams (for flanking visualization)
    if (token.team) {
        sprite.on('mouseover', handleHoverStart);
        sprite.on('mouseout', handleHoverEnd);
    }

    // Right-click handler function
    function handleRightClick(event) {
        event.stopPropagation();
        hideContextMenu();
        hideFlanking();
        showContextMenu(token, event.data.global.x, event.data.global.y);
    }

    // Drag start handler - completely revised to better handle large tokens
    function handleDragStart(event) {
        // Only handle left mouse button
        if (event.data.originalEvent.button !== 0) return;
        
        // Hide flanking and reset state
        hideFlanking();
        
        // Store original position for potential revert
        const origPos = { x: sprite.x, y: sprite.y };
        const mouseDownTime = Date.now();
        let hasMoved = false;
        const dragThreshold = 3;
        
        // Set up the mousemove handler with improved grid-based positioning
        function handleMouseMove(e) {
            // Get precise cursor position in canvas coordinates
            const rect = app.view.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (app.view.width / rect.width);
            const mouseY = (e.clientY - rect.top) * (app.view.height / rect.height);
            
            // Calculate distance moved from original position
            const dx = mouseX - (origPos.x + token.size * cellPx / 2);
            const dy = mouseY - (origPos.y + token.size * cellPx / 2);
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Only start dragging after threshold is passed
            if (!hasMoved && distance > dragThreshold) {
                hasMoved = true;
                
                // Update global state
                currentState = UIState.DRAGGING;
                draggingToken = token;
                
                // Remove from grid
                occupyGrid(token, false);
                
                // Apply visual feedback
                sprite.alpha = 0.7;
                sprite.zIndex = 1000; // Bring to front while dragging
            }
            
            // Only update position if we're actually dragging
            if (hasMoved) {
                // Determine which grid cell the cursor is over
                const {col: cursorCol, row: cursorRow} = pxToGrid(mouseX, mouseY);
                
                // Calculate the top-left corner position for a token centered on cursor
                // For even-sized tokens (2x2, 4x4), we need to offset by half a cell
                const tokenRow = token.size % 2 === 0 ? cursorRow - (token.size/2) + 0.5 : cursorRow - Math.floor(token.size/2);
                const tokenCol = token.size % 2 === 0 ? cursorCol - (token.size/2) + 0.5 : cursorCol - Math.floor(token.size/2);
                
                // Round to get final grid position
                const row = Math.round(tokenRow);
                const col = Math.round(tokenCol);
                
                // Check if this position would be valid
                const isInGrid = isWithinGrid(row, col, token.size);
                const isValid = isInGrid && isAreaFree(row, col, token.size, token.id);
                
                if (isInGrid) {
                    // Snap token directly to the calculated grid position
                    const snapPos = gridToPx(row, col);
                    sprite.x = snapPos.x;
                    sprite.y = snapPos.y;
                    
                    // Visual feedback based on validity
                    sprite.alpha = isValid ? 0.8 : 0.4;
                    sprite.tint = isValid ? 0xffffff : 0xff6666;
                } else {
                    // Outside grid - follow cursor with center of token
                    sprite.x = mouseX - (token.size * cellPx / 2);
                    sprite.y = mouseY - (token.size * cellPx / 2);
                    sprite.alpha = 0.5;
                    sprite.tint = 0xff9999;
                }
            }
        }
        
        // Set up drag end handler
        function handleMouseUp(e) {
            // Always remove these handlers no matter what
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            
            // Restore zIndex
            sprite.zIndex = 0;
            
            // If we didn't exceed the drag threshold, it's a click
            if (!hasMoved) {
                // Reset any changes we might have made
                sprite.alpha = 1;
                sprite.tint = 0xffffff;
                
                // Reoccupy original position since we might have unoccupied it
                if (token.team) {
                    occupyGrid(token, true);
                }
                
                // For tokens without team, clicking should trigger team selection
                if (!token.team) {
                    showTeamPrompt(token);
                }
                
                return;
            }
            
            // Otherwise, this was a drag that's now ending
            
            // Reset visual state
            sprite.alpha = 1;
            sprite.tint = 0xffffff;
            
            // Get cursor position
            const rect = app.view.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (app.view.width / rect.width);
            const mouseY = (e.clientY - rect.top) * (app.view.height / rect.height);
            
            // Calculate final grid position that would center the token on cursor
            const {col: cursorCol, row: cursorRow} = pxToGrid(mouseX, mouseY);
            const tokenRow = token.size % 2 === 0 ? cursorRow - (token.size/2) + 0.5 : cursorRow - Math.floor(token.size/2);
            const tokenCol = token.size % 2 === 0 ? cursorCol - (token.size/2) + 0.5 : cursorCol - Math.floor(token.size/2);
            
            // Round to get final grid position
            const row = Math.round(tokenRow);
            const col = Math.round(tokenCol);
            
            // Check if position is valid
            if (isWithinGrid(row, col, token.size) && 
                isAreaFree(row, col, token.size, token.id)) {
                
                // Update token data
                token.row = row;
                token.col = col;
                
                // Snap precisely to grid
                const snapPos = gridToPx(row, col);
                sprite.x = snapPos.x;
                sprite.y = snapPos.y;
                
                // Update grid occupancy for tokens with teams
                if (token.team) {
                    occupyGrid(token, true);
                } else {
                    // For neutral tokens that have been moved, prompt for team selection
                    showTeamPrompt(token);
                }
            } else {
                // Return to original position
                sprite.x = origPos.x;
                sprite.y = origPos.y;
                
                // Re-occupy original grid position if token has a team
                if (token.team) {
                    occupyGrid(token, true);
                }
            }
            
            // Reset state
            draggingToken = null;
            currentState = UIState.IDLE;
        }
        
        // Add listeners for drag operation - use window to capture mouse even outside canvas
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    
    // Hover effect handler for flanking
    function handleHoverStart() {
        // Only activate hover if we're in idle state
        if (currentState === UIState.IDLE) {
            currentState = UIState.HOVERING;
            showFlanking(token);
        }
    }
    
    function handleHoverEnd() {
        // Only clear hovering if that's our current state
        if (currentState === UIState.HOVERING) {
            hideFlanking();
            currentState = UIState.IDLE;
        }
    }
  }

  function addToken(size, row, col, team = null) {
    const id = nextTokenId++;
    const token = { id, size, team, row, col, sprite: null };
    tokens.push(token);
    
    // Update appearance and interaction
    updateTokenAppearance(token);
    
    // Add to grid if it has a team
    if (team) {
      occupyGrid(token, true);
    } else {
      // Show team selection for new tokens
      showTeamPrompt(token);
    }
    
    return token;
  }

  // --- Context Menu ---
  function showContextMenu(token, x, y) {
    // Set state
    currentState = UIState.CONTEXT_MENU;
    contextMenuTarget = token;
    
    // Calculate menu height based on number of items
    const menuItems = ['Delete', 'Swap Team'];
    const menuHeight = CONTEXT_MENU_ITEM_H * menuItems.length;
    
    // Create menu container
    const menu = new PIXI.Container();
    
    // Create menu background
    const bg = new PIXI.Graphics()
      .beginFill(0x333333, 0.95)
      .lineStyle(1, 0xffffff, 0.8)
      .drawRoundedRect(0, 0, CONTEXT_MENU_W, menuHeight, 6)
      .endFill();
    menu.addChild(bg);
    
    // Position menu - ensure it stays within viewport
    menu.x = Math.min(x, width - CONTEXT_MENU_W - 5);
    menu.y = Math.min(y, height - menuHeight - 5);
    
    // Add menu items
    menuItems.forEach((item, index) => {
      const itemY = index * CONTEXT_MENU_ITEM_H;
      
      // Create a container for each menu item
      const itemContainer = new PIXI.Container();
      itemContainer.y = itemY;
      
      // Item background for hover effect
      const itemBg = new PIXI.Graphics()
        .beginFill(0x333333, 0.01) // Nearly transparent for hit area
      // Click handler - use pointerdown for left-click selection
      itemBg.on('pointerdown', (e) => {
        // Only process left-click (button 0)
        if (e.data.originalEvent.button !== 0) return;
        
        // Stop event propagation to prevent the stage click handler from firing
        e.stopPropagation();
        
        // Make sure we still have a valid target token
        if (contextMenuTarget) {
          if (item === 'Delete') {
            removeToken(contextMenuTarget);
          } else if (item === 'Swap Team') {
            // Toggle the team
            contextMenuTarget.team = contextMenuTarget.team === 'Ally' ? 'Enemy' : 'Ally';
            updateTokenAppearance(contextMenuTarget);
          }
        }
        
        // Always hide the menu after action
        hideContextMenu();
      });
      
      menu.addChild(itemContainer);
    });
    
    // Add menu to stage
    menuLayer.addChild(menu);
    contextMenu = menu;
    
    // Add global click handler to dismiss menu
    app.stage.on('pointerdown', onStageClick);
  }
  
  function hideContextMenu() {
    if (contextMenu) {
      menuLayer.removeChild(contextMenu);
      contextMenu = null;
      contextMenuTarget = null;
      
      // Remove global handlers
      app.stage.off('pointerup', onStageClick);
      
      if (currentState === UIState.CONTEXT_MENU) {
        currentState = UIState.IDLE;
      }
    }
  }
  
  function onStageClick(e) {
    // Only process if we have an active context menu
    if (contextMenu) {
      // Check if the click was outside the menu
      let isClickInMenu = false;
      
      // Properly detect if the click was inside the menu by checking the target and all its parents
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

  // --- Remove Token ---
  function removeToken(token) {
    occupyGrid(token, false);
    if (token.sprite && token.sprite.parent) {
      token.sprite.parent.removeChild(token.sprite);
    }
    tokens = tokens.filter(t => t.id !== token.id);
  }

  // --- Team Selection ---
  function showTeamPrompt(token) {
    // Exit if we're already showing a prompt
    if (currentState === UIState.TEAM_SELECT) return;
    
    // Clean up
    promptLayer.removeChildren();
    hideFlanking();
    
    // Set state
    teamPromptToken = token;
    currentState = UIState.TEAM_SELECT;
    
    // Create background
    const bg = new PIXI.Graphics();
    bg.beginFill(0x222222, 0.98).drawRoundedRect(0, 0, PROMPT_W, PROMPT_H, 12).endFill();
    bg.lineStyle(2, 0xffffff, 0.7).drawRoundedRect(0, 0, PROMPT_W, PROMPT_H, 12);
    bg.x = (width - PROMPT_W)/2; 
    bg.y = (height - PROMPT_H)/2;
    promptLayer.addChild(bg);

    // Create text
    const txt = new PIXI.Text("Is this token an Ally or Enemy?", {fontSize: 16, fill: '#fff'});
    txt.x = bg.x + (PROMPT_W-txt.width)/2; 
    txt.y = bg.y + 18;
    promptLayer.addChild(txt);

    // Create Ally button
    const btnAlly = new PIXI.Graphics();
    btnAlly.beginFill(COLORS.Ally).drawRoundedRect(0, 0, 80, 32, 8).endFill();
    btnAlly.lineStyle(2, 0xffffff, 0.7).drawRoundedRect(0, 0, 80, 32, 8);
    btnAlly.x = bg.x + 20; 
    btnAlly.y = bg.y + PROMPT_H-48;
    btnAlly.interactive = true; 
    btnAlly.buttonMode = true;
    btnAlly.on('pointerdown', () => assignTeam('Ally'));
    
    const lblA = new PIXI.Text("Ally", {fontSize: 16, fill: '#000'});
    lblA.x = btnAlly.x + (80-lblA.width)/2; 
    lblA.y = btnAlly.y + 6;
    promptLayer.addChild(btnAlly, lblA);

    // Create Enemy button
    const btnEnemy = new PIXI.Graphics();
    btnEnemy.beginFill(COLORS.Enemy).drawRoundedRect(0, 0, 80, 32, 8).endFill();
    btnEnemy.lineStyle(2, 0xffffff, 0.7).drawRoundedRect(0, 0, 80, 32, 8);
    btnEnemy.x = bg.x + PROMPT_W-100; 
    btnEnemy.y = bg.y + PROMPT_H-48;
    btnEnemy.interactive = true; 
    btnEnemy.buttonMode = true;
    btnEnemy.on('pointerdown', () => assignTeam('Enemy'));
    
    const lblE = new PIXI.Text("Enemy", {fontSize: 16, fill: '#fff'});
    lblE.x = btnEnemy.x + (80-lblE.width)/2; 
    lblE.y = btnEnemy.y + 6;
    promptLayer.addChild(btnEnemy, lblE);
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
    
    // Update token team
    const token = teamPromptToken;
    token.team = team;
    
    // Update grid
    occupyGrid(token, true);
    
    // Update token appearance
    updateTokenAppearance(token);
    
    // Clean up
    hideTeamPrompt();
  }

  // --- Flanking Logic ---
  function showFlanking(token) {
    if (currentState !== UIState.HOVERING || !token.team) return;
    
    // Check if the hovered token is flanked
    const isHoveredTokenFlanked = isTokenFlanked(token);
    
    // Find adjacent enemies 
    const opposingTeam = token.team === 'Ally' ? 'Enemy' : 'Ally';
    const adjacentEnemies = findAdjacentEnemies(token);
    
    // Add basic highlight to the hovered token - red if flanked, cyan if not
    try {
      if (PIXI.filters.GlowFilter) {
        token.sprite.filters = [
          new PIXI.filters.GlowFilter({
            distance: 8,
            color: isHoveredTokenFlanked ? 0xFF0000 : 0x00ffff,
            outerStrength: 2
          })
        ];
      } else {
        token.sprite.tint = isHoveredTokenFlanked ? 0xFF0000 : 0x00ffff;
      }
    } catch (e) {
      token.sprite.tint = isHoveredTokenFlanked ? 0xFF0000 : 0x00ffff;
    }

    // If the token is flanked, show an indicator and explanation
    if (isHoveredTokenFlanked) {
      const label = new PIXI.Text("FLANKED", {
        fontSize: 14, 
        fill: '#ff0000', 
        fontWeight: 'bold', 
        stroke: '#000', 
        strokeThickness: 3
      });
      label.x = token.sprite.x + (token.size * cellPx / 2);
      label.y = token.sprite.y - 10;
      label.anchor.set(0.5, 1);
      overlayLayer.addChild(label);
      
      const subLabel = new PIXI.Text("Cannot provide flanking", {
        fontSize: 12, 
        fill: '#ffffff', 
        stroke: '#000', 
        strokeThickness: 2
      });
      subLabel.x = token.sprite.x + (token.size * cellPx / 2);
      subLabel.y = token.sprite.y + 5;
      subLabel.anchor.set(0.5, 1);
      overlayLayer.addChild(subLabel);
      
      // Show which units are flanking this token
      const flankingUnits = tokens.filter(t => 
        t.team !== token.team && calculateFlankingBonus(t, token) > 0
      );
      
      flankingUnits.forEach(flanker => {
        // Highlight the flanking units
        const highlight = new PIXI.Graphics();
        highlight.lineStyle(3, 0xff6600)  // Orange for flanking units
          .drawRect(0, 0, flanker.size * cellPx, flanker.size * cellPx);
        highlight.x = flanker.sprite.x;
        highlight.y = flanker.sprite.y;
        overlayLayer.addChild(highlight);
        
        // Draw connecting lines
        const lineGraphic = new PIXI.Graphics();
        lineGraphic.lineStyle(2, 0xff6600, 0.7)
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
    
    // Only show flanking bonuses if this token isn't already flanked
    if (!isHoveredTokenFlanked) {
      // Check which enemies this token can flank
      adjacentEnemies.forEach(target => {
        // Calculate flanking bonus for this target
        const bonus = calculateFlankingBonus(token, target);
        
        // Only proceed if there's an actual flanking bonus
        if (bonus > 0) {
          // Add a rectangle highlight
          const highlight = new PIXI.Graphics();
          highlight.lineStyle(3, 0xffff00)
            .drawRect(0, 0, target.size * cellPx, target.size * cellPx);
          highlight.x = target.sprite.x;
          highlight.y = target.sprite.y;
          overlayLayer.addChild(highlight);
          
          // Add flanking bonus label
          const label = new PIXI.Text(`+${bonus} Flanking`, {
            fontSize: 14, 
            fill: '#ff0', 
            fontWeight: 'bold', 
            stroke: '#000', 
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
                  color: 0xffff00, // Yellow for being flanked
                  outerStrength: 2
                })
              ];
            } else {
              target.sprite.tint = 0xffff00;
            }
          } catch (e) {
            target.sprite.tint = 0xffff00;
          }
          
          // Draw a line connecting the hovering token and the flanked token
          const lineGraphic = new PIXI.Graphics();
          lineGraphic.lineStyle(2, 0xffffff, 0.7)
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
    
    // Find all enemies adjacent to this token
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
            // Always reset visual state unless actively being dragged
            if (t !== draggingToken || currentState !== UIState.DRAGGING) {
                t.sprite.filters = null;
                t.sprite.tint = 0xffffff;
                t.sprite.alpha = 1; // Ensure alpha gets reset too
            }
        }
    });
    
    // Update state unless we're dragging
    if (currentState === UIState.HOVERING) {
        currentState = UIState.IDLE;
    }
  }

  function isTokenFlanked(token) {
    if (!token || !token.team) return false;
    
    // First, find all units of the opposing team
    const opposingTeam = token.team === 'Ally' ? 'Enemy' : 'Ally';
    const enemies = tokens.filter(t => t.team === opposingTeam);
    
    // Find all enemies that are adjacent to this token
    const adjacentEnemies = enemies.filter(enemy => 
      isAdjacentNorth(enemy, token) || 
      isAdjacentSouth(enemy, token) || 
      isAdjacentEast(enemy, token) || 
      isAdjacentWest(enemy, token)
    );
    
    // Check if there are enemies on opposite sides
    const hasNorthEnemy = adjacentEnemies.some(e => isAdjacentNorth(e, token));
    const hasSouthEnemy = adjacentEnemies.some(e => isAdjacentSouth(e, token));
    const hasEastEnemy = adjacentEnemies.some(e => isAdjacentEast(e, token));
    const hasWestEnemy = adjacentEnemies.some(e => isAdjacentWest(e, token));
    
    // If there are enemies on opposite sides, the token is flanked
    return (hasNorthEnemy && hasSouthEnemy) || (hasEastEnemy && hasWestEnemy);
  }

  function calculateFlankingBonus(attacker, target) {
    if (!attacker || !target || attacker.team === target.team) return 0;
    
    // Basic adjacency check
    const isAdjacent = isAdjacentNorth(attacker, target) || 
                      isAdjacentSouth(attacker, target) || 
                      isAdjacentEast(attacker, target) || 
                      isAdjacentWest(attacker, target);
    
    if (!isAdjacent) return 0;
    
    // Check if the attacker is flanked - if so, they can't provide flanking benefits
    // This applies to both allies and enemies equally
    if (isTokenFlanked(attacker)) {
      return 0; // Flanked units cannot provide flanking bonuses
    }
    
    // Find all friendly units (same team as attacker) that could contribute to flanking
    const friendlyUnits = tokens.filter(t => 
      t.id !== attacker.id && 
      t.team === attacker.team && 
      !isTokenFlanked(t) // Units that are themselves flanked can't provide flanking
    );
    
    // Determine which side the attacker is on
    const isNorth = isAdjacentNorth(attacker, target);
    const isSouth = isAdjacentSouth(attacker, target);
    const isEast = isAdjacentEast(attacker, target);
    const isWest = isAdjacentWest(attacker, target);
    
    // Find if there's a unit on the opposite side
    const hasSouthAlly = friendlyUnits.some(ally => isAdjacentSouth(ally, target));
    const hasNorthAlly = friendlyUnits.some(ally => isAdjacentNorth(ally, target));
    const hasWestAlly = friendlyUnits.some(ally => isAdjacentWest(ally, target));
    const hasEastAlly = friendlyUnits.some(ally => isAdjacentEast(ally, target));
    
    // Calculate basic flanking bonus (opposite sides)
    let bonus = 0;
    if ((isNorth && hasSouthAlly) || (isSouth && hasNorthAlly) || 
        (isEast && hasWestAlly) || (isWest && hasEastAlly)) {
      bonus = 2;
    }
    
    // If we have basic flanking, check for additional flanking from other sides
    if (bonus === 2) {
      // Count how many additional sides have friendly units
      let additionalSides = 0;
      
      // Don't count sides the attacker is already on
      if (!isNorth && !isSouth) {
        if (hasNorthAlly && !isNorth) additionalSides++;
        if (hasSouthAlly && !isSouth) additionalSides++;
      }
      
      if (!isEast && !isWest) {
        if (hasEastAlly && !isEast) additionalSides++;
        if (hasWestAlly && !isWest) additionalSides++;
      }
      
      // Each additional side gives +1 bonus
      bonus += Math.min(additionalSides, 2); // Cap at +4 total
    }
    
    return bonus;
  }

  function getFlankedTokens(token) {
    // An ally can flank enemies, and an enemy can flank allies
    const opposingTeam = token.team === 'Ally' ? 'Enemy' : 'Ally';
    const targets = tokens.filter(t => t.team === opposingTeam);
    
    // Get all enemies where this token contributes to flanking
    return targets.filter(target => calculateFlankingBonus(token, target) > 0);
  }

  // Helper functions for flanking checks
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
  function resize(w, h) {
    app.renderer.resize(w, h);
    instr.style.wordWrapWidth = w-20;
    drawGrid();
    
    // Update all tokens
    tokens.forEach(token => {
      updateTokenAppearance(token);
    });
    
    // Hide context menu if it exists
    hideContextMenu();
  }
  
  window.addEventListener('resize', () => {
    resize(container.clientWidth, container.clientHeight);
  });

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
    // Add reset state function for emergency recovery
    resetState: () => {
      currentState = UIState.IDLE;
      draggingToken = null;
      hideContextMenu();
      hideFlanking();
      hideTeamPrompt();
      
      // Reset all tokens to their visual state
      tokens.forEach(token => {
        if (token.sprite) {
          token.sprite.alpha = 1;
          token.sprite.tint = 0xffffff;
          token.sprite.filters = null;
          
          // Make sure it's at the right position
          const pos = gridToPx(token.row, token.col);
          token.sprite.x = pos.x;
          token.sprite.y = pos.y;
        }
      });
    }
  };
}

// Make available globally for browser usage
window.createFlankingWidget = createFlankingWidget;

// Add widget loader compatibility
window.renderWidget = function(container) {
  const widget = createFlankingWidget(container);
  
  // Add global emergency reset function
  window.resetFlankingWidget = function() {
    widget.resetState();
    return "Widget state has been reset";
  };
  
  return widget;
};
