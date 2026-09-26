---
title: "webview library: desktop apps"
description: "Build desktop apps with Nio: the webview library opens a native window with web content, and a bridge connects the page to your program."
---

# Webview

## Introduction

```nio
import './webview/webview';
```

The `webview` library opens a native window that shows web content with the platform's own engine. You draw the interface in HTML, CSS and JavaScript, and the program behind it is Nio. The page and the program talk through a small two-way bridge.

The engine belongs to the operating system (WKWebView on macOS), so the library adds no rendering code. A program that uses it stays a few hundred kilobytes. Rendering, JavaScript, networking and TLS inside the window are the system's.

> [!NOTE]
>
> **macOS only, for now.** The macOS body is complete. Windows (WebView2) and Linux (WebKitGTK) are stubs behind the same native surface, and `webview.create` raises `ErrorCode.UNSUPPORTED` there. When those bodies are written, programs will not need to change.

The library is big enough to build a full web browser with, and it has done so. You can ignore most of it: one window, one page and a bridge is a complete app. The sections below start there and add features one at a time. The [reference](#reference) at the end lists every function.

## Getting the library

`webview` is an [external library](/docs/libraries): it is part of the Nio repository, but it is not in the standard library. It lives in [`libraries/webview/`](https://github.com/nio-org/nio/tree/main/libraries/webview) and has two files:

* `webview.nio`, the Nio API.
* `native/webview_native.m`, the Objective-C body that talks to Cocoa and WebKit.

Copy the `webview` folder into your project and import it by path. There is no build step: the import brings in the native file and the frameworks it needs, and `clang` compiles them with your program, as [native interop](/docs/native) describes.

```text
my-app/
  app.nio          import './webview/webview';
  webview/
    webview.nio
    native/webview_native.m
```

The default alias is the file's stem, so every name in this page is reached as `webview.<name>`.

## A first window

```nio
import './webview/webview';

String const PAGE = `<!doctype html>
<meta charset="utf-8">
<h1>Hello from Nio</h1>
<button onclick="window.nio.send('hello', 'the button was clicked')">Say hello</button>
<p id="out"></p>`;

void main() {
    webview.Window w = webview.create("Hello", 800, 500) catch e {
        print(e.message);
        return;
    };
    webview.setPageBridge(w, true) catch e { return; };
    webview.loadHtml(w, PAGE) catch e { return; };

    int clicks = 0;
    webview.onPageMessage(w, "hello", void (String body) -> {
        clicks++;
        print(`the page says: ${body}`);
        webview.evalJs(w, `document.getElementById('out').textContent = 'Nio saw ${clicks} clicks'`);
    });

    webview.run(w);
}

main();
```

```sh
nio run app.nio
```

Each click prints `the page says: the button was clicked`, and the page updates its own text with the count Nio sends back.

* `create(title, width, height)` opens the window. The size is the content size, in CSS pixels.
* `loadHtml(w, html)` shows a page given as text. `navigate(w, url)` loads an `https://`, `http://` or `file://` URL instead.
* `setPageBridge(w, true)` gives the page `window.nio`. It is off by default; see [the bridge](#the-bridge) for why.
* `onPageMessage(w, channel, handler)` registers the function that receives one channel's messages.
* `run(w)` is the main loop. It returns when the user closes the window.

Most calls can fail, so they are written with `catch`. A handler's type is `Function(String)<void!>`, so a handler can raise too: when one does, `run` prints the error and keeps going.

## The bridge

A page sends to the program with one of two JavaScript calls:

```js
window.nio.send('save', JSON.stringify(doc));   // channel "save"
window.nio.postMessage('ping');                  // channel "message"
```

Both carry one string. `send` names a channel, and `postMessage` always uses the channel called `"message"`. The program registers one handler per channel, and registering again replaces the handler. A message on a channel with no handler is dropped.

The program speaks to the page with JavaScript:

* `evalJs(w, js)` runs a script in the shown page and answers nothing. When the page has something to say back, it calls `window.nio.send`.
* `evalJsResult(w, tab, js)` runs a script and answers an id at once. The script's value, which must be a string, arrives later on the reserved [`__evalresult`](#reserved-channels) channel as `"<id>,ok,<value>"` (or `"<id>,err,<reason>"`). This is how a program reads a page without turning the bridge on.

To put a Nio string into a script, write it with `json.toText`, which makes it a valid JavaScript string literal:

```nio
webview.evalJs(w, `showName(${json.toText(name)})`);
```

> [!WARNING]
>
> **Leave the page bridge off for pages you do not control.** With `setPageBridge(w, true)`, every page the window shows (and every frame inside it, third-party ones included) can send your program messages. Turn it on when the page *is* your app, as in the first example. A program that loads arbitrary sites leaves it off, draws its own controls in the [UI layer](#two-layers-ui-and-content), which always has the bridge, and reads pages with `evalJsResult`. Call `setPageBridge` once, right after `create`.

Whatever arrives from a content page is input from outside the program: check it the way you check anything that came over a network.

## The event loop

Nio functions cannot yet be called from C, so the native side does not call your handlers directly. It queues each message, and the loop hands the queue to your handlers between turns of the platform's event loop. There are three levels, and each is written in terms of the one below:

| Call | What it does |
|---|---|
| `run(w)` | Loops until the window closes. |
| `poll(w, ms)` | One turn: `step`, then `dispatch`. Answers `false` once the window has closed. |
| `step(w, ms)` | Runs the platform's event loop for up to `ms` milliseconds. Answers `false` once the window has closed. |

`dispatch(w)` hands what is waiting to the handlers. `takeMessage(w)` and `takeUiMessage(w)` take messages one at a time instead, answering `null` when the queue is empty, for a program that wants no handlers at all:

```nio
while (webview.step(w, 1000)) {
    String? msg = webview.takeMessage(w);
    while (msg != null) {
        print(msg);
        msg = webview.takeMessage(w);
    }
}
```

The timeout is not latency. A queued message ends a `step` at once, so the number only sets how often an idle program wakes up. When `step` answers `false`, the user closed the window: that is an event, not an error.

## Two layers: UI and content

A window can hold two web views stacked on each other:

* **The content view** shows a document: your app's page, or a website.
* **The UI layer** (`setUi(w, html)`) is a second page underneath it that fills the whole window. It draws every part of the interface (toolbar, sidebar, status bar) as one HTML document and leaves a hole where the content goes.

The UI page measures its hole and sends the four distances to the window's edges. The program places the content view there with `setContentInsets`. Insets survive a resize, so the message is only needed when the UI's layout changes, not when the window is dragged.

```nio
import './webview/webview';
import 'string';
import 'json';

String const UI = `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; font: 13px -apple-system, sans-serif; }
  body { display: grid; grid-template-rows: 40px 1fr; }
  #bar { display: flex; gap: 6px; align-items: center; padding: 0 8px; background: #eee; }
  #url { flex: 1; }
</style>
<div id="bar">
  <button onclick="window.nio.send('back', '')">‹</button>
  <input id="url" onkeydown="if (event.key === 'Enter') window.nio.send('go', this.value)">
</div>
<div id="hole"></div>
<script>
  function sendInsets() {
    var r = document.getElementById('hole').getBoundingClientRect();
    window.nio.send('insets', [r.top, r.left, innerHeight - r.bottom, innerWidth - r.right].join(','));
  }
  new ResizeObserver(sendInsets).observe(document.getElementById('hole'));
</script>`;

void main() {
    webview.Window w = webview.create("Browser", 1000, 700) catch e {
        print(e.message);
        return;
    };
    webview.setUi(w, UI) catch e { return; };

    webview.onMessage(w, "insets", void (String body) -> {
        String[] p = string.split(body, ",");
        if (p.length != 4) {
            return;
        }
        webview.setContentInsets(w,
            string.toInt(p[0]) catch 0, string.toInt(p[1]) catch 0,
            string.toInt(p[2]) catch 0, string.toInt(p[3]) catch 0);
    });
    webview.onMessage(w, "go", void (String url) -> {
        webview.navigate(w, url);
    });
    webview.onMessage(w, "back", void (String body) -> {
        webview.back(w);
    });
    webview.onMessage(w, "__nav", void (String body) -> {
        int comma = string.find(body, ",");
        String url = string.substring(body, comma + 1, string.length(body));
        webview.uiEval(w, `document.getElementById('url').value = ${json.toText(url)}`);
    });
    webview.onMessage(w, "__title", void (String body) -> {
        int comma = string.find(body, ",");
        webview.setTitle(w, string.substring(body, comma + 1, string.length(body)));
    });

    webview.navigate(w, "https://example.org") catch e { return; };
    webview.run(w);
}

main();
```

That is a small working browser. Notice which calls go where:

* `onMessage` registers handlers for the **UI page**. `onPageMessage` registers them for the **content page**. The two have separate queues.
* `uiEval` runs JavaScript in the UI page, and `evalJs` in the content page.
* The content page here has no bridge, so no website can send `go` and drive the window.

> [!IMPORTANT]
>
> **Take commands only from the UI layer.** The UI page is your program's own, and a content page is whatever the network sent. The two queues are kept apart so that a site can never reach a handler registered with `onMessage`.

A few more calls work on the layers:

* `setUiFront(w, true)` raises the UI above the content for a moment, so a menu or popover drawn by the UI can float over the page. The UI view is transparent wherever its page paints nothing. While raised, it takes every mouse event, which is how a popover closes on the first click outside it; call `setUiFront(w, false)` when it closes.
* `focusUi(w)` gives the keyboard to the UI page, and `focusTab(w)` gives it to the shown content page. A DOM `focus()` in the UI page is not enough while the content view holds the keyboard. `uiFocused(w)` answers which side has it.

A window that never calls `setUi` is just a content view that fills the window.

## Reserved channels

The library reports what the engine does on channels whose names begin with `__`. They arrive on the UI queue, so register them with `onMessage`. The native side pushes them, and page script cannot reach that queue, so their data comes from the engine and not from a page. (A page that sends a `__` channel itself lands on the content queue, where it is just another untrusted message.)

Most bodies begin with the tab id, then a comma.

| Channel | Body | When |
|---|---|---|
| `__nav` | `tab,url` | A tab committed a new document: a link click, a `navigate` call, or a reload (with the same URL). |
| `__navinpage` | `tab,url` | The URL changed without a new document: `history.pushState` or a `#fragment` jump. Same origin only. |
| `__http` | `tab,status` | The HTTP status of the document about to show. Sent just before its `__nav`, main frame only. |
| `__title` | `tab,title` | The page's title, including changes the page makes to it later. |
| `__load` | `tab,1` or `tab,0` | The tab started or stopped loading. Use it to switch a reload button into a stop button. |
| `__favicon` | `tab,url` | Where the page says its icon is. This is the page's claim: check the scheme before loading it. |
| `__newtab` | `tab,url` | A page asked for a window (`window.open`, `target="_blank"`), and the engine made a tab for it. See [tabs](#tabs). |
| `__newtabbg` | `tab,url` | The same, from a gesture that means "behind this page": a middle-click or Cmd-click on a link. |
| `__closed` | `tab,` | A page called `window.close()`. The tab stays until you call `closeTab`. |
| `__evalresult` | `id,ok,value` or `id,err,reason` | The answer to an `evalJsResult`. The value came from the page, so it is untrusted. |
| `__find` | `tab,count,index` | The answer to a `find`. See [find in page](#find-in-page). |
| `__menu` | `0,id` | A main-menu item was picked. See [menus](#menus). |
| `__ctx` | `tab,id` | A context-menu item was picked. |
| `__download` | `id,json` | A download started, got its file name, finished, failed or was cancelled. |
| `__perm` | `tab,json` | A page asked for a permission. See [permissions](#permissions). |
| `__extloaded`, `__extaction`, `__extperm`, `__extpopup`, `__extnewtab` | `ext,json` | Web extension events. See [web extensions](#web-extensions). |

## Tabs

A window can hold several content views, one shown at a time. The window opens with tab `1`.

* `newTab(w)` creates a hidden tab and answers its id.
* `showTab(w, id)` puts a tab on screen. Every call that acts on "the page" (`navigate`, `evalJs`, `back`, the insets, and the rest) acts on the shown tab, so a program without tabs never has to think about them.
* `closeTab(w, id)` destroys a hidden tab and frees what the engine held for it. Closing the shown tab is refused: show another one first.
* `focusTab(w)` gives the keyboard to the shown tab. `showTab` does not do this by itself, because on a new blank tab the next thing a user does is type in your own address bar.

`evalJsResult`, `find` and `clearFind` answer later, on a channel, so they take a tab id; `0` there means the shown tab.

**A page can ask for a window, and the answer is a tab.** When a page calls `window.open` or the user follows a `target="_blank"` link, the engine creates a tab at once and starts loading the URL in it. Your `__newtab` handler adopts it (usually `showTab`), but must not navigate it again. A middle-click, a Cmd-click, or the engine's own "Open Link in New Window" item arrives on `__newtabbg` instead, which by convention opens behind the current page. The other end of this is `__closed`: sign-in popups open a window, post their result to the opener, and close themselves, so a program that ignores `__closed` leaves an empty tab behind.

**Unloading a tab can keep its place.** `tabState(w, id)` answers an opaque snapshot of a tab's history, scroll positions and form contents. `tabRestore(w, id, state)` gives it back to a new tab in place of its first navigation, so the page returns where it was. It is best-effort: an empty snapshot, or one the engine no longer recognizes, means "navigate to the URL instead". Needs macOS 12.

**What a tab is doing:**

* `tabAudible(w, id)` answers whether the tab makes sound now.
* `tabMediaState(w, id)` answers `"none"`, `"playing"`, `"paused"` or `"suspended"`. Muted autoplay counts as `"playing"`, so use `tabAudible` for a rule about sound.
* `tabCaptureState(w, id)` answers whether the tab holds the camera or microphone: `"none"`, `"camera"`, `"microphone"` or `"both"`.
* `tabZoom(w, id, percent)` sets the page zoom, from 25 to 500. Text reflows.

Which tabs stay loaded, which ones sleep, and when, are decisions for your program. The library only reports the facts.

## Navigation and history

* `navigate(w, url)`, `back(w)`, `forward(w)`, `reload(w)` and `stopLoading(w)` drive the shown tab. `back` and `forward` at the end of the history do nothing.
* `canBack(w)` and `canForward(w)` say whether there is anywhere to go, for greying out arrows. Read them after a `__nav` or a tab switch.
* `setUserAgent(w, ua)` replaces the User-Agent the content views send. The engine's default names your app, and some sign-in pages refuse "embedded" browsers because of it. `""` restores the default. `setUserAgentRule(w, host, ua)` sets a different string for one host and its subdomains.
* `setBackspaceNavigation(w, false)` turns off the engine's "Backspace goes back" shortcut.

## Find in page

```nio
webview.find(w, 0, "nio", webview.FIND_WRAP, 1000);
```

`find(w, tab, text, flags, maxCount)` runs the engine's own search: the same one the system browser uses. It highlights every match and scrolls to the current one. Calling it again with the same text moves to the next match, so one call serves both typing and a "next" button. `clearFind(w, tab)` removes the highlights.

Add the flags with `+`: `FIND_BACKWARDS`, `FIND_CASE_SENSITIVE`, `FIND_WRAP`. With no flags the search goes forward, ignores case, and stops at the end.

The answer arrives on `__find` as `"tab,count,index"`. The index starts at 0 and is `-1` when there is no match. A count of `-1` means the page holds more than `maxCount` matches: the match is still shown, only the total is not counted.

## Window appearance

* `setTitle(w, title)` sets the window's title.
* `setMinSize(w, width, height)` sets the smallest size the user can resize to.
* `setAppearance(w, mode)` forces `"light"` or `"dark"`, or follows `"system"`. Pages see it through `prefers-color-scheme`.
* `setDevTools(w, true)` enables the engine's inspector on the content views and adds "Inspect Element" to their context menu.
* `printPage(w)` opens the print dialog for the shown page.
* `emojiPicker(w)` opens the system's character palette, which types into the focused text field.

**The UI page can be the title bar.** `setInlineTitlebar(w)` makes the title bar transparent and extends the UI page under it, the unified look of Safari. The page must then do three things itself, because a web view takes the mouse:

* Leave room for the window buttons. `titlebarMetrics(w)` answers where the system drew them: `buttonsRight` (the right edge of the last button) and `centerY`, in the page's CSS pixels.
* Send a message on `mousedown` in its draggable area, answered with `startDrag(w)`.
* Send a message on a double-click on its bar's background, answered with `zoom(w)`.

## Menus

**The main menu.** `setAppMenu(w)` installs a standard menu bar: Settings (Cmd+,), Reload (Cmd+R), a View menu with the three zoom items, Quit, an empty File menu, and an Edit menu that makes Cmd+C, Cmd+V and friends work in text fields. The items that need your program report on `__menu` as `"0,settings"`, `"0,reload"`, `"0,zoomin"`, `"0,zoomout"` and `"0,zoomreset"`, on the window that has the keyboard. Register the handler on every window.

`addAppMenuItem(w, menu, id, title, key)` adds your own item to a menu (creating the menu if needed) and reports it as `"0,<id>"`. `key` is the Cmd shortcut: `"n"` is Cmd+N, a capital letter adds Shift, and `""` means no shortcut. `addAppMenuSeparator(w, menu, id)` adds a line. Adding the same id again changes the title and does not add a second item. Call both after `setAppMenu`.

**The content view's context menu.** `addContextMenuItem(w, id, title)` adds an item after the engine's own, reported on `__ctx` as `"tab,id"`. The engine's own items are named by WebKit identifiers such as `"WKMenuItemIdentifierOpenLinkInNewWindow"`:

* `retitleContextMenuItem(w, id, title)` renames one.
* `hideContextMenuItem(w, id)` removes one.
* `captureContextMenuItem(w, id)` keeps it in the menu, but a pick reports on `__ctx` instead of running the engine's action. Use it for items that would leave your program, such as "Search with Google" (`"WKMenuItemIdentifierSearchWeb"`), which opens the default browser.

**The Dock menu.** `addDockMenuItem(id, title)`, `addDockMenuSeparator(id)` and `removeDockMenuItem(id)` manage entries in the Dock icon's right-click menu. They belong to the app, not a window; picks arrive as [app events](#several-windows-and-app-events).

## Several windows and app events

`run` serves one window. A program whose windows come and go runs a loop of its own around `pump(ms)`, which runs the shared event loop tied to no window: block there once, then check each window with a zero budget.

The application also has its own event queue, read with `takeAppEvent()`, which answers `""` when it is empty:

| Event | Meaning |
|---|---|
| `dock:<id>` | A Dock menu item was picked. |
| `menu:<id>` | A main-menu item was picked while no window was open. (With a window open, the pick arrives on that window's `__menu`.) |
| `reopen` | The user clicked the Dock icon. The library does not act on it: answer with `focusWindow(w)`, or open a window if none is open. `lastActiveWindow()` answers the `handle` of the window the user was in last. |
| `open:<url>` | Another application handed this one a URL or a document. The program decides which window takes it. |

```nio
import './webview/webview';
import 'process';
import 'array';

webview.Window[] windows = [];

webview.Window openWindow() {
    webview.Window w = webview.create("Notes", 700, 500);
    webview.setAppMenu(w);
    webview.addAppMenuItem(w, "File", "new", "New Window", "n");
    webview.onMessage(w, "__menu", void (String body) -> {
        if (body == "0,new") {
            openWindow();
        }
    });
    webview.loadHtml(w, "<h1>A window</h1>");
    array.push(windows, w);
    return w;
}

openWindow() catch e {
    print(e.message);
    process.exit(1);
};
webview.addDockMenuItem("new", "New Window") catch e { };

while (true) {
    webview.pump(1000) catch e { };

    webview.Window[] stillOpen = [];
    forEach(windows, w) {
        if (webview.poll(w, 0)) {
            array.push(stillOpen, w);
        }
    }
    windows = stillOpen;

    String ev = webview.takeAppEvent();
    while (ev != "") {
        if (ev == "dock:new" || ev == "menu:new") {
            openWindow() catch e { print(e.message); };
        } else if (ev == "reopen") {
            if (windows.length == 0) {
                openWindow() catch e { print(e.message); };
            } else {
                webview.focusWindow(windows[0]) catch e { };
            }
        }
        ev = webview.takeAppEvent();
    }
}
```

Becoming the handler for a URL scheme or a document type is set in the app bundle (`CFBundleURLTypes`, `CFBundleDocumentTypes`), not through the API. A URL that arrives while the program is still starting waits in the queue, so nothing is lost.

## Permissions

When a page asks for the camera, the microphone, motion sensors or the screen, the engine waits for your program to decide. The request arrives on `__perm` with a JSON body:

```json
{ "req": 12, "origin": "https://meet.example", "kind": "camera+microphone" }
```

`kind` is one of `"camera"`, `"microphone"`, `"camera+microphone"`, `"motion"`, `"screen"` or `"geolocation"`. The origin comes from the engine, so a page cannot fake it. Answer with `permReply(w, req, answer)`:

* `"grant"` or `"deny"` decides.
* `"prompt"` hands the decision to the engine's own popup. Your program never learns what the user chose.

Every request must be answered, or the page's call waits forever. The engine asks again on every page load, so remembering a decision per site is your program's job: a remembered answer is just a `permReply` sent without asking the user.

* **Screen sharing** (`"screen"`, macOS 13+): a grant does not share anything by itself. It lets the page open the system's picker, where the user chooses what to share.
* **Geolocation** has no engine hook on macOS, so the library provides its own. Turn it on with `setGeolocation(w, true)`, once, right after `create`. For this kind, `"prompt"` means deny, since there is no engine popup.

> [!NOTE]
>
> A packaged app must declare what it uses in its Info.plist (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSLocationWhenInUseUsageDescription`), or the engine hides the feature from every page. macOS also asks the user once, in its own dialog, the first time. Add the keys with `macos.plistExtra` in the [packaging manifest](/docs/packaging).

## Downloads

The engine decides when a load is a download: a `download` attribute on a link, a `Content-Disposition: attachment` header, a response it cannot show, or its own "Download Image" menu item. The library saves the file into the Downloads folder under the name the server suggested, adding ` (2)` and so on when that name is taken.

* `setDownloadDir(w, dir)` changes the folder; `""` restores the default. `downloadDir(w)` answers the one in use.
* `downloads(w)` answers every download the window has seen, as `Download` records with `state`, `file`, `path`, `url`, `received`, `total` and `error`. The byte counts are read at the moment of the call, so poll it to draw progress.
* `__download` wakes the program at the moments that matter: started, name decided, finished, failed, cancelled.
* `cancelDownload(w, id)` stops one. What already reached the disk stays.
* `openPath(p)` opens a file as a double-click would. `revealPath(p)` shows it selected in its folder.

A download continues when its tab is closed. Needs macOS 11.3.

## Profiles and private windows

* `setProfile(w, name)` decides which storage (cookies, logins, site data) the tabs created **after** the call use. Each name is a separate, persistent store; `""` is the default one. A tab keeps the store it was created with, so switching profiles means creating new tabs and closing the old ones. Needs macOS 14.
* `deleteProfile(w, name)` asks the engine to delete a profile's storage. Close every tab that uses it first. Needs macOS 14.
* `setIncognito(w)` moves the window to a store that lives in memory and ends with the window: nothing reaches the disk. As with profiles, only tabs created after the call use it. There is no way back on the same window.

## Web extensions

A window can host Safari web extensions (macOS 15.4+), using the same engine Safari uses. `extLoad(w, path)` takes an unpacked folder, a `.zip` of one, an `.appex`, or an app that contains one, and answers an extension id. Content scripts, background pages and service workers, `storage`, `declarativeNetRequest` and popups work. Extensions run in the content views only, never in the UI layer.

* `extensions(w)` lists what is loaded, as `Extension` records (`id`, `name`, `version`, `url`). `extUnload(w, id)` stops one and keeps its storage.
* `installedExtensions()` finds apps in `/Applications` and `~/Applications` that carry a Safari extension, which is how a user installs one from the App Store. `pickPath()` opens a file panel so the user can choose one.
* `extLoad` grants every permission the manifest asks for. `extSetPermission(w, id, perm, granted)` narrows that afterwards.

The extension's events arrive on reserved channels:

| Channel | What to do |
|---|---|
| `__extloaded` | The extension is running. |
| `__extaction` | Redraw its toolbar button. `extIcon(w, id, size)` answers the image as a `data:` URI. |
| `__extperm` | It asks for a permission at run time. Answer with `extReply(w, req, "grant")` or `"deny"`. |
| `__extpopup` | Its popup is on screen. Your UI reports clicks on its toolbar button with `extActionClick(w, id, x, y, width, height)`, and the popup opens anchored to that rectangle. `extPopupClose(w)` dismisses it. |
| `__extnewtab` | It wants a tab. Make one, reply with its id (or `""` to refuse) through `extReply`, and navigate it. When the URL is under the extension's own `url`, make the tab with `extNewTab(w, id)`: only such a tab can load the extension's own pages. |

Native messaging (an extension talking to a companion desktop app) is not supported, and fails with a clear error.

## Packaging an app

[`nio package`](/docs/packaging) turns a webview program into a signed `.app`. Files listed under `resources` in the manifest are copied into the bundle's `Contents/Resources`. `resourcesPath()` answers that directory when the program runs from a bundle, and `""` when it runs bare, so one function serves both a packaged app and a development run:

```nio
import './webview/webview';
import 'fs';
import 'path';
import 'string';

String readAsset(String name) {
    String dir = webview.resourcesPath();
    if (dir == "") {
        dir = "assets";                  // a development run
    }
    return string.fromByteArray(fs.readFile(path.join(dir, name)));
}

void main() {
    webview.Window w = webview.create("App", 900, 600) catch e {
        print(e.message);
        return;
    };
    String ui = readAsset("ui.html") catch e {
        print(e.message);
        return;
    };
    webview.setUi(w, ui) catch e { return; };
    webview.run(w);
}

main();
```

## Errors

The library raises its own error codes, in the 400 block so they never equal a standard-library code:

| Code | Meaning |
|---|---|
| `webview.ErrorCode.UNSUPPORTED` (400) | The platform cannot do this: every call on Windows and Linux today, or an engine feature the running macOS lacks. |
| `webview.ErrorCode.INVALID` (401) | The call was refused: a closed window, an unknown tab or id, a second reply to one request. |
| `webview.ErrorCode.FULL` (402) | Too many windows (64), tabs in a window (128), or extensions. |

A `Window` is a handle. After `close(w)` every call on it raises `INVALID`, except `step` and `poll`, which answer `false`.

## Reference

Every function is reached as `webview.<name>`. A `!` after the return type marks a call that can raise, which you handle with `catch`.

### Windows and the loop

| Function | |
|---|---|
| `Window! create(String title, int width, int height)` | Opens a window with the given content size. |
| `void close(Window w)` | Closes the window. |
| `void run(Window w)` | Polls and dispatches until the window closes. |
| `bool poll(Window w, int timeoutMs)` | `step`, then `dispatch`. `false` once closed. |
| `bool step(Window w, int timeoutMs)` | Runs the event loop for up to `timeoutMs`. `false` once closed. |
| `void dispatch(Window w)` | Hands both queues to the registered handlers. |
| `void! pump(int timeoutMs)` | Runs the shared event loop, tied to no window. |
| `String takeAppEvent()` | The next app event, or `""`. |
| `void! focusWindow(Window w)` | Brings a window to the front and makes it key. |
| `int lastActiveWindow()` | The `handle` of the window used last, or `0`. |
| `String resourcesPath()` | The bundle's `Contents/Resources`, or `""` outside a bundle. |

### Content and messages

| Function | |
|---|---|
| `void! navigate(Window w, String url)` | Loads a URL in the shown tab. |
| `void! loadHtml(Window w, String html)` | Shows a page given as text. |
| `void! evalJs(Window w, String js)` | Runs JavaScript in the shown page. |
| `int! evalJsResult(Window w, int tab, String js)` | Runs JavaScript and answers an id; the value arrives on `__evalresult`. |
| `void! setPageBridge(Window w, bool on)` | Gives the content views `window.nio`. Off by default. |
| `void onPageMessage(Window w, String channel, Function(String)<void!> handler)` | Handles one content-page channel. |
| `String? takeMessage(Window w)` | The oldest content-page message, or `null`. |

### UI layer

| Function | |
|---|---|
| `void! setUi(Window w, String html)` | Adds the UI layer. |
| `void! uiEval(Window w, String js)` | Runs JavaScript in the UI page. |
| `void onMessage(Window w, String channel, Function(String)<void!> handler)` | Handles one UI-page channel (and the reserved channels). |
| `String? takeUiMessage(Window w)` | The oldest UI-page message, or `null`. |
| `void! setContentInsets(Window w, int top, int left, int bottom, int right)` | Places the content view inside the window. |
| `void! setUiFront(Window w, bool front)` | Raises the UI above the content, or lowers it again. |
| `void! focusUi(Window w)` | Gives the keyboard to the UI page. |
| `bool! uiFocused(Window w)` | Whether the UI page has the keyboard. |

### Tabs and history

| Function | |
|---|---|
| `int! newTab(Window w)` | Creates a hidden tab and answers its id. |
| `void! showTab(Window w, int tab)` | Puts a tab on screen. |
| `void! closeTab(Window w, int tab)` | Destroys a hidden tab. |
| `void! focusTab(Window w)` | Gives the keyboard to the shown tab. |
| `void! back(Window w)`, `forward`, `reload`, `stopLoading` | Drive the shown tab. |
| `bool! canBack(Window w)`, `canForward` | Whether the history has anywhere to go. |
| `String tabState(Window w, int tab)` | An opaque snapshot of the tab's session, or `""`. |
| `void! tabRestore(Window w, int tab, String state)` | Restores a snapshot into a tab that has not navigated yet. |
| `void! tabZoom(Window w, int tab, int percent)` | Page zoom, 25 to 500. |
| `bool! tabAudible(Window w, int tab)` | Whether the tab makes sound now. |
| `String! tabMediaState(Window w, int tab)` | `"none"`, `"playing"`, `"paused"` or `"suspended"`. |
| `String! tabCaptureState(Window w, int tab)` | `"none"`, `"camera"`, `"microphone"` or `"both"`. |
| `void! setUserAgent(Window w, String ua)` | Replaces the content views' User-Agent. |
| `void! setUserAgentRule(Window w, String host, String ua)` | A different User-Agent for one host. |
| `void! setBackspaceNavigation(Window w, bool on)` | Whether Backspace goes back. |
| `void! find(Window w, int tab, String text, int flags, int maxCount)` | Searches a page; the answer arrives on `__find`. |
| `void! clearFind(Window w, int tab)` | Removes the find highlights. |
| `FIND_BACKWARDS`, `FIND_CASE_SENSITIVE`, `FIND_WRAP` | Flags for `find`, added with `+`. |

### Window, menus and system

| Function | |
|---|---|
| `void! setTitle(Window w, String title)` | Sets the window title. |
| `void! setMinSize(Window w, int width, int height)` | The smallest size the user can resize to. |
| `void! setAppearance(Window w, String mode)` | `"system"`, `"light"` or `"dark"`. |
| `void! setInlineTitlebar(Window w)` | Merges the title bar into the UI page. |
| `TitlebarMetrics! titlebarMetrics(Window w)` | Where the window buttons are. |
| `void! startDrag(Window w)` | Starts a window drag from a mousedown. |
| `void! zoom(Window w)` | Toggles the zoomed state. |
| `void! setAppMenu(Window w)` | Installs the standard menu bar. |
| `void! addAppMenuItem(Window w, String menu, String id, String title, String key)` | Adds a menu item. |
| `void! addAppMenuSeparator(Window w, String menu, String id)` | Adds a menu separator. |
| `void! addContextMenuItem(Window w, String id, String title)` | Adds a context-menu item. |
| `void! retitleContextMenuItem(Window w, String id, String title)` | Renames an engine item. |
| `void! hideContextMenuItem(Window w, String id)` | Removes an engine item. |
| `void! captureContextMenuItem(Window w, String id)` | Reports an engine item's pick instead of running it. |
| `void! addDockMenuItem(String id, String title)` | Adds a Dock menu entry. |
| `void! addDockMenuSeparator(String id)` | Adds a Dock menu separator. |
| `void! removeDockMenuItem(String id)` | Removes a Dock menu entry. |
| `void! setDevTools(Window w, bool on)` | Enables the web inspector. |
| `void! printPage(Window w)` | Opens the print dialog. |
| `void! emojiPicker(Window w)` | Opens the character palette. |
| `void! openPath(String p)` | Opens a file or folder. |
| `void! revealPath(String p)` | Shows a file in its folder. |
| `String pickPath()` | A file panel; the chosen path, or `""`. |

### Permissions, downloads and profiles

| Function | |
|---|---|
| `void! permReply(Window w, int reqId, String answer)` | Answers a `__perm` request. |
| `void! setGeolocation(Window w, bool on)` | Gives pages a working `navigator.geolocation`. |
| `void! setDownloadDir(Window w, String dir)` | Where downloads go. |
| `String downloadDir(Window w)` | The download folder in use. |
| `Download[] downloads(Window w)` | Every download the window has seen. |
| `void! cancelDownload(Window w, int id)` | Stops a download. |
| `void! setProfile(Window w, String name)` | The storage new tabs use. |
| `void! deleteProfile(Window w, String name)` | Deletes a profile's storage. |
| `void! setIncognito(Window w)` | Moves the window to in-memory storage. |

### Extensions

| Function | |
|---|---|
| `int! extLoad(Window w, String path)` | Loads an extension. |
| `void! extUnload(Window w, int ext)` | Stops an extension. |
| `Extension[] extensions(Window w)` | The loaded extensions. |
| `void! extSetPermission(Window w, int ext, String perm, bool granted)` | Grants or revokes one permission. |
| `void! extActionClick(Window w, int ext, int x, int y, int width, int height)` | Reports a toolbar-button click. |
| `void! extPopupClose(Window w)` | Dismisses the popup. |
| `String extIcon(Window w, int ext, int size)` | The toolbar icon as a `data:` URI. |
| `int! extNewTab(Window w, int ext)` | A tab that can show the extension's own pages. |
| `void! extReply(Window w, int reqId, String answer)` | Answers `__extperm` or `__extnewtab`. |
| `InstalledExt[] installedExtensions()` | Extensions installed on this machine. |

### Types

```nio
type Window {
    int handle;
    Map<String, Function(String)<void!>> uiHandlers;
    Map<String, Function(String)<void!>> pageHandlers;
}

type TitlebarMetrics {
    int buttonsRight;
    int centerY;
}

type Download {
    int id;
    String state;
    String file;
    String path;
    String url;
    int received;
    int total;
    String error;
}

type Extension {
    int id;
    String name;
    String version;
    String url;
}

type InstalledExt {
    String path;
    String name;
}

enum ErrorCode {
    UNSUPPORTED: 400,
    INVALID: 401,
    FULL: 402,
}
```
