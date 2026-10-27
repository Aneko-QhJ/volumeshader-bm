# volumeshader-bm

Trigonometric and inverse trigonometric functions test.

Created by cznull. Original version: [cznull/cznull.github.io/vsbm.html](https://github.com/cznull/cznull.github.io/blob/master/vsbm.html)

Modified by livcm.

## Structure

```
index.html          页面骨架：1024x1024 canvas + CONFIG 面板
style.css           全屏布局与等比缩放
js/main.js          应用层：后端选择、加载着色器、渲染循环、CONFIG 面板
js/camera.js        相机层：视角状态、屏幕基向量、鼠标与触摸交互
js/fps.js           FPS 统计
js/webgl.js         WebGL 层：上下文、编译链接、顶点缓冲、uniform、绘制
js/webgpu.js        WebGPU 层：设备、异步管线编译、uniform 缓冲、绘制与完成同步
shaders/vertex.glsl   顶点着色器
shaders/fragment.glsl 片元着色器（光线步进主体）
shaders/kernel.glsl   距离场函数，CONFIG 面板中可编辑
shaders/volume.wgsl   WebGPU 顶点与片元着色器（与 GLSL 相同的光线步进算法）
shaders/kernel.wgsl   WebGPU 距离场函数，CONFIG 面板中可编辑
```

## Run

着色器通过 `fetch()` 读取 `.glsl` / `.wgsl` 文件，因此需要 HTTP 服务，直接双击 `index.html`（`file://`）无法加载着色器：

```
python3 -m http.server
```

然后打开 http://localhost:8000/ 。操作方式：左键拖动旋转，右键拖动平移，滚轮缩放；触屏一指旋转，双指平移并捏合缩放。

默认优先使用 WebGPU；浏览器不支持、适配器不可用、初始化失败或设备丢失时自动回退到 WebGL。WebGPU 需要安全上下文，请通过 HTTPS 或 `localhost` / `127.0.0.1` 访问；普通局域网 HTTP 地址会回退到 WebGL。

在 CONFIG 中可以查看实际后端和回退原因，并选择「自动」「WebGPU」「WebGL」。选择后会重新加载页面，未保存的 Kernel 编辑和相机状态会重置。也可以直接访问 `/?backend=webgpu` 或 `/?backend=webgl`；选择 WebGPU 后不可用时仍会回退，并显示原因。

Kernel 编辑器跟随实际后端使用 WGSL 或 GLSL，两种语言不自动互转。WebGPU 的函数签名为 `fn kernel(ver: vec3f) -> f32`，WebGL 为 `float kernel(vec3 ver)`。APPLY 编译成功后更新画面，失败时显示错误并保留上一份有效程序；CANCEL 恢复最近成功应用的代码。

右上角显示实时 FPS 与每帧耗时（每 500ms 采样一次，带平滑）。WebGL 每帧调用 `gl.finish()`，WebGPU 每帧等待 `queue.onSubmittedWorkDone()` 后才安排下一帧，避免 GPU 命令堆积抬高 FPS。显示的是包含浏览器调度、CPU 提交和 GPU 完成等待的帧率与平均帧间隔，并非纯 GPU 着色器计时；结果也受屏幕刷新率影响。

## Compatibility notes

- 滚轮用标准 `wheel` 事件并归一化 `deltaY`/`deltaMode`，老浏览器才退回非标准的 `mousewheel`，Firefox 也能缩放。
- `wheel` / `touchmove` 显式声明 `{ passive: false }`：Chrome 默认把 document 上的这类监听当作 passive，不声明的话 `preventDefault()` 会被忽略。
- CSS 用 `touch-action: none` + `overscroll-behavior: none` 处理移动端手势，避免滚动和下拉刷新抢事件；`100dvh` 解决移动端地址栏导致的高度跳变。
- WebGL 上下文在 `webgl` 不可用时回退到 `experimental-webgl`；片元着色器不支持 `highp` 的老设备自动降级为 `mediump`。
- 监听 `webglcontextlost` / `webglcontextrestored`，移动端切后台或 GPU 重置后自动重建着色器与缓冲。
