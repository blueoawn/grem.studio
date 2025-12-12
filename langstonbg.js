// Langston's Ant Background Effect
// Creates beautiful trailing ant patterns across the screen

(function() {
  const canvas = document.getElementById('ant-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.body);
  const containerEl = document.getElementById('container');
  if (!containerEl) return;

  // Get CSS variables or use defaults
  const CELL_SIZE = parseFloat(css.getPropertyValue('--cell-size')) || 8;
  const ANT_COUNT = parseInt(css.getPropertyValue('--ant-count')) || 30;
  const HUE_SPEED_STR = css.getPropertyValue('--hue-speed') || '15deg';
  const HUE_SPEED = parseFloat(HUE_SPEED_STR);

  // Spawn configuration (along main rectangle edges)
  const SPAWN_CONFIG = {
    edgeDensity: 1.0 // 1.0 = distribute ants evenly along perimeter
  };

  let width = window.innerWidth;
  let height = window.innerHeight;
  let currentHue = 180;

  // Position and resize canvas to sit behind #container
  function resizeCanvas() {
    const rect = containerEl.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));

    canvas.width = width;
    canvas.height = height;

    // Place canvas behind the container, aligned to its box
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    canvas.style.position = 'absolute';
    canvas.style.left = `${rect.left + scrollX}px`;
    canvas.style.top = `${rect.top + scrollY}px`;
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', resizeCanvas);

  // Grid to store cells
  const grid = new Map();

  // Generate spawn positions along the rectangle perimeter of <main>
  function generateSpawnPositions(count) {
    const positions = [];
    const gridWidth = Math.floor(width / CELL_SIZE);
    const gridHeight = Math.floor(height / CELL_SIZE);
    const perim = 2 * (gridWidth + gridHeight);
    for (let i = 0; i < count; i++) {
      const t = (i / count) * perim;
      let gx, gy;
      if (t < gridWidth) {
        // top edge left->right
        gx = Math.floor(t);
        gy = 0;
      } else if (t < gridWidth + gridHeight) {
        // right edge top->bottom
        gx = gridWidth - 1;
        gy = Math.floor(t - gridWidth);
      } else if (t < 2 * gridWidth + gridHeight) {
        // bottom edge right->left
        gx = Math.floor((2 * gridWidth + gridHeight) - t - 1);
        gy = gridHeight - 1;
      } else {
        // left edge bottom->top
        gx = 0;
        gy = Math.floor(perim - t - 1);
      }
      // Convert to percentage of canvas for existing constructor
      const percentX = (gx / gridWidth) * 100;
      const percentY = (gy / gridHeight) * 100;
      positions.push([percentX, percentY]);
    }
    return positions;
  }

  let spawnPositions = generateSpawnPositions(ANT_COUNT);

  // Ant class
  class Ant {
    constructor(index, totalAnts) {
      // Use predefined positions, or wrap around if more ants than positions
      const posIndex = index % spawnPositions.length;
      const [percentX, percentY] = spawnPositions[posIndex];
      
      const gridWidth = Math.floor(width / CELL_SIZE);
      const gridHeight = Math.floor(height / CELL_SIZE);
      
      this.x = Math.floor((percentX / 100) * gridWidth);
      this.y = Math.floor((percentY / 100) * gridHeight);
      this.dir = Math.floor(Math.random() * 4); // 0=N, 1=E, 2=S, 3=W
      // Bias initial direction along edges: move inward slightly so trails bleed out
      if (this.y === 0) this.dir = 2; // from top go south
      else if (this.x === gridWidth - 1) this.dir = 3; // from right go west
      else if (this.y === gridHeight - 1) this.dir = 0; // from bottom go north
      else if (this.x === 0) this.dir = 1; // from left go east
      this.offset = index * (360 / totalAnts);
      this.targetX = this.x;
      this.targetY = this.y;
      this.wanderTimer = 0;
      
      // Assign ant to a region (3x3 grid subdivision)
      const regionX = Math.floor((this.x / gridWidth) * 3);
      const regionY = Math.floor((this.y / gridHeight) * 3);
      this.regionX = Math.max(0, Math.min(2, regionX));
      this.regionY = Math.max(0, Math.min(2, regionY));
    }
    
    getRegionBounds() {
      const gridWidth = Math.floor(width / CELL_SIZE);
      const gridHeight = Math.floor(height / CELL_SIZE);
      const regionWidth = Math.ceil(gridWidth / 3);
      const regionHeight = Math.ceil(gridHeight / 3);
      
      const minX = this.regionX * regionWidth;
      const maxX = Math.min(gridWidth - 1, (this.regionX + 1) * regionWidth - 1);
      const minY = this.regionY * regionHeight;
      const maxY = Math.min(gridHeight - 1, (this.regionY + 1) * regionHeight - 1);
      
      return { minX, maxX, minY, maxY };
    }

    step() {
      const key = `${this.x},${this.y}`;
      const cellState = grid.get(key) || 0;
      
      // Langston's Ant rules:
      // If cell is 0 (off): turn right, flip cell, move forward
      // If cell is 1 (on): turn left, flip cell, move forward
      if (cellState === 0) {
        this.dir = (this.dir + 1) % 4; // Turn right
        grid.set(key, 1);
      } else {
        this.dir = (this.dir + 3) % 4; // Turn left
        grid.set(key, 0);
      }

      // Move forward
      switch(this.dir) {
        case 0: this.y--; break; // North
        case 1: this.x++; break; // East
        case 2: this.y++; break; // South
        case 3: this.x--; break; // West
      }

      // Wander around the screen - constrained to region
      this.wanderTimer--;
      if (this.wanderTimer <= 0) {
        const bounds = this.getRegionBounds();
        const regionWidth = bounds.maxX - bounds.minX + 1;
        const regionHeight = bounds.maxY - bounds.minY + 1;
        
        if (Math.random() < 0.4) {
          // 40% chance to pick an edge of the region
          const edge = Math.floor(Math.random() * 4);
          if (edge === 0) {
            // Top edge of region
            this.targetX = bounds.minX + Math.floor(Math.random() * regionWidth);
            this.targetY = bounds.minY;
          } else if (edge === 1) {
            // Right edge of region
            this.targetX = bounds.maxX;
            this.targetY = bounds.minY + Math.floor(Math.random() * regionHeight);
          } else if (edge === 2) {
            // Bottom edge of region
            this.targetX = bounds.minX + Math.floor(Math.random() * regionWidth);
            this.targetY = bounds.maxY;
          } else {
            // Left edge of region
            this.targetX = bounds.minX;
            this.targetY = bounds.minY + Math.floor(Math.random() * regionHeight);
          }
        } else {
          // 60% chance for random position within region
          this.targetX = bounds.minX + Math.floor(Math.random() * regionWidth);
          this.targetY = bounds.minY + Math.floor(Math.random() * regionHeight);
        }
        this.wanderTimer = 180 + Math.floor(Math.random() * 120); // 3-5 seconds
      }

      // Gradually move towards wander target
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist > 30) {
        // Nudge ant towards wander target
        if (Math.random() < 0.05) {
          if (Math.abs(dx) > Math.abs(dy)) {
            this.x += Math.sign(dx);
          } else {
            this.y += Math.sign(dy);
          }
        }
      }

      // Keep ants within the main rectangle
      const maxX = Math.floor(width / CELL_SIZE) - 1;
      const maxY = Math.floor(height / CELL_SIZE) - 1;
      if (this.x < 0) this.x = 0;
      if (this.x > maxX) this.x = maxX;
      if (this.y < 0) this.y = 0;
      if (this.y > maxY) this.y = maxY;
    }
  }

  // Create ants
  const ants = [];
  function initAnts() {
    ants.length = 0;
    spawnPositions = generateSpawnPositions(ANT_COUNT);
    for (let i = 0; i < ANT_COUNT; i++) {
      ants.push(new Ant(i, ANT_COUNT));
    }
  }
  initAnts();
  console.log(`Created ${ants.length} ants at positions:`, spawnPositions);

  // Fade old cells
  function fadeGrid() {
    const toDelete = [];
    grid.forEach((v, k) => {
      if (Math.random() < 0.0041) { // 0.3% chance to fade each frame (slower fade)
        toDelete.push(k);
      }
    });
    toDelete.forEach(k => grid.delete(k));
  }

  // Animation loop
  function animate() {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Update hue
    currentHue = (currentHue + HUE_SPEED / 60) % 360;

    // Move ants
    for (let i = 0; i < 3; i++) { // 3 steps per frame for faster movement
      ants.forEach(ant => ant.step());
    }

    // Fade old cells
    fadeGrid();

    // Render grid - no camera offset, just render directly
    grid.forEach((v, k) => {
      const [gx, gy] = k.split(',').map(Number);
      const sx = gx * CELL_SIZE;
      const sy = gy * CELL_SIZE;
      
      // Skip if off-screen
      if (sx < -CELL_SIZE || sx > width + CELL_SIZE || 
          sy < -CELL_SIZE || sy > height + CELL_SIZE) return;

      const r = CELL_SIZE * 0.75;
      const grad = ctx.createRadialGradient(
        sx + CELL_SIZE / 2, sy + CELL_SIZE / 2, 0,
        sx + CELL_SIZE / 2, sy + CELL_SIZE / 2, r
      );

      const alpha = parseFloat(css.getPropertyValue('--cell-alpha')) || 0.85;
      const glow = parseFloat(css.getPropertyValue('--glow-strength')) || 0.35;

      grad.addColorStop(0, `hsla(${currentHue}, 85%, 65%, ${alpha})`);
      grad.addColorStop(1, `hsla(${currentHue}, 85%, 50%, 0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(sx - r / 2, sy - r / 2, CELL_SIZE + r, CELL_SIZE + r);

      ctx.shadowBlur = CELL_SIZE * 2 * glow;
      ctx.shadowColor = `hsla(${currentHue}, 90%, 70%, 0.6)`;
    });
    ctx.shadowBlur = 0;

    requestAnimationFrame(animate);
  }

  // Start animation
  animate();

  // Re-initialize on layout changes to keep edge alignment
  const ro = new ResizeObserver(() => {
    resizeCanvas();
    initAnts();
  });
  ro.observe(containerEl);
})();

