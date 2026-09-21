float kernel(vec3 ver){
    vec3 a;
    float b,c,d,e;
    a=ver;
    for(int i=0;i<5;i++){
        b=length(a);
        c=atan(a.y,a.x)*8.0;
        e=1.0/b;
        d=acos(a.z/b)*8.0;
        b=pow(b,8.0);
        a=vec3(b*sin(d)*cos(c),b*sin(d)*sin(c),b*cos(d))+ver;
        if(b>6.0)
            break;
    }
    return 4.0-a.x*a.x-a.y*a.y-a.z*a.z;
}
