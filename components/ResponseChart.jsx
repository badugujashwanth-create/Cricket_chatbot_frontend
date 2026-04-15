import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function ResponseChart({ chartData = null }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !chartData?.type) return undefined;

    const datasetColors = (chartData.datasets || []).map((dataset, index) => {
      const fallbackColors = ['#22c55e', '#38bdf8', '#f59e0b', '#f43f5e'];
      return dataset.color || fallbackColors[index % fallbackColors.length];
    });

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: chartData.type,
      data: {
        labels: Array.isArray(chartData.labels) ? chartData.labels : [],
        datasets: (chartData.datasets || []).map((dataset, index) => ({
          label: dataset.label || `Series ${index + 1}`,
          data: Array.isArray(dataset.data) ? dataset.data : [],
          borderColor: datasetColors[index],
          backgroundColor:
            chartData.type === 'radar'
              ? `${datasetColors[index]}33`
              : `${datasetColors[index]}cc`,
          pointBackgroundColor: datasetColors[index],
          fill: chartData.type === 'radar',
          borderWidth: 2,
          tension: 0.32
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#e2e8f0'
            }
          },
          title: {
            display: Boolean(chartData.title),
            text: chartData.title || '',
            color: '#f8fafc'
          }
        },
        scales:
          chartData.type === 'radar'
            ? {
                r: {
                  grid: { color: 'rgba(148, 163, 184, 0.16)' },
                  angleLines: { color: 'rgba(148, 163, 184, 0.16)' },
                  pointLabels: { color: '#cbd5e1' },
                  ticks: { color: '#94a3b8', backdropColor: 'transparent' }
                }
              }
            : {
                x: {
                  ticks: { color: '#cbd5e1' },
                  grid: { color: 'rgba(148, 163, 184, 0.08)' }
                },
                y: {
                  ticks: { color: '#cbd5e1' },
                  grid: { color: 'rgba(148, 163, 184, 0.12)' }
                }
              }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartData]);

  if (!chartData?.type) return null;

  return (
    <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <div className="h-[260px] w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
