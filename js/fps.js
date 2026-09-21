// FPS 统计：按固定时间窗口采样，再用指数平滑压掉抖动，避免数字每秒乱跳。

const UPDATE_INTERVAL = 500;   // 毫秒，采样窗口
const SMOOTHING = 0.4;         // 新样本权重
const STALL_LIMIT = 8;         // 超过窗口这么多倍视为标签页被挂起，不计入统计

export class FpsMeter {
    constructor(element, updateInterval = UPDATE_INTERVAL) {
        this.element = element;
        this.updateInterval = updateInterval;
        this.frames = 0;
        this.lastSample = 0;
        this.average = 0;
    }

    // 每帧调用一次，now 是 requestAnimationFrame 的时间戳。
    tick(now) {
        if (this.lastSample === 0) {
            // 第一帧只用来确定窗口起点，不计入任何一次统计。
            this.lastSample = now;
            this.frames = 0;
            return;
        }

        this.frames++;
        const elapsed = now - this.lastSample;
        if (elapsed < this.updateInterval) {
            return;
        }
        this.lastSample = now;

        // 标签页切到后台时 rAF 会停摆，恢复后第一帧的间隔非常大，丢弃这一轮。
        if (elapsed > this.updateInterval * STALL_LIMIT) {
            this.frames = 0;
            return;
        }

        const fps = this.frames * 1000 / elapsed;
        this.frames = 0;
        this.average = this.average === 0 ? fps : this.average * (1 - SMOOTHING) + fps * SMOOTHING;
        this.render();
    }

    render() {
        if (!this.element) {
            return;
        }
        const ms = 1000 / this.average;
        this.element.textContent = this.average.toFixed(1) + " FPS · " + ms.toFixed(1) + " ms";
    }
}
