const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaultHome,sanitizeHome,moveWidget,addWidget,overlaps,resolveWidgetLayout } = require('../electron/home-layout.mjs');
const { sanitizeSettings,validateMod } = require('../electron/domain.cjs');
function assertLayout(widgets, canvasWidth = 1100) {
  for (const widget of widgets) {
    assert.ok(widget.x >= 0 && widget.x + widget.width <= canvasWidth);
    assert.ok(widget.y >= 0);
    for (const other of widgets) if (widget !== other) assert.equal(overlaps(widget,other),false);
  }
}
test('home settings migrate old profiles and retain untouched home preferences',() => {
  const migrated = sanitizeSettings({ accent: '#abcdef' });
  assert.deepEqual(migrated.home,sanitizeHome(defaultHome));
  const edited = sanitizeSettings({ home: { title: 'Minha Home',showArt: false,widgets: [] } },migrated);
  const changed = sanitizeSettings({ home: { padding: 22 } },edited);
  assert.equal(changed.home.title,'Minha Home');
  assert.equal(changed.home.showArt,false);
  assert.deepEqual(changed.home.widgets,[]);
  assert.equal(changed.home.padding,22);
  assert.equal(defaultHome.title,'A internet.');
});
test('home input is limited to supported widgets, geometry and safe shortcut URLs',() => {
  const result = sanitizeHome({ title: 'a'.repeat(1000),titleSize: 900,widgets: [
    { id: 'invalid',type: 'iframe',url: 'javascript:alert(1)' },
    { id: '__proto__',type: 'notes' },
    { id: 'a',type: 'clock',x: 5000,y: -1,width: -1,height: -99 },
    { id: 'a',type: 'clock' },
  ],shortcuts: [ { url: 'javascript:alert(1)' },{ url: 'file:///secret' },{ url: 'https://example.com/',title: 'Good',icon: 'script' } ] });
  assert.equal(result.widgets.length,1);
  assert.equal(result.widgets[0].x,1000);
  assert.equal(result.widgets[0].width,100);
  assert.equal(result.widgets[0].y,0);
  assert.equal(result.widgets[0].height,70);
  assert.equal(result.title.length,100);
  assert.equal(result.titleSize,76);
  assert.equal(result.shortcuts.length,1);
  assert.equal(result.shortcuts[0].icon,'globe');
  assertLayout(result.widgets);
});
test('moving and resizing a widget resolves collisions without losing widget identity',() => {
  let widgets = sanitizeHome().widgets;
  widgets = addWidget(widgets,'notes','note-a');
  widgets = resolveWidgetLayout(moveWidget(widgets,'note-a',{ x:12,y:12,width:300 }),'note-a');
  assert.equal(widgets.find(w => w.id === 'note-a').preferred.x,12);
  assert.equal(widgets.length,5);
  assertLayout(widgets);
  assert.equal(new Set(widgets.map(w => w.id)).size,5);
  assert.equal(defaultHome.widgets.find(w => w.id === 'welcome').y,12);
});
test('repeated additions and edits stay within the canvas and the 24-widget limit',() => {
  let widgets = [];
  for (let index=0;index<30;index++) widgets = addWidget(widgets,'notes',`note-${index}`);
  assert.equal(widgets.length,24);
  for (let index=0;index<24;index++) widgets = moveWidget(widgets,`note-${index}`,{ width: 130 + index % 10 * 12,x: index % 8 * 120,y: index * 240 });
  assertLayout(widgets);
});
test('mods round-trip the home layout and do not accept personal home data',() => {
  const home = sanitizeHome({ title: 'Shared Home',widgets: addWidget(defaultHome.widgets,'notes','shared-note') });
  const mod = validateMod({ schemaVersion: 1,name: 'Home mod',settings: { home,homeData: { notes: { 'shared-note': 'private content' } } } });
  assert.deepEqual(mod.settings.home,home);
  assert.equal(mod.settings.homeData,undefined);
});
