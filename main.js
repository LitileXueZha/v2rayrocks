const { isMainThread, workerData, Worker, parentPort } = require('worker_threads');
// PAC http server
if (!isMainThread) {
    const { PORT, PAC_FILE } = workerData;
    const http = require('http');
    const { createReadStream, open, close } = require('fs');
    let fd;
    open(PAC_FILE, (err, fdo) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        fd = fdo;
        http.createServer((req, res) => {
            console.log(req.url, req.method);
            const { pathname } = new URL(req.url, 'http://localhost');
            if (pathname === '/pac') {
                createReadStream('', { fd, autoClose: false, start: 0 }).pipe(res);
            } else {
                res.end('/pac');
            }
        }).listen(PORT, () => console.log('PAC server listen on http://127.0.0.1:%s', PORT));
    });
    parentPort.on('message', () => {
        // Stop
        close(fd, (err) => {
            process.exit(0);
        });
    });
    return;
}

if (require('electron-squirrel-startup')) return;

const fs = require('fs/promises');
const events = require('events');
const path = require('path');
const { app, BrowserWindow, nativeTheme, ipcMain, Menu, MenuItem, Tray, nativeImage, net, dialog, shell, clipboard } = require('electron');

var __DEV__ = true;
var debug = console.log;
if (__DEV__) {
    const handler = (err) => {
        console.error(err);
        dialog.showErrorBox('Unexpected', String(err));
    };
    process.on('unhandledRejection', handler);
    process.on('uncaughtException', handler);
    process.env.DEBUG = '*';
    process.env.DEBUG_COLORS = 1;
    debug = require('debug')('v2s');
}

var RENDERER = path.join(__dirname, 'renderer.js');
var RUNTIME = path.join(app.getAppPath(), 'runtime');
const appEvt = new events();
var appMain = null;

async function main() {
    debug('booting');
    await Promise.all([
        app.whenReady(),
        loadConfig(),
    ]);
    debug(app.getLocale(), app.getAppPath(), app.getPath('userData'));
    createWindow();
    addIPCEvents();
    app.on('activate', mainWindow);
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            // app.quit();
        }
    });
    doLazyWorks();
    launchPACServer();
}
main();

BrowserWindow.prototype.load = function winload(filename, search) {
    if (__DEV__) {
        const url = `http://127.0.0.1:8013/${filename}${search ?? ''}`;
        this.loadURL(url).catch(() => {
            this.loadFile(filename, { search });
        });
        return;
    }
    this.loadFile(filename, { search });
};

function mainWindow() {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length === 0) {
        createWindow();
        return;
    }
    wins[0].focus();
}
function createWindow() {
    if (cfg.dark) {
        nativeTheme.themeSource = 'dark';
    }
    const win = new BrowserWindow({
        width: 970,
        height: 600,
        backgroundColor: winbg(),
        icon: 'assets/icon-512.png',
        webPreferences: {
            preload: RENDERER,
        },
    });
    win.setMenuBarVisibility(false);
    win.load('index.html');
    win.webContents.toggleDevTools();
    appMain = win;
    win.on('closed', () => appMain = null);
    // nativeTheme.themeSource = 'dark';
}
function winbg() {
    return cfg.dark ? '#0d1117' : '#ffffff';
}

