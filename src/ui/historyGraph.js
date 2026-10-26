import St from 'gi://St';

function rgba(hex, alpha) {
    const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '27c9ff';
    return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16) / 255).concat(alpha);
}

export function createHistoryGraph({height = 42, downloadColor = '#27C9FF', uploadColor = '#A56BFF'} = {}) {
    const area = new St.DrawingArea({
        style_class: 'uthy-history-graph',
        x_expand: true,
        height,
        can_focus: false,
    });
    let samples = [];

    area.connect('repaint', widget => {
        const cr = widget.get_context();
        if (!cr)
            return;
        const width = widget.get_width();
        const graphHeight = widget.get_height();
        if (width <= 1 || graphHeight <= 1) {
            cr.$dispose?.();
            return;
        }

        try {
            cr.setOperator(0); // CLEAR
            cr.paint();
            cr.setOperator(2); // OVER
            cr.setLineWidth(1.5);
            cr.setLineCap(1); // ROUND
            cr.setLineJoin(1);

            const maxValue = Math.max(0.1, ...samples.flatMap(item => [
                item.downloadMBps ?? 0, item.uploadMBps ?? 0,
            ]));
            const traces = [
                {key: 'downloadMBps', color: rgba(downloadColor, 0.95)},
                {key: 'uploadMBps', color: rgba(uploadColor, 0.9)},
            ];
            for (const trace of traces) {
                if (!samples.length)
                    continue;
                cr.setSourceRGBA(...trace.color);
                cr.beginPath();
                samples.forEach((sample, index) => {
                    const x = samples.length === 1 ? 0 : index / (samples.length - 1) * width;
                    const value = Math.max(0, sample[trace.key] ?? 0);
                    const y = graphHeight - 3 - (value / maxValue) * Math.max(1, graphHeight - 6);
                    if (index === 0)
                        cr.moveTo(x, y);
                    else
                        cr.lineTo(x, y);
                });
                cr.stroke();
            }
        } finally {
            cr.$dispose?.();
        }
    });

    return {
        actor: area,
        update(history) {
            samples = Array.isArray(history) ? history.slice(-120) : [];
            area.queue_repaint();
        },
    };
}
