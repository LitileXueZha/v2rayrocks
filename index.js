var cfg, current;

async function onReady() {
    const $toolbar = document.getElementById('toolbar');
    $toolbar.addEventListener('click', (ev) => {
        const id = ev.target?.dataset?.id;
        switch (id) {
            case 'subs':
                v2s.openSubs();
                break;
            case 'about':
                v2s.openAbout();
                break;
            case 'download':
                v2s.download();
                break;
            case 'settings':
                v2s.openSettings();
                break;
            default:
                break;
        }
    });
    const $current = document.getElementsByClassName('current')[0];
    const $mark = $current.getElementsByClassName('mark')[0];
    const $address = $current.getElementsByClassName('address')[0];
    const $port = $current.getElementsByClassName('port')[0];
    const $icSub = $current.getElementsByClassName('icon')[0];
    const $delay = $current.getElementsByClassName('delay')[0];
    const $speed = $current.getElementsByClassName('speed')[0];
    const $delayVal = $delay.getElementsByClassName('value')[0];
    const $speedVal = $speed.getElementsByClassName('value')[0];
    const $extra = $current.getElementsByClassName('extra')[0];
    const renderCurrent = (server) => {
        current = server;
        $mark.textContent = server.mark;
        $address.textContent = server.addr || server.add || '-';
        $port.textContent = server.port;
        if (server.sid) $icSub.classList.remove('anim-hide');
        else $icSub.classList.add('anim-hide');
        if (server.ping) {
            $delayVal.textContent = `${server.ping}ms`;
        }
        if (server.speed) {
            $speedVal.textContent = `${server.speed}/s`;
        }
    };
    const $servers = document.getElementsByClassName('server-list')[0];
    const subs = {};
    cfg = await v2s.readConfig();
    const $frag = document.createDocumentFragment();
    for (let i = 0, len = cfg.servers.length; i < len; i++) {
        const item = cfg.servers[i];
        const $item = createServerItem(item);
        const { sid } = item;
        if (sid) {
            let $subs = subs[sid];
            if (!$subs) {
                const sub = cfg.subs.find((v) => v.id === sid);
                const total = cfg.servers.filter((v) => v.sid === sid).length;
                $subs = createSubs(sub || { id: sid }, total);
                $frag.appendChild($subs.parentNode);
            }
            $subs.appendChild($item);
        } else {
            $frag.appendChild($item);
            $item.setAttribute('draggable', 'true');
        }
    }
    function createSubs(sub, total) {
        const { id, mark } = sub;
        const $subItem = document.createElement('li');
        $subItem.className = 'item subs';
        $subItem.innerHTML = `<div class="title" title="点击展开/收起列表">${mark}<span>${total}</span></div>`;
        $subItem.dataset.id = sub.id;
        const $subs = document.createElement('ul');
        $subs.className = 'subs-list';
        $subItem.appendChild($subs);
        $subs.previousElementSibling.addEventListener('click', () => {
            $subs.parentNode.classList.toggle('open');
        });
        subs[id] = $subs;
        return $subs;
    }
    function createServerItem(server) {
        const { mark, ping, i } = server;
        const $item = document.createElement('li');
        $item.className = 'item';
        $item.innerHTML = `<span>${mark}</span>`;
        $item.dataset.id = i;
        if (ping) {
            $item.innerHTML = `<span>${mark}</span><div class="dot"></div>`;
            $item.classList.add(ping < 3500 ? 'ok' : 'timeout');
        }
        return $item;
    }
    $servers.appendChild($frag);
    $servers.addEventListener('contextmenu', bindByTargetName('LI', onServersContextMenu));
    let $selected = null, $running = null;
    const onSelect = bindByTargetName('LI', (ev, target) => {
        if (target.classList.contains('subs')) return;
        $selected?.classList.remove('selected');
        target.classList.add('selected');
        $selected = target;
        const selected = cfg.servers.find((v) => v.i === target.dataset.id);
        renderCurrent(selected);
    });
    const onLaunch = bindByTargetName('LI', (ev, target) => {
        if (target.classList.contains('subs')) return;
        $running?.classList.remove('active');
        target.classList.add('active');
        $running = target;
    });
    $servers.addEventListener('click', onSelect);
    $servers.addEventListener('dblclick', onLaunch);
    v2s.on('updateSubs', async (ev, sub, data) => {
        let $subs = subs[sub.id];
        if (!$subs) {
            $subs = createSubs(sub, data.length);
            $servers.appendChild($subs.parentNode);
        }
        data.forEach((v) => $subs.appendChild(createServerItem(v)));
        const $span = $subs.previousElementSibling.getElementsByTagName('span')[0];
        $span.textContent = data.length;
        cfg = await v2s.readConfig();
    });
    const $add = document.getElementById('add');
    $add.addEventListener('click', () => v2s.openServerEditor());
    const $edit = document.getElementById('edit');
    $edit.addEventListener('click', () => v2s.openServerEditor(current.i));
    const $batchAdd = document.getElementById('batchAdd');
    const $dialog = document.getElementById('batchAdd-dialog');
    // $dialog.showModal();
    $batchAdd.addEventListener('click', () => $dialog.showModal());
    const $pac = document.getElementById('copyPac');
    $pac.addEventListener('click', () => v2s.copyPACUrl());
    initLogbox();
}

