// WebGPU 层：WGSL 编译、uniform 缓冲、全屏三角形与完成同步。
export class GPURenderer {
    constructor(canvas, device) {
        this.canvas = canvas;
        this.device = device;
        this.context = null;
        this.pipeline = null;
        this.viewData = new Float32Array(16);
        this.disposed = false;
    }

    static async create(canvas, source, kernel) {
        if (!globalThis.isSecureContext || !navigator.gpu) {
            throw new Error("WebGPU 需要支持它的浏览器，以及 HTTPS 或 localhost");
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("未找到可用的 WebGPU 适配器");
        }
        const device = await adapter.requestDevice();
        const renderer = new GPURenderer(canvas, device);
        try {
            renderer.format = navigator.gpu.getPreferredCanvasFormat();
            renderer.uniformBuffer = device.createBuffer({
                size: renderer.viewData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            const result = await renderer.buildProgram(source, kernel);
            if (!result.ok) {
                throw new Error("WebGPU 着色器编译失败:\n" + result.info);
            }
            renderer.context = canvas.getContext("webgpu");
            if (!renderer.context) {
                throw new Error("无法创建 WebGPU 画布上下文");
            }
            renderer.context.configure({ device, format: renderer.format, alphaMode: "opaque" });
            return renderer;
        } catch (error) {
            renderer.dispose();
            throw error;
        }
    }

    // 仅在编译和管线创建均成功后替换，编辑错误不会破坏当前画面。
    async buildProgram(source, kernel) {
        try {
            const module = this.device.createShaderModule({ code: source + "\n" + kernel });
            const compilation = await module.getCompilationInfo();
            const info = compilation.messages.map(message =>
                `${message.type} (${message.lineNum}:${message.linePos}): ${message.message}`
            ).join("\n");
            if (compilation.messages.some(message => message.type === "error")) {
                return { ok: false, info };
            }
            const pipeline = await this.device.createRenderPipelineAsync({
                layout: "auto",
                vertex: { module, entryPoint: "vertexMain" },
                fragment: { module, entryPoint: "fragmentMain", targets: [{ format: this.format }] },
                primitive: { topology: "triangle-list" },
            });
            const bindGroup = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
            });
            if (this.disposed) {
                return { ok: false, info: "WebGPU 设备已释放" };
            }
            this.pipeline = pipeline;
            this.bindGroup = bindGroup;
            return { ok: true, info };
        } catch (error) {
            return { ok: false, info: error.message };
        }
    }

    setViewFrame(view) {
        // vec3 + scalar 各占 16 字节，与 WGSL View 的布局保持一致。
        this.viewData.set(view.right, 0);
        this.viewData[3] = view.x;
        this.viewData.set(view.up, 4);
        this.viewData[7] = view.y;
        this.viewData.set(view.forward, 8);
        this.viewData[11] = view.len;
        this.viewData.set(view.origin, 12);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.viewData);
    }

    async draw() {
        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }],
        });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3);
        pass.end();
        this.device.queue.submit([encoder.finish()]);
        // 每次只保留一帧在途，让 FPS 包含 GPU 完成时间。
        await this.device.queue.onSubmittedWorkDone();
    }

    dispose() {
        this.disposed = true;
        if (this.context) this.context.unconfigure();
        if (this.uniformBuffer) this.uniformBuffer.destroy();
        this.device.destroy();
    }
}
