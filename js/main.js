// 应用层：选择渲染后端、加载着色器、驱动完成同步的渲染循环与 CONFIG 面板。
import { Camera, bindControls, POSITIONS } from "./camera.js";
import { FpsMeter } from "./fps.js";
import { GLRenderer } from "./webgl.js";
import { GPURenderer } from "./webgpu.js";

const SHADER_FILES = {
    vertex: "../shaders/vertex.glsl",
    fragment: "../shaders/fragment.glsl",
    webgl: "../shaders/kernel.glsl",
    volume: "../shaders/volume.wgsl",
    webgpu: "../shaders/kernel.wgsl",
};
const camera = new Camera();
let canvas = document.getElementById("c1");
const fpsElement = document.getElementById("fps");
let fps = new FpsMeter(fpsElement);
const sources = {};
const kernels = {};
let renderer = null;
let backend = "";
let recovering = false;
const backendSelect = document.getElementById("backend");
const backendStatus = document.getElementById("backend-status");
const kernelBox = document.getElementById("kernel");
const applyButton = document.getElementById("apply");

async function loadShader(name) {
    if (sources[name] !== undefined) return sources[name];
    const url = new URL(SHADER_FILES[name], import.meta.url);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`无法读取 ${url.pathname}（HTTP ${response.status}）`);
    }
    sources[name] = await response.text();
    return sources[name];
}

function fitToScreen() {
    const size = camera.setViewportSize(document.body.clientWidth, document.body.clientHeight);
    const main = document.getElementById("main");
    main.style.width = canvas.width + "px";
    main.style.height = canvas.height + "px";
    main.style.transform = "scale(" + size / canvas.width + "," + size / canvas.height + ")";
}

function resetFps() {
    fps = new FpsMeter(fpsElement);
    fpsElement.textContent = "-- FPS";
}

async function onTimer() {
    const active = renderer;
    if (active) {
        try {
            camera.ang1 += 0.01;
            active.setViewFrame(camera.getViewFrame());
            await active.draw();
            if (renderer === active) fps.tick(performance.now());
        } catch (error) {
            if (renderer === active) {
                if (backend === "webgpu") await fallbackToWebGL(error);
                else {
                    renderer = null;
                    backendStatus.textContent = "WebGL 绘制失败：" + error.message;
                    resetFps();
                }
            }
        }
    }
    window.requestAnimationFrame(onTimer);
}

// 同一个 canvas 不能切换上下文类型，回退前必须替换元素。
function replaceCanvas() {
    const next = canvas.cloneNode(false);
    canvas.replaceWith(next);
    canvas = next;
}

function showBackend(message) {
    backendStatus.textContent = message;
    document.getElementById("kernel-language").textContent = backend === "webgpu" ? "WGSL" : "GLSL";
    kernelBox.value = kernels[backend];
    resetFps();
}

async function createWebGL(message = "WebGL", bindEvents = true) {
    const [vertex, fragment, kernel] = await Promise.all([
        loadShader("vertex"), loadShader("fragment"), loadShader("webgl"),
    ]);
    if (kernels.webgl === undefined) kernels.webgl = kernel;
    const next = new GLRenderer(canvas);
    next.init(vertex, fragment, kernels.webgl, POSITIONS);
    renderer = next;
    backend = "webgl";
    fitToScreen();
    showBackend(message);
    if (!bindEvents) return;
    canvas.addEventListener("webglcontextlost", function (event) {
        event.preventDefault();
        renderer = null;
        backendStatus.textContent = "WebGL 上下文丢失，等待恢复…";
        resetFps();
    });
    canvas.addEventListener("webglcontextrestored", function () {
        createWebGL("WebGL", false).catch(reportError);
    });
}

async function fallbackToWebGL(error) {
    if (recovering) return;
    recovering = true;
    const previous = renderer;
    renderer = null;
    backendStatus.textContent = "正在回退到 WebGL…";
    resetFps();
    if (previous instanceof GPURenderer) previous.dispose();
    try {
        replaceCanvas();
        await createWebGL("WebGL（WebGPU 不可用：" + error.message + "）");
    } catch (fallbackError) {
        reportError(fallbackError);
    } finally {
        recovering = false;
    }
}

function reportError(error) {
    console.error(error);
    backendStatus.textContent = "渲染失败：" + error.message;
    alert("渲染失败:\n\n" + error.message);
}

function initConfigUI() {
    const config = document.getElementById("config");
    const button = document.getElementById("btn");
    button.addEventListener("click", function () {
        const show = this.innerText === "CONFIG";
        this.innerText = show ? "HIDE" : "CONFIG";
        config.style.display = show ? "inline" : "none";
    });
    applyButton.addEventListener("click", async function () {
        const active = renderer;
        if (!active || recovering) return;
        const languageBackend = backend;
        const candidate = kernelBox.value;
        applyButton.disabled = true;
        try {
            const result = languageBackend === "webgpu"
                ? await active.buildProgram(sources.volume, candidate)
                : active.buildProgram(sources.vertex, sources.fragment, candidate);
            if (renderer !== active) return;
            if (!result.ok) {
                alert(result.info);
                return;
            }
            kernels[languageBackend] = candidate;
            resetFps();
        } catch (error) {
            alert(error.message);
        } finally {
            applyButton.disabled = false;
        }
    });
    document.getElementById("cancel").addEventListener("click", function () {
        kernelBox.value = kernels[backend] || "";
    });
    // 重新加载确保不同后端拥有独立的设备、上下文和统计窗口。
    backendSelect.addEventListener("change", function () {
        const url = new URL(location.href);
        url.searchParams.set("backend", backendSelect.value);
        location.assign(url);
    });
}

async function main() {
    if (location.protocol === "file:") {
        throw new Error("请使用 HTTP 服务加载着色器，例如 python3 -m http.server，然后访问 http://localhost:8000/");
    }
    const requested = new URLSearchParams(location.search).get("backend");
    const mode = ["webgl", "webgpu"].includes(requested) ? requested : "auto";
    backendSelect.value = mode;
    initConfigUI();
    if (mode !== "webgl") {
        try {
            const [volume, kernel] = await Promise.all([loadShader("volume"), loadShader("webgpu")]);
            kernels.webgpu = kernel;
            const next = await GPURenderer.create(canvas, volume, kernel);
            renderer = next;
            backend = "webgpu";
            fitToScreen();
            showBackend("WebGPU");
            next.device.lost.then(info => {
                if (renderer === next && !next.disposed) {
                    void fallbackToWebGL(new Error("设备丢失：" + info.message));
                }
            });
        } catch (error) {
            await fallbackToWebGL(error);
        }
    } else {
        await createWebGL();
    }
    window.addEventListener("resize", fitToScreen, false);
    bindControls(camera);
    window.requestAnimationFrame(onTimer);
}

alert("Trigonometric and inverse trigonometric functions test.\n" +
      "Created by cznull\n" +
      "Modified by livcm");

main().catch(reportError);
