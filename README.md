# volumeshader-bm

Trigonometric and inverse trigonometric functions test.

Created by cznull. Original version: [cznull/cznull.github.io/vsbm.html](https://github.com/cznull/cznull.github.io/blob/master/vsbm.html)

Modified by livcm.

## Structure

```
index.html          页面骨架：1024x1024 canvas + CONFIG 面板
style.css           全屏布局与等比缩放
js/main.js          应用层：加载着色器、渲染循环、CONFIG 面板
js/camera.js        相机层：视角状态、屏幕基向量、鼠标与触摸交互
js/fps.js           FPS 统计
js/webgl.js         WebGL 层：上下文、编译链接、顶点缓冲、uniform、绘制
shaders/vertex.glsl   顶点着色器
shaders/fragment.glsl 片元着色器（光线步进主体）
shaders/kernel.glsl   距离场函数，CONFIG 面板中可编辑
```

## Run

着色器通过 `fetch()` 读取 `.glsl` 文件，因此需要 HTTP 服务，直接双击 `index.html`（`file://`）无法加载着色器：

```
python3 -m http.server
```

然后打开 http://localhost:8000/ 。操作方式：左键拖动旋转，右键拖动平移，滚轮缩放；触屏一指旋转，双指平移并捏合缩放。

右上角显示实时 FPS 与每帧耗时（每 500ms 采样一次，带平滑）。因为每帧结尾有 `gl.finish()`，这个数字反映的是 GPU 真实出帧速度。

## Compatibility notes

- 滚轮用标准 `wheel` 事件并归一化 `deltaY`/`deltaMode`，老浏览器才退回非标准的 `mousewheel`，Firefox 也能缩放。
- `wheel` / `touchmove` 显式声明 `{ passive: false }`：Chrome 默认把 document 上的这类监听当作 passive，不声明的话 `preventDefault()` 会被忽略。
- CSS 用 `touch-action: none` + `overscroll-behavior: none` 处理移动端手势，避免滚动和下拉刷新抢事件；`100dvh` 解决移动端地址栏导致的高度跳变。
- WebGL 上下文在 `webgl` 不可用时回退到 `experimental-webgl`；片元着色器不支持 `highp` 的老设备自动降级为 `mediump`。
- 监听 `webglcontextlost` / `webglcontextrestored`，移动端切后台或 GPU 重置后自动重建着色器与缓冲。