function doLazyWorks() {
    const trayIcon = nativeImage.createFromPath('assets/favicon.ico');
    const tray = new Tray(trayIcon);
    const trayMenu = Menu.buildFromTemplate([
        { label: '显示主界面', click: mainWindow },
        { label: '重启服务' },
        { type: 'separator' },
        { label: '关闭系统代理', type: 'radio', checked: true },
        { label: '开启 PAC', type: 'radio' },
        { label: '开启全局代理', type: 'radio' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
    ]);
    tray.setToolTip('V2raysocks');
    tray.setContextMenu(trayMenu);
    tray.on('click', mainWindow);
    const { node, electron, chrome } = process.versions;
    const messages = [
        `版本: ${app.getVersion()}`,
        `Electron: ${electron}`,
        `Chromium: ${chrome}`,
        `Node.js: ${node}`,
    ];
    app.setAboutPanelOptions({
        applicationName: 'V2rayrocks',
        applicationVersion: `\n${messages.join('\n')}\n`,
        copyright: 'GPL-3.0 License, Copyright (c) litilexuezha.',
        website: 'https://abc.org',
    });
    const shortcuts = new MenuItem({
        submenu: [
            { accelerator: 'F12', role: 'toggleDevTools' },
            {
                label: 'dark',
                accelerator: 'Ctrl+D',
                click() {
                    if (cfg.dark) {
                        nativeTheme.themeSource = 'light';
                        cfg.dark = 0;
                    } else {
                        nativeTheme.themeSource = 'dark';
                        cfg.dark = 1;
                    }
                    saveConfig();
                },
            },
        ],
    });
    const appMenu = Menu.getApplicationMenu();
    appMenu.append(shortcuts);
    Menu.setApplicationMenu(appMenu);
}

function addIPCEvents() {
    ipcMain.on('about', () => app.showAboutPanel());
    ipcMain.on('subs', (ev) => {
        const parent = BrowserWindow.fromWebContents(ev.sender);
        const win = new BrowserWindow({
            parent,
            width: 540,
            height: 480,
            modal: true,
            backgroundColor: winbg(),
            webPreferences: { preload: RENDERER },
        });
        win.setMenuBarVisibility(false);
        win.load('subs.html');
        win.once('close', () => parent.focus());
    });
    ipcMain.on('settings', (ev) => {
        const parent = BrowserWindow.fromWebContents(ev.sender);
        const win = new BrowserWindow({
            parent,
            width: 600,
            height: 520,
            modal: true,
            backgroundColor: winbg(),
            webPreferences: { preload: RENDERER },
        });
        win.setMenuBarVisibility(false);
        win.load('settings.html');
        win.once('close', () => parent.focus());
    });
    ipcMain.on('server', (ev, id) => {
        const parent = BrowserWindow.fromWebContents(ev.sender);
        const win = new BrowserWindow({
            parent,
            width: 600,
            height: 600,
            modal: true,
            backgroundColor: winbg(),
            webPreferences: { preload: RENDERER },
        });
        win.setMenuBarVisibility(false);
        win.load('server.html', id && `?id=${id}`);
        win.once('close', () => parent.focus());
    });
    const menuDownload = Menu.buildFromTemplate([
        { label: '订阅更新', click: updateSubs },
        { type: 'separator' },
        { label: '下载更新 v2ray', click: downloadV2ray },
        { label: '下载更新 PAC', click: downloadPAC },
        { type: 'separator' },
        { label: '检查更新' },
    ]);
    ipcMain.on('download', () => menuDownload.popup());
    const menu = Menu.buildFromTemplate([]);
    const menuSubs = [
        { label: '-', enabled: false },
        { label: '测试全部延时' },
        { type: 'separator' },
        { label: '删除所有服务器' },
    ];
    const menuServer = [
        { label: '-', enabled: false },
        { label: '测试延时' },
        { label: '测试网速' },
        { label: '上移到顶部' },
        { type: 'separator' },
        { label: '删除' },
    ];
    ipcMain.on('contextmenu', (ev, name, data) => {
        let currentMenu = menu;
        switch (name) {
            case 'servers': {
                if (data.subs) currentMenu = menuSubs;
                else currentMenu = menuServer;
                const item = data.subs
                    ? cfg.subs.find((v) => v.id === data.id)
                    : cfg.servers.find((v) => v.i === data.id);
                currentMenu[0].label = item?.mark || '-';
                currentMenu = Menu.buildFromTemplate(currentMenu);
                break;
            }
            default:
                break;
        }
        currentMenu.popup();
    });
    ipcMain.on('closeWindow', (ev) => {
        const win = BrowserWindow.fromWebContents(ev.sender);
        win.close();
    });

    ipcMain.on('copyPAC', () => {
        const nonce = Date.now() % 1000;
        const url = `http://127.0.0.1:${cfg.settings.pacPort}/pac?t=${nonce}`;
        clipboard.writeText(url);
    });
    ipcMain.handle('readConfig', async () => {
        await loadServerConfig();
        return cfg;
    });
    ipcMain.on('saveConfig', (ev, section, data) => {
        cfg[section] = data;
        saveConfig();
    });
}

var cfg = null;
async function loadConfig() {
    try {
        const filePath = path.join(RUNTIME, 'rocks-cfg.json');
        const rawContent = await fs.readFile(filePath, 'utf-8');
        cfg = JSON.parse(rawContent);
    } catch (err) {
        cfg = require('./package.json')['rocks-cfg'];
        await fs.mkdir(RUNTIME, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(cfg));
    }
}
var timer = null;
function saveConfig() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        const filePath = path.join(RUNTIME, 'rocks-cfg.json');
        fs.writeFile(filePath, JSON.stringify({ ...cfg, servers: [] }));
    }, 300);
}
var loadServerConfig = once(async () => {
    try {
        const filePath = path.join(RUNTIME, 'rocks-cfg_servers.json');
        const rawContent = await fs.readFile(filePath, 'utf-8');
        cfg.servers = JSON.parse(rawContent);
    } catch (e) {}
});
function saveServerConfig() {
    const filePath = path.join(RUNTIME, 'rocks-cfg_servers.json');
    fs.writeFile(filePath, JSON.stringify(cfg.servers));
}

