// A single particle sculpture is used in the hero and in each scroll chapter.
(() => {
  const heroCanvas = document.querySelector('#particle-hero');
  const storyCanvas = document.querySelector('#particle-morph');
  if (!heroCanvas || !storyCanvas) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const toothPath = new Path2D('M -112 -165 C -155 -188 -183 -145 -174 -91 C -170 -52 -147 -20 -137 29 C -124 90 -116 160 -87 179 C -56 194 -48 107 -31 65 C -18 32 7 35 22 68 C 40 110 47 190 76 179 C 109 166 112 93 133 33 C 151 -17 174 -61 171 -109 C 169 -163 126 -184 91 -167 C 49 -147 19 -146 -13 -160 C -51 -177 -78 -181 -112 -165 Z');
  const hitCanvas = document.createElement('canvas');
  const hit = hitCanvas.getContext('2d');
  let seed = 39021;
  const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
  const between = (a, b) => a + random() * (b - a);
  const line = (ax, ay, bx, by, spread = 2) => {
    const t = random();
    return { x: ax + (bx - ax) * t + between(-spread, spread), y: ay + (by - ay) * t + between(-spread, spread) };
  };
  const circle = (cx, cy, radius, filled = false) => {
    const angle = random() * Math.PI * 2;
    const r = filled ? Math.sqrt(random()) * radius : radius + between(-3, 3);
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };
  const rectangle = (x, y, width, height) => ({ x: between(x, x + width), y: between(y, y + height) });
  const segments = (parts) => {
    const total = parts.reduce((sum, part) => sum + part[0], 0);
    let chance = random() * total;
    for (const [weight, fn] of parts) { chance -= weight; if (chance <= 0) return fn(); }
    return parts[parts.length - 1][1]();
  };

  function tooth() {
    let x, y;
    do { x = between(-184, 184); y = between(-190, 190); }
    while (!hit.isPointInPath(toothPath, x, y));
    return { x, y };
  }

  // A bright particle rim keeps each completed silhouette readable while it rotates.
  const toothRim = [];
  for (let y = -186; y <= 186; y += 4) {
    for (let x = -182; x <= 182; x += 4) {
      if (!hit.isPointInPath(toothPath, x, y)) continue;
      if (!hit.isPointInPath(toothPath, x + 6, y) || !hit.isPointInPath(toothPath, x - 6, y) ||
          !hit.isPointInPath(toothPath, x, y + 6) || !hit.isPointInPath(toothPath, x, y - 6)) {
        toothRim.push({ x, y });
      }
    }
  }
  const toothOutline = () => {
    const point = toothRim[Math.floor(random() * toothRim.length)];
    return { x: point.x + between(-2, 2), y: point.y + between(-2, 2) };
  };
  const rectOutline = (x, y, width, height) => segments([
    [width, () => line(x, y, x + width, y, 1)],
    [width, () => line(x, y + height, x + width, y + height, 1)],
    [height, () => line(x, y, x, y + height, 1)],
    [height, () => line(x + width, y, x + width, y + height, 1)]
  ]);

  function calendar() {
    return segments([
      [5, () => segments([
        [1, () => line(-145, -132, 145, -132)], [1, () => line(-145, 132, 145, 132)],
        [1, () => line(-145, -132, -145, 132)], [1, () => line(145, -132, 145, 132)],
        [1, () => line(-145, -83, 145, -83)]
      ])],
      [1, () => rectangle(-93, -159, 20, 55)], [1, () => rectangle(73, -159, 20, 55)],
      [5, () => { const col = Math.floor(random() * 4), row = Math.floor(random() * 3); return rectangle(-117 + col * 62, -58 + row * 53, 36, 25); }]
    ]);
  }

  function calendarOutline() {
    return segments([
      [6, () => rectOutline(-145, -132, 290, 264)],
      [2, () => line(-145, -83, 145, -83, 1)],
      [1, () => rectOutline(-93, -159, 20, 55)],
      [1, () => rectOutline(73, -159, 20, 55)],
      [5, () => { const col = Math.floor(random() * 4), row = Math.floor(random() * 3); return rectOutline(-117 + col * 62, -58 + row * 53, 36, 25); }]
    ]);
  }

  function patients() {
    const nodes = [[0, -73, 58], [-112, 49, 35], [112, 49, 35], [0, 131, 26]];
    return segments([
      [7, () => { const [x, y, r] = nodes[Math.floor(random() * nodes.length)]; return circle(x, y, r, random() < .45); }],
      [3, () => { const node = nodes[1 + Math.floor(random() * 3)]; return line(0, -73, node[0], node[1], 2); }]
    ]);
  }

  function patientsOutline() {
    const nodes = [[0, -73, 58], [-112, 49, 35], [112, 49, 35], [0, 131, 26]];
    return segments([
      [7, () => { const [x, y, r] = nodes[Math.floor(random() * nodes.length)]; return circle(x, y, r); }],
      [3, () => { const node = nodes[1 + Math.floor(random() * 3)]; return line(0, -73, node[0], node[1], 1); }]
    ]);
  }

  function finance() {
    const heights = [68, 110, 92, 158, 207];
    return segments([
      [9, () => { const col = Math.floor(random() * 5); return rectangle(-144 + col * 60, 105 - heights[col], 36, heights[col]); }],
      [1, () => line(-155, 108, 152, 108)]
    ]);
  }

  function financeOutline() {
    const heights = [68, 110, 92, 158, 207];
    return segments([
      [9, () => { const col = Math.floor(random() * 5); return rectOutline(-144 + col * 60, 105 - heights[col], 36, heights[col]); }],
      [1, () => line(-155, 108, 152, 108, 1)]
    ]);
  }

  const samplers = [tooth, calendar, patients, finance];
  const outlines = [toothOutline, calendarOutline, patientsOutline, financeOutline];
  const count = matchMedia('(max-width: 760px)').matches ? 1750 : 3000;
  const palette = ['#e4ffec', '#b9ffd0', '#8af2b3', '#57dc9d', '#2abf8e', '#a993ff', '#ffd789'];
  const rimPalette = ['#f2fff6', '#cbffdc', '#9dffc1', '#83f5b6'];
  const points = Array.from({ length: count }, (_, index) => {
    const edge = index >= count * .68;
    return {
      edge,
      targets: (edge ? outlines : samplers).map(sample => ({ ...sample(), z: between(edge ? -16 : -43, edge ? 16 : 43) })),
      color: (edge ? rimPalette : palette)[Math.floor(random() * (edge ? rimPalette : palette).length)],
      size: edge ? between(1.35, 2.25) : between(1.05, 1.85),
      phase: random() * Math.PI * 2
    };
  });

  function createScene(canvas) {
    const context = canvas.getContext('2d', { alpha: true });
    const scene = { canvas, context, width: 0, height: 0, yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, pointer: false };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(devicePixelRatio || 1, 2);
      scene.width = bounds.width;
      scene.height = bounds.height;
      canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      renderScene(scene, canvas === heroCanvas ? 0 : storyProgress, performance.now());
    };
    new ResizeObserver(resize).observe(canvas);
    canvas.addEventListener('pointermove', event => {
      const bounds = canvas.getBoundingClientRect();
      scene.pointer = true;
      scene.targetYaw = ((event.clientX - bounds.left) / bounds.width - .5) * 1.05;
      scene.targetPitch = -((event.clientY - bounds.top) / bounds.height - .5) * .58;
      if (reducedMotion.matches) {
        scene.yaw = scene.targetYaw;
        scene.pitch = scene.targetPitch;
        renderScene(scene, canvas === heroCanvas ? 0 : storyProgress, performance.now());
      }
    });
    const resetPointer = () => {
      scene.pointer = false;
      if (reducedMotion.matches) {
        scene.yaw = 0;
        scene.pitch = 0;
        renderScene(scene, canvas === heroCanvas ? 0 : storyProgress, performance.now());
      }
    };
    canvas.addEventListener('pointerleave', resetPointer);
    canvas.addEventListener('pointercancel', resetPointer);
    return scene;
  }

  let storyProgress = 0;
  const hero = createScene(heroCanvas);
  const story = createScene(storyCanvas);
  const chapters = [...document.querySelectorAll('.morph-chapter')];
  const storySection = document.querySelector('#morph-story');
  const label = document.querySelector('#morph-label');
  const labels = ['من السن... تبدأ الحكاية', 'مواعيد مرتبة', 'علاقة أقرب بالمريض', 'أرقام واضحة'];

  function updateStory() {
    const focus = innerHeight * .58;
    const centers = chapters.map(chapter => {
      const bounds = chapter.getBoundingClientRect();
      return bounds.top + bounds.height / 2;
    });
    if (focus <= centers[0]) storyProgress = 0;
    else if (focus >= centers[centers.length - 1]) storyProgress = centers.length - 1;
    else {
      for (let i = 0; i < centers.length - 1; i++) {
        if (focus >= centers[i] && focus < centers[i + 1]) {
          storyProgress = i + (focus - centers[i]) / (centers[i + 1] - centers[i]);
          break;
        }
      }
    }
    const active = Math.round(storyProgress);
    chapters.forEach((chapter, index) => chapter.classList.toggle('is-active', index === active));
    label.textContent = labels[active];
    if (reducedMotion.matches) renderScene(story, storyProgress, performance.now());
  }

  function renderScene(scene, progress, time) {
    const { context: ctx, width, height } = scene;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const current = Math.min(2, Math.floor(progress));
    const blend = Math.min(1, Math.max(0, progress - current));
    const ease = blend * blend * (3 - 2 * blend);
    const idle = reducedMotion.matches ? 0 : time * .00022;
    const yaw = scene.yaw + Math.sin(idle) * .075;
    const pitch = scene.pitch + Math.cos(idle * .7) * .035;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const scale = Math.min(width / 430, height / 460);
    const centerX = width / 2, centerY = height * .47;
    ctx.globalCompositeOperation = 'lighter';
    points.forEach((point, index) => {
      const a = point.targets[current];
      const b = point.targets[current + 1] || a;
      const x = a.x + (b.x - a.x) * ease;
      const y = a.y + (b.y - a.y) * ease;
      const z = a.z + (b.z - a.z) * ease;
      const turnedX = x * cosY + z * sinY;
      const turnedZ = z * cosY - x * sinY;
      const turnedY = y * cosP - turnedZ * sinP;
      const depth = y * sinP + turnedZ * cosP;
      const perspective = 520 / (520 - depth);
      const px = centerX + turnedX * scale * perspective;
      const py = centerY + turnedY * scale * perspective;
      const size = point.size * scale * perspective;
      const glow = reducedMotion.matches ? 0 : Math.sin(time * .0014 + point.phase) * .12;
      ctx.globalAlpha = point.edge ? .82 + glow * .45 : Math.max(.48, Math.min(.84, .69 + depth / 340 + glow));
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size * .85, py + size * .7);
      ctx.lineTo(px - size * .85, py + size * .7);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateStory(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', updateStory);
  reducedMotion.addEventListener('change', updateStory);
  updateStory();

  function animate(time) {
    if (!document.hidden && !reducedMotion.matches) {
      for (const scene of [hero, story]) {
        scene.yaw += ((scene.pointer ? scene.targetYaw : 0) - scene.yaw) * .075;
        scene.pitch += ((scene.pointer ? scene.targetPitch : 0) - scene.pitch) * .075;
      }
      if (heroCanvas.getBoundingClientRect().bottom > 0) renderScene(hero, 0, time);
      const bounds = storySection.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < innerHeight) renderScene(story, storyProgress, time);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
