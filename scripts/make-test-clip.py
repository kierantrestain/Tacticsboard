"""Reproducible synthetic motion fixture. Not a match recording or shipping demo."""
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import subprocess,math,json
OUT=Path(__file__).resolve().parents[1]/'test-results';OUT.mkdir(exist_ok=True)
w,h=1280,720
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate','25','-i','-','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',str(OUT/'calibration-test.mp4')],stdin=subprocess.PIPE)
for f in range(250):
 im=Image.new('RGB',(w,h),'#172e37');d=ImageDraw.Draw(im)
 for i in range(10):d.rectangle((80+i*112,80,80+(i+1)*112,640),fill='#36774f' if i%2 else '#316f48')
 for x in range(82,1200,23):
  for y in range(82,640,19):d.point((x,y),fill='#4b8b58')
 d.rectangle((80,80,1200,640),outline='#a7bcaa',width=2);d.line((640,80,640,640),fill='#a7bcaa',width=2);d.ellipse((550,270,730,450),outline='#a7bcaa',width=2)
 for left in [True,False]:
  x=80 if left else 1200;edge=x+175 if left else x-175
  d.line((x,190,edge,190,edge,530,x,530),fill='#a7bcaa',width=2)
 players=[(.25+.1*f/249,.30,'#ee3845',7),(.38,.52,'#ee3845',8),(.47,.73,'#ee3845',9),(.62-.04*f/249,.32,'#5699ec',4),(.65,.55,'#5699ec',5),(.77,.73,'#5699ec',6)]
 for x,y,color,num in players:
  x,y=int(80+x*1120),int(80+y*560)
  d.ellipse((x-12,y-3,x+12,y+5),fill='#244c39');d.rectangle((x-6,y-15,x-2,y),fill='#101b27');d.rectangle((x+2,y-15,x+6,y),fill='#101b27');d.polygon([(x-8,y-36),(x-14,y-29),(x-10,y-23),(x-7,y-26),(x-7,y-12),(x+7,y-12),(x+7,y-26),(x+10,y-23),(x+14,y-29),(x+8,y-36)],fill=color)
  for j in range(3):d.line((x-5+j*4,y-33,x-5+j*4,y-18),fill='#ffadac' if color=='#ee3845' else '#afd9fa',width=1)
  d.ellipse((x-5,y-46,x+5,y-36),fill='#ccad8f');d.text((x-4,y-29),str(num),font=font,fill='white',stroke_width=0)
 d.text((82,28),'SYNTHETIC MOTION TEST  /  10 SECONDS  /  25 FPS',font=font,fill='#95b6c7')
 if f==0:im.save(OUT/'calibration-test.png')
 p.stdin.write(im.tobytes())
p.stdin.close();p.wait();print(OUT/'calibration-test.mp4')