function downloadV2ray() {
    let arch, platform;
    switch (process.arch) {
        case 'ia32':
            arch = '32';
            break;
        case 'x64':
            arch = '64';
            break;
        default:
            throw new Error('请手动下载到runtime目录');
    }
    switch (process.platform) {
        case 'win32':
            platform = 'windows';
            break;
        case 'darwin':
            platform = 'macos';
            break;
        case 'linux':
        case 'freebsd':
        case 'openbsd':
            platform = process.platform;
            break;
        default:
            throw new Error('请手动下载到runtime目录');
    }
    logbox('正在检查更新 v2ray');
    const name = `v2ray-${platform}-${arch}.zip`;
    const filePath = path.join(RUNTIME, name);
    const LATEST = 'https://api.github.com/repos/v2fly/v2ray-core/releases/latest';
    const req = net.request(LATEST);
    req.on('response', (res) => {
        const buff = [];
        res.on('data', (chunk) => buff.push(chunk));
        res.on('end', async () => {
            const data = Buffer.concat(buff).toString();
            const { tag_name, assets, html_url } = JSON.parse(data);
            const current = await v2rayVersion();
            if (!isNewVersion(current, tag_name)) {
                dialog.showMessageBox(appMain, {
                    title: 'V2rayrocks',
                    message: '暂无 v2ray 更新',
                    type: 'info',
                });
                return;
            }
            const item = assets.find((v) => v.name === name);
            if (!item) {
                throw new Error('请手动下载到runtime目录');
            }
            const act = await dialog.showMessageBox(appMain, {
                type: 'info',
                title: 'V2rayrocks',
                message: '检测到新的版本',
                detail: `${current} -> ${tag_name}`,
                noLink: true,
                buttons: ['取消', '查看新版本发布', '下载'],
            });
            if (act.response === 1) {
                shell.openExternal(html_url);
            } else if (act.response === 2) {
                logbox(`开始下载 ${name}`);
                await download(item.browser_download_url, filePath);
                logbox('下载成功。开始解压...');
                await unzip(filePath, RUNTIME);
                logbox('解压完成');
                shell.beep();
            }
        });
    });
    req.end();
}

function v2rayVersion() {
    return new Promise((resolve, reject) => {
        const REG_V2 = /V2Ray (\d+\.\d+\.\d+)/;
        const exe = process.platform === 'win32' ? '.exe' : '';
        const bin = path.join(RUNTIME, `v2ray${exe}`);
        const { execFile } = require('child_process');
        execFile(bin, ['-version'], (err, stdout, stderr) => {
            if (err) {
                // v5
                execFile(bin, ['version'], (err, stdout) => {
                    if (err) {
                        resolve('0.0.0');
                        return;
                    }
                    resolve(stdout.match(REG_V2)[1]);
                });
                return;
            }
            resolve(stdout.match(REG_V2)[1]);
        });
    });
}

async function downloadPAC() {
    const url = cfg.settings.pacSource;
    if (!url) {
        logbox('PAC 源地址未配置');
        return;
    }
    const filePath = path.join(RUNTIME, 'pac.txt');
    logbox(`开始下载 ${url}`);
    await download(url, filePath);
    await generatePAC(filePath);
    logbox('更新 PAC 完成');
    launchPACServer();
    shell.beep();
}