function initLogbox() {
    let sticky = true, logCount = 0;
    const $logbox = document.getElementsByClassName('logbox')[0];
    const $content = $logbox.firstElementChild;
    const $pin = $logbox.getElementsByClassName('pin')[0];
    v2s.on('logbox', (ev, msg, clear) => {
        if (clear) {
            logCount = 0;
            $content.textContent = '';
            return;
        }
        logCount ++;
        $content.textContent += `${msg}\n`;
        if (sticky) {
            $content.scrollTop = 200 + logCount * 20;
        }
    });
    $pin.addEventListener('click', () => {
        $pin.classList.toggle('on');
        sticky = !sticky;
        if (sticky) {
            $content.scrollTop = 200 + logCount * 20;
            sct = Number.MAX_SAFE_INTEGER;
        }
    });
    let sct = $content.scrollTop, hide = false;
    $content.addEventListener('scroll', () => {
        if (sticky) return;
        const diff = $content.scrollTop - sct;
        if (Math.abs(diff) > 10) {
            if (diff > 0 && hide) {
                $pin.classList.remove('anim-hide');
                hide = false;
            } else if (diff < 0 && !hide) {
                $pin.classList.add('anim-hide');
                hide = true;
            }
        }
        sct = $content.scrollTop;
    });
}

function loadMonacoEditor() {
    const CDN_LINK = 'https://unpkg.com/monaco-editor@0.34.1/min/vs';
    const loader = document.createElement('script');
    loader.src = `${CDN_LINK}/loader.js`;
    loader.onload = () => {
        require.config({ paths: { vs: CDN_LINK } });
        require(['vs/editor/editor.main'], () => {
            console.log(monaco);
            const editor = monaco.editor.create(document.getElementsByClassName('logbox')[0], {
                language: 'plaintext',
                fontSize: 12,
                minimap: { enabled: false },
                // theme: 'vs-dark',
                // lineNumbers: 'off',
                // scrollbar: { vertical: 'hidden' },
            });
        });
    };
    document.body.appendChild(loader);
}

function onServersContextMenu(ev, target) {
    const { id } = target.dataset;
    const isSub = target.classList.contains('subs');
    // const isSub = id.length > 3;

    ev.stopPropagation();
    v2s.openContextMenu('servers', { id, subs: isSub });
}

function bindByTargetName(tag, listener) {
    const findByTagName = (dom) => {
        if (dom.tagName === tag) return dom;
        if (dom === document.body) return;
        return findByTagName(dom.parentNode);
    };
    return function (ev) {
        const $dom = findByTagName(ev.target);
        if (!$dom) return;
        listener(ev, $dom);
    };
}

document.addEventListener('DOMContentLoaded', onReady);
window.addEventListener('contextmenu', v2s.openContextMenu);
