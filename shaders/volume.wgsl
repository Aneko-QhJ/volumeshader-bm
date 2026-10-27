// 原 WebGL 光线步进算法的 WGSL 实现；保持步数、求根与光照参数一致。
struct View {
    right: vec3f,
    x: f32,
    up: vec3f,
    y: f32,
    forward: vec3f,
    len: f32,
    origin: vec3f,
    padding: f32,
}
@group(0) @binding(0) var<uniform> view: View;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) dir: vec3f,
    @location(1) localdir: vec3f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
    let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    let p = positions[index];
    var output: VertexOutput;
    output.position = vec4f(p, 0.0, 1.0);
    output.dir = view.forward + view.right * p.x * view.x + view.up * p.y * view.y;
    output.localdir = vec3f(p.x * view.x, p.y * view.y, -1.0);
    return output;
}

const M_L = 0.3819660113;
const M_R = 0.6180339887;
const MAXR = 8;
const SOLVER = 8;
const step = 0.002;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let dir = input.dir;
    let localdir = input.localdir;
    var ver: vec3f;
    var hit: i32;
    var v: f32;
    var v1: f32;
    var v2: f32;
    var r1: f32;
    var r2: f32;
    var r3: f32;
    var r4: f32;
    var m1: f32;
    var m2: f32;
    var m3: f32;
    var m4: f32;
    var n: vec3f;
    var reflect: vec3f;
    var color: vec3f;

   color.r=0.0;
   color.g=0.0;
   color.b=0.0;
   hit=0;
   v1=kernel(view.origin + dir * (step*view.len));
   v2=kernel(view.origin);
   for (var k: i32 =2; k < 1002; k++) {
      ver=view.origin + dir * (step*view.len*f32(k));
      v=kernel(ver);
      if (v > 0.0 && v1 < 0.0) {
         r1=step * view.len*f32(k - 1);
         r2=step * view.len*f32(k);
         m1=kernel(view.origin + dir * r1);
         m2=kernel(view.origin + dir * r2);
         for (var l: i32 =0; l < SOLVER; l++) {
            r3=r1 * 0.5 + r2 * 0.5;
            m3=kernel(view.origin + dir * r3);
            if (m3 > 0.0) {
               r2=r3;
               m2=m3;
            }
            else {
               r1=r3;
               m1=m3;
            }
         }
         if (r3 < 2.0 * view.len) {
               hit=1;
            break;
         }
      }
      if (v < v1&&v1>v2&&v1 < 0.0 && (v1*2.0 > v || v1 * 2.0 > v2)) {
         r1=step * view.len*f32(k - 2);
         r2=step * view.len*(f32(k) - 2.0 + 2.0*M_L);
         r3=step * view.len*(f32(k) - 2.0 + 2.0*M_R);
         r4=step * view.len*f32(k);
         m2=kernel(view.origin + dir * r2);
         m3=kernel(view.origin + dir * r3);
         for (var l: i32 =0; l < MAXR; l++) {
            if (m2 > m3) {
               r4=r3;
               r3=r2;
               r2=r4 * M_L + r1 * M_R;
               m3=m2;
               m2=kernel(view.origin + dir * r2);
            }
            else {
               r1=r2;
               r2=r3;
               r3=r4 * M_R + r1 * M_L;
               m2=m3;
               m3=kernel(view.origin + dir * r3);
            }
         }
         if (m2 > 0.0) {
            r1=step * view.len*f32(k - 2);
            r2=r2;
            m1=kernel(view.origin + dir * r1);
            m2=kernel(view.origin + dir * r2);
            for (var l: i32 =0; l < SOLVER; l++) {
               r3=r1 * 0.5 + r2 * 0.5;
               m3=kernel(view.origin + dir * r3);
               if (m3 > 0.0) {
                  r2=r3;
                  m2=m3;
               }
               else {
                  r1=r3;
                  m1=m3;
               }
            }
            if (r3 < 2.0 * view.len&&r3> step*view.len) {
                   hit=1;
               break;
            }
         }
         else if (m3 > 0.0) {
            r1=step * view.len*f32(k - 2);
            r2=r3;
            m1=kernel(view.origin + dir * r1);
            m2=kernel(view.origin + dir * r2);
            for (var l: i32 =0; l < SOLVER; l++) {
               r3=r1 * 0.5 + r2 * 0.5;
               m3=kernel(view.origin + dir * r3);
               if (m3 > 0.0) {
                  r2=r3;
                  m2=m3;
               }
               else {
                  r1=r3;
                  m1=m3;
               }
            }
            if (r3 < 2.0 * view.len&&r3> step*view.len) {
                   hit=1;
               break;
            }
         }
      }
      v2=v1;
      v1=v;
   }
   if (hit==1) {
      ver=view.origin + dir*r3 ;
       r1=ver.x*ver.x+ver.y*ver.y+ver.z*ver.z;
      n.x=kernel(ver - view.right * (r3*0.00025)) - kernel(ver + view.right * (r3*0.00025));
      n.y=kernel(ver - view.up * (r3*0.00025)) - kernel(ver + view.up * (r3*0.00025));
      n.z=kernel(ver + view.forward * (r3*0.00025)) - kernel(ver - view.forward * (r3*0.00025));
      r3=n.x*n.x+n.y*n.y+n.z*n.z;
      n=n * (1.0 / sqrt(r3));
      ver=localdir;
      r3=ver.x*ver.x+ver.y*ver.y+ver.z*ver.z;
      ver=ver * (1.0 / sqrt(r3));
      reflect=n * (-2.0*dot(ver, n)) + ver;
      r3=reflect.x*0.276+reflect.y*0.920+reflect.z*0.276;
      r4=n.x*0.276+n.y*0.920+n.z*0.276;
      r3=max(0.0,r3);
      r3=r3 * r3*r3*r3;
      r3=r3 * 0.45 + r4 * 0.25 + 0.3;
      n.x=sin(r1*10.0)*0.5+0.5;
      n.y=sin(r1*10.0+2.05)*0.5+0.5;
      n.z=sin(r1*10.0-2.05)*0.5+0.5;
      color=n*r3;
   }
       return vec4f(color, 1.0);
}