async function generatePAC(filePath) {
    // See https://github.com/LitileXueZha/fastpac/blob/main/fastpac.js
    function FindProxyForURL(url, host) {
        var hostLabels = host.split('.'),
            i = hostLabels.length - 1;
        if (findInURL(url, d.Whitelist.URL, 0)) {
            return 'DIRECT';
        }
        if (findInHost(hostLabels, d.Whitelist.Host, i)) {
            return 'DIRECT';
        }
        if (findInURL(url, d.Proxy.URL, 0)) {
            return __PROXY__;
        }
        if (findInHost(hostLabels, d.Proxy.Host, i)) {
            return __PROXY__;
        }
        return 'DIRECT';
    }
    function findInURL(url, URLs, i) {
        if (i === URLs.length) {
            return false;
        }
        var max = URLs[i].length;
        if (url.length > max) return findInURL(url, URLs, i + 1);
        for (var j = 0; j < max; j ++) {
            if (url[j] !== URLs[i][j]) {
                return findInURL(url, URLs, i + 1);
            }
        }
        return true;
    }
    function findInHost(labels, tree, i) {
        var found = labels[i] in tree;
        if (i === 0) {
            return found;
        }
        if (found) {
            tree = tree[labels[i]];
            if (tree) return findInHost(labels, tree, i - 1);
        }
        return false;
    }
    const d = {
        Whitelist: { URL: [], Host: {} },
        Proxy: { URL: [], Host: {} },
    };
    const REG_TRIM = /^\.|\/$/g;
    const REG_REG = /(^\/|[*?])/;
    const raw = await fs.readFile(filePath, 'utf-8');
    const decodeRaw = Buffer.from(raw, 'base64').toString();
    const rules = decodeRaw.split('\n');
    if (cfg.settings.pacRules) {
        const userRules = cfg.settings.pac.rules.trim().split('\n');
        userRules.forEach((v) => rules.push(v));
    }

    for (let i = 0, len = rules.length; i < len; i++) {
        let line = rules[i];
        if (!line) continue;
        if (line[0] === '!') continue;
        if (REG_REG.test(line)) {
            console.log('正则不支持', line);
            continue;
        }
        line = line.replace('%2F', '/').replace(REG_TRIM, '');
        if (line[0] === '@') {
            if (line[3] === '|') {
                // @@||
                addHost(d.Whitelist.Host, line.substring(4));
                continue;
            }
            // @@|
            d.Whitelist.URL.push(line.substring(3));
            continue;
        }
        if (line[0] === '|') {
            if (line[1] === '|') {
                addHost(d.Proxy.Host, line.substring(2));
                continue;
            }
            d.Proxy.URL.push(line.substring(1));
            continue;
        }
        // Non Adblock filters
        if (line.indexOf('/') > 0) {
            if (!line.startsWith('http')) {
                line = `https://${line}`;
            }
            // Maybe a URL
            d.Proxy.URL.push(line);
            continue;
        }
        addHost(d.Proxy.Host, line);
    }
    // Format Proxy URLs
    d.Proxy.URL = d.Proxy.URL.filter((u) => {
        const { host, pathname } = new URL(u);
        if (pathname === '/') {
            addHost(d.Proxy.Host, host);
            return false;
        }
        return true;
    });
    function addHost(tree, host) {
        const labels = host.split('.');
        for (let i = labels.length - 1; i >= 0; i--) {
            const label = labels[i];
            if (i === 0) {
                tree[label] = null;
            } else {
                if (!tree[label]) tree[label] = {};
                tree = tree[label];
            }
        }
    }
    const PROXY = `SOCKS 127.0.0.1:${cfg.settings.socksPort}; DIRECT`;
    const OUT = path.join(RUNTIME, 'proxy.pac');
    const { createWriteStream } = require('fs');
    const out = createWriteStream(OUT);
    out.write(`'use strict';\n\nvar d = `);
    out.write(JSON.stringify(d));
    out.write(';\n');
    out.write(findInURL.toString());
    out.write('\n');
    out.write(findInHost.toString());
    out.write('\n');
    out.end(FindProxyForURL.toString().replace(/__PROXY__/g, `'${PROXY}'`));
}

let worker;
function launchPACServer() {
    // process.env.ELECTRON_RUN_AS_NODE = 1;
    const data = {
        PAC_FILE: path.join(RUNTIME, 'proxy.pac'),
        PORT: cfg.settings.pacPort,
    };
    worker?.postMessage('stop');
    worker = new Worker(__filename, { workerData: data });
}

function download(url, to) {
    return new Promise((resolve, reject) => {
        const req = net.request(url);
        req.on('redirect', () => req.followRedirect());
        req.on('response', (res) => {
            if (res.statusCode !== 200) {
                reject(res.statusCode);
                return;
            }
            const { createWriteStream } = require('fs');
            const out = createWriteStream(to);
            out.on('error', reject);
            out.on('finish', resolve);
            const total = res.headers['content-length'];
            if (total > 0) {
                let m = 0, threshold = 20, progress = threshold;
                res.on('data', (chunk) => {
                    m += chunk.byteLength;
                    if ((m / total) >= (progress / 100)) {
                        logbox(`${progress}%`);
                        progress += threshold;
                    }
                });
            }
            res.pipe(out);
        });
        req.setHeader('Accept', 'application/octet-stream');
        req.on('error', reject);
        req.end();
    });
}

