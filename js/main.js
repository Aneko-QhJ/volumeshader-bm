// 应用层：加载着色器文件、装配 WebGL 渲染器、驱动渲染循环、绑定 CONFIG 面板。

import { Camera, bindControls, POSITIONS } from "./camera.js";
import { FpsMeter } from "./fps.js";
import { GLRenderer } from "./webgl.js";

const SHADER_FILES = {
    vertex: "../shaders/vertex.glsl",
    fragment: "../shaders/fragment.glsl",
    kernel: "../shaders/kernel.glsl",
};

const camera = new Camera();
const canvas = document.getElementById("c1");
const fps = new FpsMeter(document.getElementById("fps"));
const sources = {};
let kernel = "";
let renderer = null;

function loadShader(name) {
    const url = new URL(SHADER_FILES[name], import.meta.url);
    return fetch(url).then(function (response) {
        if (!response.ok) {
            throw new Error(`无法读取 ${url.pathname}（HTTP ${response.status}）`);
        }
        return response.text();
    });
}

// 页面按短边等比缩放整个 1024x1024 舞台。
function fitToScreen() {
    const size = camera.setViewportSize(document.body.clientWidth, document.body.clientHeight);
    const main = document.getElementById("main");
    main.style.width = canvas.width + "px";
    main.style.height = canvas.height + "px";
    main.style.transform = "scale(" + size / canvas.width + "," + size / canvas.height + ")";
}

function renderFrame() {
    if (!renderer) {
        return;
    }
    renderer.setViewFrame(camera.getViewFrame());
    renderer.draw();
}

function onTimer(now) {
    fps.tick(now);
    camera.ang1 += 0.01;
    renderFrame();
    window.requestAnimationFrame(onTimer);
}

// 编译着色器、建缓冲并完成一次视口适配。
function createRenderer() {
    renderer = new GLRenderer(canvas);
    renderer.init(sources.vertex, sources.fragment, kernel, POSITIONS);
    fitToScreen();
}

// 移动端切后台、GPU 重置都可能丢上下文。必须 preventDefault，浏览器才会尝试恢复；
// 恢复后 program 和 buffer 都已失效，需要整个重建。
function handleContextLoss() {
    canvas.addEventListener("webglcontextlost", function (ev) {
        ev.preventDefault();
        renderer = null;
    }, false);
    canvas.addEventListener("webglcontextrestored", function () {
        createRenderer();
    }, false);
}

function initConfigUI() {
    const config = document.getElementById("config");
    const button = document.getElementById("btn");
    const kernelBox = document.getElementById("kernel");
    kernelBox.value = kernel;

    button.addEventListener("click", function () {
        const show = this.innerText == "CONFIG";
        this.innerText = show ? "HIDE" : "CONFIG";
        config.style.display = show ? "inline" : "none";
    });

    // 重新编译失败时保留原来的程序，画面不会变黑。
    document.getElementById("apply").addEventListener("click", function () {
        if (!renderer) {
            return;
        }
        const result = renderer.buildProgram(sources.vertex, sources.fragment, kernelBox.value);
        if (!result.ok) {
            alert(result.info);
            return;
        }
        kernel = kernelBox.value;
    });

    document.getElementById("cancel").addEventListener("click", function () {
        kernelBox.value = kernel;
    });
}

async function main() {
    if (location.protocol === "file:") {
        alert("检测到以 file:// 直接打开页面。\n浏览器不允许本地页面读取着色器文件，请改用本地 HTTP 服务，例如：\n\npython3 -m http.server\n\n然后访问 http://localhost:8000/");
        return;
    }

    const [vertex, fragment, kernelSource] = await Promise.all([
        loadShader("vertex"),
        loadShader("fragment"),
        loadShader("kernel"),
    ]);
    sources.vertex = vertex;
    sources.fragment = fragment;
    kernel = kernelSource;

    createRenderer();
    renderFrame();

    window.addEventListener("resize", fitToScreen, false);
    bindControls(camera);
    handleContextLoss();
    initConfigUI();
    window.requestAnimationFrame(onTimer);
}

alert("Trigonometric and inverse trigonometric functions test.\n" +
      "Created by cznull\n" +
      "Modified by livcm");

main().catch(function (err) {
    console.error(err);
    alert("初始化失败:\n\n" + err.message);
});
