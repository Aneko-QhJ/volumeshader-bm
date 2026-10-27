fn kernel(ver: vec3f) -> f32 {
    var a = ver;
    for (var i = 0; i < 5; i++) {
        let radius = length(a);
        let c = atan2(a.y, a.x) * 8.0;
        let d = acos(a.z / radius) * 8.0;
        let b = pow(radius, 8.0);
        a = vec3f(b * sin(d) * cos(c), b * sin(d) * sin(c), b * cos(d)) + ver;
        if (b > 6.0) {
            break;
        }
    }
    return 4.0 - a.x * a.x - a.y * a.y - a.z * a.z;
}
