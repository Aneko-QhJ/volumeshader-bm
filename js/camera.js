// 相机层：相机状态、每帧视角基向量、鼠标与触摸交互。
// 只计算数值，不接触 WebGL。

// 全屏四边形的两个三角形，z 恒为 0，真正的 3D 由片元着色器光线步进算出来。
export const POSITIONS = [
    -1.0, -1.0, 0.0,
    1.0, -1.0, 0.0,
    1.0, 1.0, 0.0,
    -1.0, -1.0, 0.0,
    1.0, 1.0, 0.0,
    -1.0, 1.0, 0.0,
];

const ROTATE_SPEED = 0.002;
const MOUSE_PAN_SCALE = 4.0;
const TOUCH_PAN_SCALE = 2.0;
const ZOOM_SPEED = 0.001;
const WHEEL_LINE_HEIGHT = 16;   // deltaMode 为行时的估算像素高度
const WHEEL_PAGE_HEIGHT = 800;  // deltaMode 为页时

// 双指距离加上常数 1，避免两指重合时除零。
function touchDistance(pointer) {
    const dx = pointer.x - pointer.x1;
    const dy = pointer.y - pointer.y1;
    return Math.sqrt(dx * dx + dy * dy + 1.0);
}

// 把各浏览器的滚轮数据统一成「向上滚动为正」的像素量。
// Chrome/Safari 用 wheelDelta，Firefox 只有 deltaY，且 deltaMode 可能是行或页。
function wheelDelta(ev) {
    if (ev.deltaY === undefined || ev.deltaY === 0) {
        return ev.wheelDelta || 0;
    }
    const scale = ev.deltaMode === 1 ? WHEEL_LINE_HEIGHT : ev.deltaMode === 2 ? WHEEL_PAGE_HEIGHT : 1;
    return -ev.deltaY * scale;
}

export class Camera {
    constructor() {
        this.len = 1.6;       // 相机到原点的距离
        this.ang1 = 2.8;      // 方位角
        this.ang2 = 0.4;      // 俯仰角
        this.cenx = 0.0;      // 视线中心偏移
        this.ceny = 0.0;
        this.cenz = 0.0;
        this.width = 0;       // 视口宽高，取屏幕短边构成的方形
        this.height = 0;
        this.pointer = { x: 0, y: 0, x1: 0, y1: 0 };
        this.leftDown = 0;
        this.rightDown = 0;
        this.moved = 0;       // 拖动中标记，用于屏蔽右键菜单
        this.activeTouches = 0;
    }

    // 画面始终按短边等比缩放显示，所以宽高相等。
    setViewportSize(clientWidth, clientHeight) {
        const size = Math.min(clientWidth, clientHeight);
        this.width = size;
        this.height = size;
        return size;
    }

    // 一帧的相机参数：屏幕基向量 + 原点 + 宽高比系数。
    getViewFrame() {
        const { len, ang1, ang2, cenx, ceny, cenz, width, height } = this;
        return {
            x: width * 2.0 / (width + height),
            y: height * 2.0 / (width + height),
            len,
            origin: [
                len * Math.cos(ang1) * Math.cos(ang2) + cenx,
                len * Math.sin(ang2) + ceny,
                len * Math.sin(ang1) * Math.cos(ang2) + cenz,
            ],
            right: [Math.sin(ang1), 0, -Math.cos(ang1)],
            up: [
                -Math.sin(ang2) * Math.cos(ang1),
                Math.cos(ang2),
                -Math.sin(ang2) * Math.sin(ang1),
            ],
            forward: [
                -Math.cos(ang1) * Math.cos(ang2),
                -Math.sin(ang2),
                -Math.sin(ang1) * Math.cos(ang2),
            ],
        };
    }

    rotate(dx, dy) {
        this.ang1 += dx * ROTATE_SPEED;
        this.ang2 += dy * ROTATE_SPEED;
    }

    // 平移量随视距缩放，保证不同缩放下手感一致。
    pan(dx, dy, factor) {
        const l = this.len * factor / (this.width + this.height);
        this.cenx += l * (-dx * Math.sin(this.ang1) - dy * Math.sin(this.ang2) * Math.cos(this.ang1));
        this.ceny += l * (dy * Math.cos(this.ang2));
        this.cenz += l * (dx * Math.cos(this.ang1) - dy * Math.sin(this.ang2) * Math.sin(this.ang1));
    }

