const { app,BrowserWindow } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');
if (!process.env.CYPHER_TEST_PROFILE) throw new Error('Missing isolated test profile.');
app.setPath('userData',process.env.CYPHER_TEST_PROFILE);
require(process.env.CYPHER_RESTART_MAIN || '../electron/main.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
async function until(callback,label) { for (let i=0;i<100;i++) { if (await callback()) return; await pause(100); } throw new Error('Timeout: '+label); }
(async () => {
  try {
    await app.whenReady();
    let win;
    await until(() => { win=BrowserWindow.getAllWindows()[0]; return win && !win.webContents.isLoading() && win.webContents.getURL().includes('index.html'); },'restarted renderer');
    await until(() => win.webContents.executeJavaScript('!!window.cypher'),'preload');
    const invoke = (action,payload) => win.webContents.executeJavaScript(`window.cypher.invoke(${JSON.stringify(action)},${JSON.stringify(payload) || 'undefined'})`);
    const state = await invoke('state');
    assert.equal(state.settings.home.widgets.length,6);
    const welcome = state.settings.home.widgets.find(w => w.type === 'welcome');
    assert.equal(welcome.welcomeTitle,'Meu espaço.');
    const note = state.settings.home.widgets.find(w => w.type === 'notes');
    assert.equal(state.homeData.notes[note.id],'My private note');
    assert.ok(note.y > 0);
    assert.equal(note.height,230);
    const focus = state.settings.home.widgets.find(w => w.type === 'focus');
    assert.equal(state.homeData.focusById?.[focus.id]?.endsAt,null);
    assert.ok(!state.tabs.some(tab => tab.private));
    await invoke('tab:new');
    await until(() => win.webContents.executeJavaScript('document.querySelector(".notes-widget textarea")?.value === "My private note"'),'restored note renders');
    assert.ok(await win.webContents.executeJavaScript('document.querySelector(".welcome-widget h1").textContent.includes("Meu espaço.")'));
    console.log('PASS: Full restart preserves home layout, positions, notes and focus; private tabs are not restored.' + (process.env.CYPHER_RESTART_MAIN ? ' Packaged ASAR verified.' : ''));
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
})();
