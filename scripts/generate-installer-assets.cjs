const fs = require('node:fs');
const path = require('node:path');

const output = path.join(__dirname, '..', 'build');
const colors = {
  deep: [8, 11, 10],
  dark: [15, 21, 18],
  panel: [20, 30, 25],
  green: [182, 243, 106],
  softGreen: [87, 126, 58],
  white: [226, 233, 222],
  dim: [121, 143, 119],
};

const glyphs = {
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '.': ['00000','00000','00000','00000','00000','00110','00110'],
};

function makeCanvas(width, height) {
  const pixels = new Uint8Array(width * height * 3);
  function setPixel(x, y, color) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const at = (y * width + x) * 3;
    pixels[at] = color[2]; pixels[at + 1] = color[1]; pixels[at + 2] = color[0];
  }
  function rect(x, y, w, h, color) {
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py++) for (let px = Math.max(0, x); px < Math.min(width, x + w); px++) setPixel(px, py, color);
  }
  function line(x0, y0, x1, y1, color, thickness = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      rect(x0 - Math.floor(thickness / 2), y0 - Math.floor(thickness / 2), thickness, thickness, color);
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
    }
  }
  function polygon(points, color) {
    const ys = points.map(point => point[1]);
    const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)));
    for (let y = minY; y <= maxY; y++) {
      const intersections = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y)) intersections.push((xj - xi) * (y - yi) / (yj - yi) + xi);
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) {
        for (let x = Math.max(0, Math.ceil(intersections[i])); x < Math.min(width, Math.floor(intersections[i + 1])); x++) setPixel(x, y, color);
      }
    }
  }
  function circle(cx, cy, radius, color, filled = false) {
    const outer = radius * radius, inner = (radius - 1) * (radius - 1);
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, Math.ceil(cx + radius)); x++) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (filled ? d <= outer : d <= outer && d >= inner) setPixel(x, y, color);
      }
    }
  }
  function text(value, x, y, scale, color) {
    let cursor = x;
    for (const char of value) {
      if (char === ' ') { cursor += scale * 4; continue; }
      const bitmap = glyphs[char];
      if (!bitmap) continue;
      bitmap.forEach((row, rowIndex) => [...row].forEach((on, column) => {
        if (on === '1') rect(cursor + column * scale, y + rowIndex * scale, scale, scale, color);
      }));
      cursor += scale * 6;
    }
  }
  return { width, height, pixels, setPixel, rect, line, polygon, circle, text };
}

function backdrop(canvas) {
  const { width, height, setPixel } = canvas;
  for (let y = 0; y < height; y++) {
    const t = y / Math.max(1, height - 1);
    const color = colors.deep.map((channel, index) => Math.round(channel * (1 - t) + colors.dark[index] * t));
    for (let x = 0; x < width; x++) setPixel(x, y, color);
  }
  for (let i = -height; i < width; i += 24) canvas.line(i, 0, i + height, height, [20, 29, 23]);
  canvas.line(0, Math.floor(height * 0.67), width, Math.floor(height * 0.67), [35, 48, 34]);
  canvas.circle(width * 0.7, height * 0.83, width * 0.65, [26, 43, 28]);
}

function drawMark(canvas, x, y, size) {
  const s = size / 100;
  const points = [[8,50],[35,20],[84,20],[84,34],[42,34],[26,50],[42,66],[84,66],[84,80],[35,80]]
    .map(([px, py]) => [x + px * s, y + py * s]);
  canvas.polygon(points, colors.green);
  canvas.polygon([[64,50],[80,42],[93,50]].map(([px, py]) => [x + px * s, y + py * s]), colors.softGreen);
}

function writeBmp(filename, canvas) {
  const { width, height, pixels } = canvas;
  const stride = Math.ceil((width * 3) / 4) * 4;
  const dataSize = stride * height;
  const header = Buffer.alloc(54);
  header.write('BM', 0, 2, 'ascii');
  header.writeUInt32LE(54 + dataSize, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(dataSize, 34);
  const bitmap = Buffer.alloc(dataSize);
  for (let y = 0; y < height; y++) {
    const sourceRow = height - 1 - y;
    pixels.copy ? pixels.copy(bitmap, y * stride, sourceRow * width * 3, (sourceRow + 1) * width * 3) : bitmap.set(pixels.subarray(sourceRow * width * 3, (sourceRow + 1) * width * 3), y * stride);
  }
  fs.writeFileSync(path.join(output, filename), Buffer.concat([header, bitmap]));
}

fs.mkdirSync(output, { recursive: true });

const sidebar = makeCanvas(164, 314);
backdrop(sidebar);
sidebar.line(20, 218, 144, 218, [36, 50, 38]);
sidebar.circle(82, 83, 52, [27, 43, 29]);
sidebar.circle(82, 83, 40, colors.softGreen);
drawMark(sidebar, 41, 42, 82);
sidebar.text('CYPHER', 40, 151, 2, colors.white);
sidebar.rect(44, 174, 76, 2, colors.green);
sidebar.text('BROWSER', 50, 187, 1, colors.dim);
sidebar.text('YOUR SPACE.', 41, 238, 1, colors.white);
sidebar.text('YOUR RULES.', 44, 252, 1, colors.dim);
sidebar.circle(136, 287, 2, colors.green, true);
writeBmp('installer-sidebar.bmp', sidebar);

const header = makeCanvas(150, 57);
backdrop(header);
drawMark(header, 9, 8, 42);
header.text('CYPHER', 61, 14, 2, colors.white);
header.text('BROWSER', 63, 33, 1, colors.dim);
writeBmp('installer-header.bmp', header);

console.log('Assets personalizados do instalador gerados em build/.');
