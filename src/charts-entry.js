// Slate's dashboard charts (0.24.0), built into charts/ (npm run build:charts) from Chart.js.
// slate.js imports charts.js only when a page has a pie, bar or line card, so other pages stay
// small. Chart.js draws on a canvas and sizes it with element styles, which a page whose
// Content-Security-Policy has no style-src 'unsafe-inline' allows.

import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend,
  LinearScale, LineController, LineElement, PointElement, Tooltip,
} from 'chart.js';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Legend,
  LinearScale, LineController, LineElement, PointElement, Tooltip);

const charts = new WeakMap();

/**
 * Draws (or redraws) a chart on canvas. kind is pie, bar or line; labels and values the groups;
 * colours the palette (a pie's slices take them in order; bars and a line are one series, the
 * first colour); text, grid and surface the theme's colours; onPick(index) when a part is clicked.
 */
export function drawChart(canvas, { kind, labels, values, colours, text, grid, surface, label, onPick }) {
  charts.get(canvas)?.destroy();
  const pie = kind === 'pie';
  const line = kind === 'line';
  const chart = new Chart(canvas, {
    type: pie ? 'doughnut' : kind,
    data: {
      labels,
      datasets: [{
        label: label || '',
        data: values,
        backgroundColor: pie ? labels.map((_, i) => colours[i]) : colours[0],
        // Slices are parted by a 2px gap in the card's own colour; bars have rounded tops.
        borderColor: pie ? surface || '#fff' : colours[0],
        borderWidth: pie ? 2 : line ? 2 : 0,
        borderRadius: kind === 'bar' ? { topLeft: 4, topRight: 4 } : 0,
        borderSkipped: kind === 'bar' ? 'start' : undefined,
        maxBarThickness: 48,
        tension: 0.3,
        pointRadius: line ? 4 : 0,
        pointHoverRadius: line ? 6 : 0,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 400 },
      cutout: pie ? '55%' : undefined,
      plugins: {
        legend: { display: pie, position: 'right', labels: { color: text, boxWidth: 12, usePointStyle: true } },
        tooltip: { enabled: true },
      },
      scales: pie ? {} : {
        x: { ticks: { color: text }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: text, precision: 0 }, grid: { color: grid } },
      },
      onClick: (_, elements) => {
        if (elements.length && typeof onPick === 'function') onPick(elements[0].index);
      },
    },
  });
  charts.set(canvas, chart);
  return chart;
}

/** Stops a chart whose card left the page. */
export function destroyChart(canvas) {
  charts.get(canvas)?.destroy();
  charts.delete(canvas);
}