function unzip(zipFile, extractTo) {
    return new Promise(async (resolve, reject) => {
        const { execFile } = require('child_process');
        // See https://github.com/feross/cross-zip/blob/master/index.js
        let bin = 'unzip';
        let zipArgs = ['-o', zipFile, '-d', extractTo];
        let temp;
        if (process.platform === 'win32') {
            bin = 'powershell.exe';
            temp = path.join(extractTo, 'unzip_temp');
            zipArgs = [
                '-nologo', '-noprofile', '-command',
                '& { param([String]$myInPath, [String]$myOutPath); Add-Type -A "System.IO.Compression.FileSystem"; [IO.Compression.ZipFile]::ExtractToDirectory($myInPath, $myOutPath); exit !$? }',
                '-myInPath', `"${zipFile}"`, '-myOutPath', `"${temp}"`,
            ];
        }
        execFile(bin, zipArgs, async (err, stdout, stderr) => {
            if (err) reject(err);
            if (stderr) reject(stderr);
            if (temp) {
                try {                    
                    const tempFiles = await fs.readdir(temp);
                    const move = (name) => {
                        const src = path.join(temp, name);
                        const dest = path.join(extractTo, name);
                        return fs.rename(src, dest);
                    };
                    await Promise.all(tempFiles.map(move));
                } catch (moveErr) {
                    reject(moveErr);
                }
            }
            resolve();
        });
    });
}

function isNewVersion(old, current) {
    const oldArr = old.replace('v', '').split('.');
    const currArr = current.replace('v', '').split('.');
    for (let i = 0; i < 3; i++) {
        if (parseInt(oldArr[i], 10) < parseInt(currArr[i], 10)) {
            return true;
        }
    }
    return false;
}

async function updateSubs() {
    logbox('开始更新订阅...');
    const tasks = cfg.subs.filter((sub) => sub.enable).map(fetchSub);
    const res = await Promise.all(tasks);
    for (let i = 0, len = res.length; i < len; i++) {
        if (res[i]) {
            const { sub, buff } = res[i];
            try {
                const data = parseSub(buff.toString());
                let servers = cfg.servers.filter((v) => v.sid !== sub.id);
                data.forEach((v, j) => {
                    v.sid = sub.id;
                    v.i = `${sub.id}${j}`;
                });
                cfg.servers = servers.concat(data);
                appMain.webContents.send('updateSubs', sub, data);
                logbox(`${sub.mark} 更新完成`);
            } catch (err) {
                console.error(err);
                logbox(`${sub.mark} 解析失败`);
            }
        }
    }
    shell.beep();
    saveServerConfig();

    function fetchSub(sub) {
        return new Promise((resolve) => {
            const req = net.request(sub.url);
            const fail = () => {
                resolve(null);
                logbox(`${sub.mark} 下载失败`);
            };
            req.on('response', (res) => {
                if (res.statusCode !== 200) {
                    fail();
                    return;
                }
                const buff = [];
                res.on('data', (chunk) => buff.push(chunk));
                res.on('end', () => resolve({ sub, buff: Buffer.concat(buff) }));
                res.on('error', fail);
            });
            req.on('error', fail);
            req.end();
        });
    }
}
function parseSub(rawContent) {
    const text = Buffer.from(rawContent, 'base64').toString();
    const arr = text.split('\n');
    const res = [];
    for (let i = 0, len = arr.length; i < len; i++) {
        if (arr[i]) {
            const [schema, value] = arr[i].split('://');
            switch (schema) {
                case 'ss':
                case 'trojan': {
                    const [token, url] = value.split('@');
                    const data = { schema, token };
                    const { hostname, port, searchParams, hash } = new URL(`http://${url}`);
                    const search = {};
                    for (const [key, value] of searchParams.entries()) search[key] = value;
                    const mark = decodeURIComponent(hash.substring(1));
                    data.addr = hostname;
                    data.port = parseInt(port, 10);
                    res.push({ ...search, ...data, mark });
                    break;
                }
                case 'vmess': {
                    const rawData = Buffer.from(value, 'base64').toString();
                    const data = JSON.parse(rawData);
                    const { ps: mark, ...otherValues } = data;
                    res.push({ ...otherValues, schema, mark });
                    break;
                }
                default:
                    logbox(`${schema} 协议暂不支持`);
                    break;
            }
        }
    }
    return res;
}

function logbox(msg) {
    if (__DEV__) debug(msg);
    if (!appMain) return;
    appMain.webContents.send('writeLogbox', msg);
}
logbox.clear = function clearLogbox() {
    if (!appMain) return;
    appMain.webContents.send('writeLogbox', null, true);
};

function once(fn) {
    let doing = true;
    return (...args) => {
        if (doing) {
            doing = null;
            return fn(...args);
        }
    };
}
