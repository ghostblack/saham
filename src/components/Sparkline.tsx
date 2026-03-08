'use client';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler
);

interface SparklineProps {
    data: number[];
    color?: string;
}

export default function Sparkline({ data, color = '#7c3aed' }: SparklineProps) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
        },
        scales: {
            x: { display: false },
            y: { display: false },
        },
        elements: {
            point: { radius: 0 },
            line: {
                borderWidth: 2,
                tension: 0.4,
                capBezierPoints: true
            },
        },
        animation: {
            duration: 0 // Performance for large tables
        }
    };

    const chartData = {
        labels: data.map((_, i) => i),
        datasets: [
            {
                data: data,
                borderColor: color,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return null;
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, `${color}00`);
                    gradient.addColorStop(1, `${color}20`);
                    return gradient;
                },
                fill: true,
            },
        ],
    };

    return (
        <div style={{ width: '120px', height: '40px' }}>
            <Line options={options} data={chartData} />
        </div>
    );
}
