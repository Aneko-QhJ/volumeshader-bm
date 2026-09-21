// WebGL 层：上下文、着色器编译与链接、顶点缓冲、uniform 上传、绘制。
// 这里只处理 OpenGL 相关的事情，不含相机和交互逻辑，数值全部由外部算好传进来。

const POSITION_ATTRIBUTE = "position";
const UNIFORM_NAMES = ["right", "forward", "up", "origin", "x", "y", "len"];
const VERTEX_COUNT = 6;

export class GLRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        // 老一点的浏览器只认带前缀的上下文名字。
        this.gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!this.gl) {
            throw new Error("浏览器不支持 WebGL");
        }
        this.program = null;
        this.attributes = {};
        this.uniforms = {};
        this.buffer = null;
    }

    // 编译单个着色器，是否成功由调用方查日志判断。
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    // 缓存 attribute / uniform 位置。每次链接新程序后都要重新取一遍。
    cacheLocations() {
        const gl = this.gl;
        this.attributes[POSITION_ATTRIBUTE] = gl.getAttribLocation(this.program, POSITION_ATTRIBUTE);
        for (const name of UNIFORM_NAMES) {
            this.uniforms[name] = gl.getUniformLocation(this.program, name);
        }
    }

    // 部分老设备的片元着色器没有 highp，强行用 highp 会编译失败，这里按能力降级到 mediump。
    adaptFragmentPrecision(source) {
        const gl = this.gl;
        const format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (format && format.precision > 0) {
            return source;
        }
        return source.replace(/\bhighp\b/g, "mediump");
    }

    // 链接 vertexSource 与 (fragmentSource + kernelSource)。
    // 成功返回 { ok: true, info }；失败返回 { ok: false, info } 且不动当前正在使用的 program，
    // 这样 CONFIG 面板里写着色器写错了也不会把画面搞黑。
    buildProgram(vertexSource, fragmentSource, kernelSource) {
        const gl = this.gl;
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(
            gl.FRAGMENT_SHADER,
            this.adaptFragmentPrecision(fragmentSource) + kernelSource
        );
        const vertexLog = gl.getShaderInfoLog(vertexShader) || "";
        const fragmentLog = gl.getShaderInfoLog(fragmentShader) || "";

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        const info = vertexLog + fragmentLog + (gl.getProgramInfoLog(program) || "");
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return { ok: false, info };
        }

        const previous = this.program;
        this.program = program;
        this.cacheLocations();
        gl.useProgram(program);
        if (previous) {
            gl.deleteProgram(previous);
        }
        return { ok: true, info };
    }

    // 上传全屏四边形顶点数据并绑定 position attribute。
    initGeometry(positions) {
        const gl = this.gl;
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        const position = this.attributes[POSITION_ATTRIBUTE];
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(position);
    }

    setViewport(width, height) {
        this.gl.viewport(0, 0, width, height);
    }

    // 一次性初始化：编译 + 链接 + 建缓冲。链接失败直接抛错。
    init(vertexSource, fragmentSource, kernelSource, positions) {
        const result = this.buildProgram(vertexSource, fragmentSource, kernelSource);
        if (!result.ok) {
            throw new Error("WebGL 程序链接失败:\n\n" + result.info);
        }
        this.initGeometry(positions);
        this.setViewport(this.canvas.width, this.canvas.height);
        return result;
    }

    // 上传一帧的相机参数，view 由 camera 层给出。
    setViewFrame(view) {
        const gl = this.gl;
        const u = this.uniforms;
        gl.uniform1f(u.x, view.x);
        gl.uniform1f(u.y, view.y);
        gl.uniform1f(u.len, view.len);
        gl.uniform3f(u.origin, view.origin[0], view.origin[1], view.origin[2]);
        gl.uniform3f(u.right, view.right[0], view.right[1], view.right[2]);
        gl.uniform3f(u.up, view.up[0], view.up[1], view.up[2]);
        gl.uniform3f(u.forward, view.forward[0], view.forward[1], view.forward[2]);
    }

    // gl.finish() 与原始实现一致：强制等待 GPU 画完，避免命令排队掩盖真实耗时。
    draw() {
        const gl = this.gl;
        gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
        gl.finish();
    }
}
