const { contextBridge, ipcRenderer } = require('electron');

const APIs = {
    on: eventListener,
    openAbout() {
        ipcRenderer.send('about');
    },
    openSubs() {
        ipcRenderer.send('subs');
    },
    openSettings() {
        ipcRenderer.send('settings');
    },
    download() {
        ipcRenderer.send('download');
    },
    openServerEditor(id) {
        ipcRenderer.send('server', id);
    },
    openContextMenu(name, data) {
        ipcRenderer.send('contextmenu', name, data);
    },
    copyPACUrl() {
        ipcRenderer.send('copyPAC');
    },
    close() {
        ipcRenderer.send('closeWindow');
    },
    readConfig() {
        return ipcRenderer.invoke('readConfig');
    },
    saveConfig(section, data) {
        ipcRenderer.send('saveConfig', section, data);
    },
};

function eventListener(eventName, cb) {
    switch (eventName) {
        case 'logbox':
            ipcRenderer.on('writeLogbox', cb);
            break;
        case 'updateSubs':
            ipcRenderer.on('updateSubs', cb);
            break;
        default:
            console.log('unknown event: %s', eventName);
            break;
    }
}

contextBridge.exposeInMainWorld('v2s', APIs);
contextBridge.exposeInMainWorld('webviewBridge', APIs);
