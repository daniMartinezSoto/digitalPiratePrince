// EL AGUA ANIMADA (WebGL), copiada tal cual del HTML de referencia.
// El pergamino ya pintado llega como textura. Donde hay mar, el sombreador lo tiñe de azul
// conservando la textura del papel (más claro en la costa, más oscuro en alta mar), y añade:
// cáusticas suaves, espuma de orilla que crece y se recoge, y líneas de ola a tinta que avanzan
// hacia la isla. Encima van los adornos (árboles, iconos, nombres), que no se tiñen.

/** El campo de distancia a la costa se guarda en 8 bits: de -0,6 a +1,6 unidades. */
export const SD_MIN = -0.6;
export const SD_RANGE = 2.2;

export const SOMBREADOR_DE_VERTICES = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

export const SOMBREADOR_DEL_AGUA = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uBase,uDecor,uSD,uKind,uA,uB,uDet;
uniform vec4 uDetR;
uniform float uDetOn;
uniform vec2 uRes,uL,uSDsz,uGrid;
uniform vec3 uView,uO;
uniform float uT,uPxU,uCoastW,uCaus;
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+1.),f.x),f.y);}
const float R3=1.7320508;
// Alta mar (r) de la casilla c,r; fuera de la rejilla se usa la casilla más cercana del borde
float deepAt(float c,float r){return texture2D(uKind,(clamp(vec2(c,r),vec2(0.),uGrid-1.)+.5)/uGrid).r;}
float insideAt(float c,float r){return(c<0.||r<0.||c>=uGrid.x||r>=uGrid.y)?0.:1.;}
// x = alta mar con fundido suave entre hexágonos; y = dentro del mapa con borde nítido (1 píxel)
vec2 hexKind(vec2 w,float soft,float aa){
 float c0=floor(w.x/1.5),dmin=1e9;
 for(int i=-1;i<=2;i++){float c=c0+float(i),off=mod(c,2.)*.5,rb=floor(w.y/R3-off);
  for(int j=-1;j<=2;j++){vec2 d=w-vec2(1.5*c,R3*(rb+float(j)+off));dmin=min(dmin,dot(d,d));}}
 float accD=0.,wsD=0.,accI=0.,wsI=0.,sharp=R3*aa;
 for(int i=-1;i<=2;i++){float c=c0+float(i),off=mod(c,2.)*.5,rb=floor(w.y/R3-off);
  for(int j=-1;j<=2;j++){float r=rb+float(j);vec2 d=w-vec2(1.5*c,R3*(r+off));float e=dot(d,d)-dmin;
   float a=exp(-e/soft);accD+=deepAt(c,r)*a;wsD+=a;
   float b=exp(-e/sharp);accI+=insideAt(c,r)*b;wsI+=b;}}
 return vec2(accD/wsD,accI/wsI);
}
void main(){
 vec2 dev=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
 vec2 lp=(dev-uView.xy)/uView.z;               // píxel de la capa del pergamino
 vec2 uv=lp/uL;
 if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.){gl_FragColor=vec4(0.);return;}
 vec4 base=texture2D(uBase,uv);
 if(base.a<.01){gl_FragColor=vec4(0.);return;}
 vec3 col=base.rgb;
 float sd=texture2D(uSD,lp/uSDsz).r*${SD_RANGE.toFixed(1)}+(${SD_MIN.toFixed(1)}); // >0 mar, <0 tierra (unidades de mundo)
 vec2 w=(lp-uO.xy)/uO.z;                        // coordenadas de mundo
 float ink1=1.2/uPxU;                           // grosor de línea fina (1,2 px) en unidades de mundo
 vec2 kd=hexKind(w,.19,1./uPxU);               // x = alta mar (fundido), y = dentro del mapa (borde nítido)
 if(sd>-.03){
  float lum=dot(base.rgb,vec3(.3,.59,.11))/.84;  // la textura del papel se conserva en el agua
  float deep=kd.x; // .19 = anchura del fundido entre hexágonos (más alto = más difuminado)
  vec3 wc=mix(vec3(.23,.65,.78),vec3(.12,.35,.53),deep)*lum; // costa #3AA6C8, alta mar #1E5A86
  // cáusticas: dos texturas Voronoi que se deslizan; luz donde se cruzan, dos niveles
  vec2 q=w/.028;
  float a=texture2D(uA,(q+vec2(uT*4.,uT*2.5))/128.).r;
  float b=texture2D(uB,(vec2(q.y,-q.x)+vec2(-uT*3.,uT*3.5))/128.).r;
  float c=a*b, lv=step(.30,c)*.5+step(.55,c)*.5;
  wc=mix(wc,vec3(.90,.93,.90)*lum,lv*mix(.22,.13,deep)*uCaus);
  // orilla animada
  float wob=(vn(w*3.5+vec2(uT*.25,-uT*.2))-.5)*.08;
  float wave=fract(uT*.28);
  float sw=smoothstep(0.,.14,wave)*(1.-smoothstep(.14,.85,wave)); // sube rápido al llegar la ola, se recoge despacio
  float surge=.08+.07*sw, e=sd+wob-surge;
  float foam=1.-smoothstep(-ink1*.6,ink1*.6,e);
  wc=mix(wc,vec3(.93,.90,.82)*lum,foam*.92);                     // espuma color papel
  float edge=1.-smoothstep(ink1*.4,ink1*1.1,abs(e));
  wc=mix(wc,vec3(.23,.16,.10),edge*.7);                         // contorno a tinta de la espuma
  // líneas de ola a tinta que avanzan hacia la costa y se desvanecen
  float dl=sd+wob*1.4;
  float dd=abs(fract(dl*1.5+uT*.28+.5)-.5)/1.5;
  float ln=(1.-smoothstep(ink1*.5,ink1*1.2,dd))*(1.-smoothstep(.25,1.15,dl))*step(.1,dl)*step(.3,vn(w*1.7-uT*.12));
  wc=mix(wc,vec3(.22,.20,.20),ln*.55*(1.-foam));
  col=mix(col,wc,smoothstep(-.03,0.,sd));
 }
 // línea de costa a tinta (encima de la espuma)
 float cw=1.-smoothstep(uCoastW*.55,uCoastW*1.1,abs(sd)*uPxU);
 col=mix(col,vec3(.2,.13,.08),cw);
 vec4 dc=texture2D(uDecor,uv);
 if(uDetOn>.5&&lp.x>=uDetR.x&&lp.y>=uDetR.y&&lp.x<=uDetR.z&&lp.y<=uDetR.w)dc=texture2D(uDet,(lp-uDetR.xy)/(uDetR.zw-uDetR.xy));
 col=mix(col,dc.rgb,dc.a);
 gl_FragColor=vec4(col*kd.y,kd.y);              // fuera de los hexágonos del mapa: transparente
}`;