    zoom(wheelDelta) {
        this.len *= Math.exp(-ZOOM_SPEED * wheelDelta);
    }

    // 捏合缩放：双指距离变近则拉远。
    pinchZoom(previousDistance, nextDistance) {
        this.len *= previousDistance / nextDistance;
    }
}

// 鼠标左键拖动旋转、右键拖动平移、滚轮缩放；触屏一指旋转、双指平移并捏合缩放。
export function bindControls(camera) {
    const pointer = camera.pointer;

    function syncTouches(touches) {
        if (touches.length >= 1) {
            pointer.x = touches[0].clientX;
            pointer.y = touches[0].clientY;
        }
        if (touches.length == 2) {
            pointer.x1 = touches[1].clientX;
            pointer.y1 = touches[1].clientY;
        }
        camera.activeTouches = touches.length;
    }

    document.addEventListener("mousedown", function (ev) {
        if (ev.button == 0) {
            camera.leftDown = 1;
            camera.moved = 0;
        }
        if (ev.button == 2) {
            camera.rightDown = 1;
            camera.moved = 0;
        }
        pointer.x = ev.clientX;
        pointer.y = ev.clientY;
    }, false);

    document.addEventListener("mouseup", function (ev) {
        if (ev.button == 0) {
            camera.leftDown = 0;
        }
        if (ev.button == 2) {
            camera.rightDown = 0;
        }
    }, false);

    document.addEventListener("mousemove", function (ev) {
        const dx = ev.clientX - pointer.x;
        const dy = ev.clientY - pointer.y;
        if (camera.leftDown == 1) {
            camera.rotate(dx, dy);
            if (dx != 0 || dy != 0) {
                camera.moved = 1;
            }
        }
        if (camera.rightDown == 1) {
            camera.pan(dx, dy, MOUSE_PAN_SCALE);
            if (dx != 0 || dy != 0) {
                camera.moved = 1;
            }
        }
        pointer.x = ev.clientX;
        pointer.y = ev.clientY;
    }, false);

    // 标准事件是 wheel，只有老浏览器才需要非标准的 mousewheel。
    // Chrome 把 document 上的 wheel/touch 监听默认当成 passive，必须显式声明 passive:false，
    // 否则这里的 preventDefault() 会被忽略，页面会跟着滚动/缩放。
    const hasWheel = "onwheel" in document.createElement("div");
    document.addEventListener(hasWheel ? "wheel" : "mousewheel", function (ev) {
        ev.preventDefault();
        camera.zoom(wheelDelta(ev));
    }, { passive: false });

    document.addEventListener("touchstart", function (ev) {
        syncTouches(ev.touches);
    }, false);

    document.addEventListener("touchend", function (ev) {
        syncTouches(ev.touches);
    }, false);

    document.addEventListener("touchmove", function (ev) {
        ev.preventDefault();
        const touches = ev.touches;
        if (touches.length == 1 && camera.activeTouches == 1) {
            const touch = touches[0];
            camera.rotate(touch.clientX - pointer.x, touch.clientY - pointer.y);
            pointer.x = touch.clientX;
            pointer.y = touch.clientY;
        }
        else if (touches.length == 2) {
            const first = touches[0];
            const second = touches[1];
            const dx = (first.clientX + second.clientX) - (pointer.x + pointer.x1);
            const dy = (first.clientY + second.clientY) - (pointer.y + pointer.y1);
            const previousDistance = touchDistance(pointer);
            camera.pan(dx, dy, TOUCH_PAN_SCALE);
            pointer.x = first.clientX;
            pointer.y = first.clientY;
            pointer.x1 = second.clientX;
            pointer.y1 = second.clientY;
            camera.pinchZoom(previousDistance, touchDistance(pointer));
        }
        camera.activeTouches = touches.length;
    }, { passive: false });

    document.addEventListener("contextmenu", function (ev) {
        if (camera.moved == 1) {
            ev.preventDefault();
        }
    }, false);
}
