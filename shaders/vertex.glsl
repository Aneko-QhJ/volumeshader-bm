#version 100
precision highp float;
attribute vec4 position;
varying vec3 dir, localdir;
uniform vec3 right, forward, up, origin;
uniform float x,y;
void main() {
   gl_Position=position;
   dir=forward + right * position.x*x + up * position.y*y;
   localdir.x=position.x*x;
   localdir.y=position.y*y;
   localdir.z=-1.0;
}
