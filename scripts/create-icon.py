from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent / 'build'
root.mkdir(exist_ok=True)
image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((8, 8, 504, 504), radius=110, fill='#101610')
scale = 13
offset = 48
points = [(25,7),(13,7),(5,16),(13,25),(25,25),(20,19),(14,19),(11,16),(14,13),(20,13)]
draw.polygon([(offset+x*scale,offset+y*scale) for x,y in points], fill='#b6f36a')
draw.polygon([(offset+x*scale,offset+y*scale) for x,y in [(25,14),(22,17),(29,17)]], fill='#66873d')
image.save(root / 'icon.png')
image.save(root / 'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
