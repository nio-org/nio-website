---
title: "webview library: desktop apps"
description: "Build desktop apps with Nio: the webview library opens a native window with web content, and a bridge connects the page to the program."
---

# Webview

## Introduction

```nio
import './webview/webview';
```

The `webview` library opens a native window that shows web content with the platform's engine. The interface is HTML, CSS and JavaScript, and the program behind it is Nio. The page and the program exchange messages through a two-way bridge.

The engine is part of the operating system (WKWebView on macOS). The library adds no rendering code. A program that uses it is a few hundred kilobytes. The system engine does the rendering, JavaScript, networking and TLS in the window.

> [!NOTE]
>
> **macOS only.** The macOS implementation is complete. Windows (WebView2) and Linux (WebKitGTK) have stub implementations, and `webview.create` raises `ErrorCode.UNSUPPORTED` on those platforms.

A complete app needs only one window, one page and the bridge. The sections below start with that and add features one at a time. The [reference](#reference) at the end lists every function.

## Getting the library

`webview` is an [external library](/docs/libraries). It is part of the Nio repository, but it is not in the standard library. It is in [`libraries/webview/`](https://github.com/nio-org/nio/tree/main/libraries/webview) and has two files:

* `webview.nio`, the Nio API.
* `native/webview_native.m`, the Objective-C implementation that calls Cocoa and WebKit.

A project uses a copy of the `webview` folder and imports it by path. There is no build step. The import adds the native file and the frameworks it needs, and `clang` compiles them with the program, as [native interop](/docs/native) describes.

```text
my-app/
  app.nio          import './webview/webview';
  webview/
    webview.nio
    native/webview_native.m
```

The default alias is the file's stem. Every name on this page is reached as `webview.<name>`.

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

Each click prints `the page says: the button was clicked`. The page then shows the click count that the program sends back.

* `create(title, width, height)` opens the window. The size is the content size, in CSS pixels.
* `loadHtml(w, html)` shows a page given as text. `navigate(w, url)` loads an `https://`, `http://` or `file://` URL instead.
* `setPageBridge(w, true)` gives the page `window.nio`. It is off by default. [The bridge](#the-bridge) gives the reason.
* `onPageMessage(w, channel, handler)` registers the function that receives the messages of one channel.
* `run(w)` is the main loop. It returns when the user closes the window.

Most calls can fail. The example uses `catch` for them. A handler has the type `Function(String)<void!>`. A handler can also raise an error. When a handler raises an error, `run` prints the error and continues.

## The bridge

A page sends a message to the program with one of two JavaScript calls:

```js
window.nio.send('save', JSON.stringify(doc));   // channel "save"
window.nio.postMessage('ping');                  // channel "message"
```

Each call sends one string. `send` names a channel, and `postMessage` always uses the channel `"message"`. The program registers one handler per channel. A second registration on a channel replaces the handler. The library discards a message on a channel that has no handler.

The program sends to the page with JavaScript:

* `evalJs(w, js)` runs a script in the shown page and returns nothing. To send a value back, the page calls `window.nio.send`.
* `evalJsResult(w, tab, js)` runs a script and immediately returns an id. The script's value must be a string. The value arrives later on the reserved [`__evalresult`](#reserved-channels) channel as `"<id>,ok,<value>"` or `"<id>,err,<reason>"`. This call reads a page when the bridge is off.

`json.toText` converts a Nio string for use in a script. The result is a valid JavaScript string literal:

```nio
webview.evalJs(w, `showName(${json.toText(name)})`);
```

> [!WARNING]
>
> **Do not turn on the page bridge for pages that the program does not control.** With `setPageBridge(w, true)`, every page that the window shows can send messages to the program. This includes every frame in the page, third-party frames too. Turn on the bridge only when the page is the app itself, as in the first example. For a program that loads arbitrary sites, keep the bridge off. That program draws its own controls in the [UI layer](#two-layers-ui-and-content), which always has the bridge, and reads pages with `evalJsResult`. Call `setPageBridge` once, immediately after `create`.

Data from a content page is input from outside the program. It needs the same validation as data from a network.

## The event loop

The native side does not call the handlers directly. It puts each message in a queue. Between turns of the platform's event loop, the library passes the queued messages to the handlers. There are three levels, and each level uses the level below it:

| Call | What it does |
|---|---|
| `run(w)` | Loops until the window closes. |
| `poll(w, ms)` | One turn: `step`, then `dispatch`. Returns `false` after the window closes. |
| `step(w, ms)` | Runs the platform's event loop for up to `ms` milliseconds. Returns `false` after the window closes. |

`dispatch(w)` passes the waiting messages to the handlers. `takeMessage(w)` and `takeUiMessage(w)` take messages one at a time instead, and return `null` when the queue is empty. A program that has no handlers uses them:

```nio
while (webview.step(w, 1000)) {
    String? msg = webview.takeMessage(w);
    while (msg != null) {
        print(msg);
        msg = webview.takeMessage(w);
    }
}
```

The timeout does not add latency. A queued message ends a `step` immediately. The timeout only sets how frequently an idle program runs its loop. When `step` returns `false`, the user closed the window. This is a normal event, not an error.

## Two layers: UI and content

A window can hold two web views, one on top of the other:

* **The content view** shows a document: the app's page, or a website.
* **The UI layer** (`setUi(w, html)`) is a second page below the content view that fills the window. It draws all parts of the interface (toolbar, sidebar, status bar) as one HTML document. It leaves an empty area, the hole, where the content goes.

The UI page measures the hole and sends its four distances from the window's edges. The program then puts the content view there with `setContentInsets`. The insets stay in effect when the window is resized. As a result, the UI page must send the message only when its layout changes, not when the user resizes the window.

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

This program is a small working browser. Each call operates on one of the two layers:

* `onMessage` registers handlers for the **UI page**. `onPageMessage` registers them for the **content page**. The two pages have separate queues.
* `uiEval` runs JavaScript in the UI page, and `evalJs` runs it in the content page.
* In this example the content page has no bridge. No website can send `go` and control the window.

> [!IMPORTANT]
>
> **Accept commands only from the UI layer.** The UI page is part of the program. A content page contains data from the network. The two queues are separate. As a result, a site cannot reach a handler that is registered with `onMessage`.

These calls also operate on the layers:

* `setUiFront(w, true)` temporarily puts the UI above the content. This lets a menu or popover drawn by the UI show over the page. The UI view is transparent where its page draws nothing. While the UI is in front, it receives all mouse events. This lets a popover close on the first click outside it. `setUiFront(w, false)` puts the UI below the content again when the popover closes.
* `focusUi(w)` gives the keyboard to the UI page, and `focusTab(w)` gives it to the shown content page. A DOM `focus()` in the UI page does not move the keyboard while the content view has it. `uiFocused(w)` returns whether the UI page has the keyboard.

A window that does not call `setUi` has only a content view, which fills the window.

## Reserved channels

The library reports engine activity on channels whose names begin with `__`. These messages arrive on the UI queue. Their handlers are registered with `onMessage`. Only the native side adds messages to that queue, and page script cannot reach it. As a result, their data comes from the engine, not from a page. If a page sends a message on a `__` channel, that message goes to the content queue and is untrusted, as all content-page messages are.

Most bodies begin with the tab id, then a comma.

| Channel | Body | When |
|---|---|---|
| `__nav` | `tab,url` | A tab committed a new document: a link click, a `navigate` call, or a reload (with the same URL). |
| `__navinpage` | `tab,url` | The URL changed without a new document: `history.pushState` or a `#fragment` jump. Same origin only. |
| `__http` | `tab,status` | The HTTP status of the document that is about to show. Sent immediately before its `__nav`, main frame only. |
| `__title` | `tab,title` | The page's title, including changes that the page makes to it later. |
| `__load` | `tab,1` or `tab,0` | The tab started or stopped loading. For example, a UI can change a reload button into a stop button when it arrives. |
| `__favicon` | `tab,url` | The icon location that the page declares. The page supplies this value. A program checks the scheme before it loads the icon. |
| `__newtab` | `tab,url` | A page requested a window (`window.open`, `target="_blank"`), and the engine created a tab for it. [Tabs](#tabs) gives the details. |
| `__newtabbg` | `tab,url` | The same as `__newtab`, from a gesture that opens a link behind the current page: a middle-click or Cmd-click on a link. |
| `__closed` | `tab,` | A page called `window.close()`. The tab stays until the program calls `closeTab`. |
| `__evalresult` | `id,ok,value` or `id,err,reason` | The result of an `evalJsResult`. The value came from the page. It is untrusted. |
| `__find` | `tab,count,index` | The result of a `find`. [Find in page](#find-in-page) gives the details. |
| `__menu` | `0,id` | A main-menu item was picked. [Menus](#menus) gives the details. |
| `__ctx` | `tab,id` | A context-menu item was picked. |
| `__download` | `id,json` | A download started, got its file name, finished, failed or was cancelled. |
| `__perm` | `tab,json` | A page requested a permission. [Permissions](#permissions) gives the details. |
| `__extloaded`, `__extaction`, `__extperm`, `__extpopup`, `__extnewtab` | `ext,json` | Web extension events. [Web extensions](#web-extensions) gives the details. |

## Tabs

A window can hold several content views, and it shows one at a time. The window opens with tab `1`.

* `newTab(w)` creates a hidden tab and returns its id.
* `showTab(w, id)` shows a tab on screen. All calls that act on "the page" (`navigate`, `evalJs`, `back`, the insets, and the other calls) act on the shown tab. A program that does not use tabs can ignore them.
* `closeTab(w, id)` destroys a hidden tab and releases the engine resources for it. The library refuses to close the shown tab. Another tab must be shown first.
* `focusTab(w)` gives the keyboard to the shown tab. `showTab` does not move the keyboard. As a result, on a new blank tab, the keyboard can stay in the program's own address bar.

`evalJsResult`, `find` and `clearFind` report later, on a channel. For this reason, they take a tab id. A tab id of `0` means the shown tab.

**A request for a window opens a tab.** When a page calls `window.open` or the user follows a `target="_blank"` link, the engine immediately creates a tab and starts to load the URL in it. The program's `__newtab` handler adopts the tab, usually with `showTab`. The handler must not navigate the tab again. A middle-click, a Cmd-click, or the engine's "Open Link in New Window" item arrives on `__newtabbg` instead. By convention, that tab opens behind the current page. A program also handles `__closed`. Sign-in popups open a window, send their result to the opener, and close themselves. If a program ignores `__closed`, an empty tab stays open.

**A tab can keep its state when the program unloads it.** `tabState(w, id)` returns an opaque snapshot of a tab's history, scroll positions and form contents. `tabRestore(w, id, state)` applies the snapshot to a new tab in place of its first navigation. The page then returns to where it was. This is best-effort. If the snapshot is empty, or the engine no longer recognizes it, the program navigates to the URL instead. Needs macOS 12.

**Tab status:**

* `tabAudible(w, id)` returns whether the tab makes sound now.
* `tabMediaState(w, id)` returns `"none"`, `"playing"`, `"paused"` or `"suspended"`. Muted autoplay counts as `"playing"`. `tabAudible` is the check for sound.
* `tabCaptureState(w, id)` returns whether the tab uses the camera or microphone: `"none"`, `"camera"`, `"microphone"` or `"both"`.
* `tabZoom(w, id, percent)` sets the page zoom, from 25 to 500. Text reflows.

The program decides which tabs stay loaded, which tabs sleep, and when. The library only reports the tab status.

## Navigation and history

* `navigate(w, url)`, `back(w)`, `forward(w)`, `reload(w)` and `stopLoading(w)` control the shown tab. At the end of the history, `back` and `forward` do nothing.
* `canBack(w)` and `canForward(w)` return whether the history has a previous or next page. A UI uses them to enable or disable the arrow buttons. Their values change after a `__nav` or a tab switch.
* `setUserAgent(w, ua)` replaces the User-Agent that the content views send. The engine's default User-Agent contains the app's name. Some sign-in pages refuse "embedded" browsers because of this. `""` restores the default. `setUserAgentRule(w, host, ua)` sets a different string for one host and its subdomains.
* `setBackspaceNavigation(w, false)` turns off the engine's shortcut that goes back when the user presses Backspace.

## Find in page

```nio
webview.find(w, 0, "nio", webview.FIND_WRAP, 1000);
```

`find(w, tab, text, flags, maxCount)` uses the engine's search, which is the same search that the system browser uses. It highlights all matches and scrolls to the current match. A second call with the same text moves to the next match. As a result, the same call works when the user types and when the user clicks a "next" button. `clearFind(w, tab)` removes the highlights.

The flags are added with `+`: `FIND_BACKWARDS`, `FIND_CASE_SENSITIVE`, `FIND_WRAP`. With no flags, the search goes forward, ignores case, and stops at the end.

The result arrives on `__find` as `"tab,count,index"`. The index starts at 0 and is `-1` when there is no match. A count of `-1` means that the page has more than `maxCount` matches. The current match is still shown, but the total is not counted.

## Window appearance

* `setTitle(w, title)` sets the window's title.
* `setMinSize(w, width, height)` sets the smallest size that the user can resize to.
* `setAppearance(w, mode)` sets `"light"` or `"dark"`, or follows `"system"`. Pages see it through `prefers-color-scheme`.
* `setDevTools(w, true)` enables the engine's inspector on the content views and adds "Inspect Element" to their context menu.
* `printPage(w)` opens the print dialog for the shown page.
* `emojiPicker(w)` opens the system's character palette, which inserts characters into the focused text field.

**The UI page can extend into the title bar.** `setInlineTitlebar(w)` makes the title bar transparent and extends the UI page below it. A web view receives the mouse events. As a result, the page must then do these three things:

* It leaves space for the window buttons. `titlebarMetrics(w)` returns where the system drew them: `buttonsRight` (the right edge of the last button) and `centerY`, in the page's CSS pixels.
* It sends a message on `mousedown` in its draggable area. The program replies with `startDrag(w)`.
* It sends a message on a double-click on the background of its bar. The program replies with `zoom(w)`.

## Menus

**The main menu.** `setAppMenu(w)` installs a standard menu bar. It contains Settings (Cmd+,), Reload (Cmd+R), a View menu with the three zoom items, Quit, an empty File menu, and an Edit menu. The Edit menu makes Cmd+C, Cmd+V and the other editing shortcuts work in text fields. The items that the program must handle are reported on `__menu` as `"0,settings"`, `"0,reload"`, `"0,zoomin"`, `"0,zoomout"` and `"0,zoomreset"`. They are reported on the window that has the keyboard. For this reason, the handler must be registered on every window.

`addAppMenuItem(w, menu, id, title, key)` adds the program's own item to a menu and reports it as `"0,<id>"`. If the menu does not exist, the call creates it. `key` is the Cmd shortcut: `"n"` is Cmd+N, a capital letter adds Shift, and `""` means no shortcut. `addAppMenuSeparator(w, menu, id)` adds a separator line. For an id that already exists, the call changes the title and does not add a second item. Both functions must come after `setAppMenu`.

**The content view's context menu.** `addContextMenuItem(w, id, title)` adds an item after the engine's items. A pick is reported on `__ctx` as `"tab,id"`. The engine's items have WebKit identifiers, such as `"WKMenuItemIdentifierOpenLinkInNewWindow"`:

* `retitleContextMenuItem(w, id, title)` renames an engine item.
* `hideContextMenuItem(w, id)` removes an engine item.
* `captureContextMenuItem(w, id)` keeps an engine item in the menu, but a pick is reported on `__ctx` and the engine does not run its action. It is for items that leave the program, such as "Search with Google" (`"WKMenuItemIdentifierSearchWeb"`), which opens the default browser.

**The Dock menu.** `addDockMenuItem(id, title)`, `addDockMenuSeparator(id)` and `removeDockMenuItem(id)` manage entries in the right-click menu of the Dock icon. They apply to the app, not to a window. Picks arrive as [app events](#several-windows-and-app-events).

## Several windows and app events

`run` operates on one window. A program that opens and closes windows runs its own loop around `pump(ms)`. `pump` runs the shared event loop and is not tied to a window. Each iteration calls `pump` once with a timeout. Then it calls `poll` on each window with a timeout of `0`.

The application also has its own event queue. `takeAppEvent()` reads it and returns `""` when the queue is empty:

| Event | Meaning |
|---|---|
| `dock:<id>` | A Dock menu item was picked. |
| `menu:<id>` | A main-menu item was picked while no window was open. When a window is open, the pick arrives on the `__menu` channel of that window. |
| `reopen` | The user clicked the Dock icon. The library does not act on it. The program calls `focusWindow(w)`, or opens a window if none is open. `lastActiveWindow()` returns the `handle` of the window that the user used last. |
| `open:<url>` | Another application sent a URL or a document to this application. The program decides which window receives it. |

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

The app bundle makes the app the handler for a URL scheme or a document type (`CFBundleURLTypes`, `CFBundleDocumentTypes`). The API cannot set it. A URL that arrives while the program starts stays in the queue. The program does not lose it.

## Permissions

When a page requests the camera, the microphone, motion sensors or the screen, the engine waits for the program to decide. The request arrives on `__perm` with a JSON body:

```json
{ "req": 12, "origin": "https://meet.example", "kind": "camera+microphone" }
```

`kind` is one of `"camera"`, `"microphone"`, `"camera+microphone"`, `"motion"`, `"screen"` or `"geolocation"`. The origin comes from the engine. A page cannot fake it. `permReply(w, req, answer)` sends the reply:

* `"grant"` allows the request, and `"deny"` refuses it.
* `"prompt"` gives the decision to the engine's popup. The program does not receive the user's choice.

Every request needs a reply. Without one, the page's call waits forever. The engine asks again on each page load. To remember a decision for a site, the program stores it and sends `permReply` with the stored answer, without asking the user.

* **Screen sharing** (`"screen"`, macOS 13+): a grant does not share anything by itself. It lets the page open the system's picker, where the user chooses what to share.
* **Geolocation**: the engine on macOS has no geolocation hook. The library supplies its own. `setGeolocation(w, true)` turns it on, once, immediately after `create`. For this kind, `"prompt"` means deny, because there is no engine popup.

> [!NOTE]
>
> A packaged app must declare the features it uses in its Info.plist (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSLocationWhenInUseUsageDescription`). If a key is missing, the engine hides the feature from all pages. macOS also asks the user in its own dialog the first time. `macos.plistExtra` in the [packaging manifest](/docs/packaging) adds the keys.

## Downloads

The engine decides when a load is a download: a `download` attribute on a link, a `Content-Disposition: attachment` header, a response that it cannot show, or its "Download Image" menu item. The library saves the file into the Downloads folder under the name that the server suggested. If that name is already in use, the library adds ` (2)` or a higher number.

* `setDownloadDir(w, dir)` changes the folder. `""` restores the default. `downloadDir(w)` returns the folder in use.
* `downloads(w)` returns every download that the window has seen, as `Download` records with `state`, `file`, `path`, `url`, `received`, `total` and `error`. The byte counts are read at the time of the call. A program that shows progress calls it repeatedly.
* `__download` reports each change of state: started, name decided, finished, failed, cancelled.
* `cancelDownload(w, id)` stops a download. The data that is already on the disk stays there.
* `openPath(p)` opens a file as a double-click does. `revealPath(p)` shows the file selected in its folder.

A download continues when its tab is closed. Needs macOS 11.3.

## Profiles and private windows

* `setProfile(w, name)` sets the storage (cookies, logins, site data) that tabs use. Only tabs created **after** the call use it. Each name is a separate, persistent store. `""` is the default store. A tab keeps the store it was created with. To switch profiles, the program creates new tabs and closes the old ones. Needs macOS 14.
* `deleteProfile(w, name)` tells the engine to delete the storage of a profile. Every tab that uses it must be closed first. Needs macOS 14.
* `setIncognito(w)` moves the window to a store in memory that ends when the window closes. No data goes to the disk. As with profiles, only tabs created after the call use it. The same window cannot move back to persistent storage.

## Web extensions

A window can host Safari web extensions (macOS 15.4+) with the engine that Safari uses. `extLoad(w, path)` takes an unpacked folder, a `.zip` of one, an `.appex`, or an app that contains one, and returns an extension id. Content scripts, background pages and service workers, `storage`, `declarativeNetRequest` and popups are supported. Extensions run only in the content views, never in the UI layer.

* `extensions(w)` lists the loaded extensions, as `Extension` records (`id`, `name`, `version`, `url`). `extUnload(w, id)` stops an extension and keeps its storage.
* `installedExtensions()` finds apps in `/Applications` and `~/Applications` that contain a Safari extension. A user installs an extension from the App Store in this form. `pickPath()` opens a file panel. In the panel, the user can choose one.
* `extLoad` grants every permission that the manifest requests. `extSetPermission(w, id, perm, granted)` narrows the permissions after that.

The extension's events arrive on reserved channels:

| Channel | What to do |
|---|---|
| `__extloaded` | The extension is running. |
| `__extaction` | The UI draws the extension's toolbar button again. `extIcon(w, id, size)` returns the image as a `data:` URI. |
| `__extperm` | The extension requests a permission at run time. The program replies with `extReply(w, req, "grant")` or `"deny"`. |
| `__extpopup` | The extension's popup is on screen. The UI reports clicks on its toolbar button with `extActionClick(w, id, x, y, width, height)`, and the popup opens anchored to that rectangle. `extPopupClose(w)` closes it. |
| `__extnewtab` | The extension requests a tab. The program creates one, replies with its id (or `""` to refuse) through `extReply`, and navigates it. If the URL is under the extension's own `url`, the program creates the tab with `extNewTab(w, id)`. Only such a tab can load the extension's own pages. |

Native messaging (communication between an extension and a companion desktop app) is not supported. It fails with an error.

## Packaging an app

[`nio package`](/docs/packaging) makes a signed `.app` from a webview program. The files listed under `resources` in the manifest are copied into the bundle's `Contents/Resources`. `resourcesPath()` returns that directory when the program runs from a bundle, and `""` when it runs outside a bundle. As a result, the same function works in a packaged app and in a development run:

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

The library raises its own error codes. They start at 400. This makes them different from all standard-library codes:

| Code | Meaning |
|---|---|
| `webview.ErrorCode.UNSUPPORTED` (400) | The platform cannot do this: every call on Windows and Linux, or an engine feature that the installed macOS version does not have. |
| `webview.ErrorCode.INVALID` (401) | The call was refused: a closed window, an unknown tab or id, a second reply to one request. |
| `webview.ErrorCode.FULL` (402) | Too many windows (64), tabs in a window (128), or extensions. |

A `Window` is a handle. After `close(w)`, every call on it raises `INVALID`, except `step` and `poll`, which return `false`.

## Reference

Every function is reached as `webview.<name>`. A `!` after the return type marks a call that can raise an error. `catch` handles the error.

### Windows and the loop

| Function | |
|---|---|
| `Window! create(String title, int width, int height)` | Opens a window with the given content size. |
| `void close(Window w)` | Closes the window. |
| `void run(Window w)` | Polls and dispatches until the window closes. |
| `bool poll(Window w, int timeoutMs)` | `step`, then `dispatch`. `false` after the window closes. |
| `bool step(Window w, int timeoutMs)` | Runs the event loop for up to `timeoutMs`. `false` after the window closes. |
| `void dispatch(Window w)` | Passes the messages in both queues to the registered handlers. |
| `void! pump(int timeoutMs)` | Runs the shared event loop, which is not tied to a window. |
| `String takeAppEvent()` | The next app event, or `""`. |
| `void! focusWindow(Window w)` | Brings a window to the front and makes it the key window. |
| `int lastActiveWindow()` | The `handle` of the window used last, or `0`. |
| `String resourcesPath()` | The bundle's `Contents/Resources`, or `""` outside a bundle. |

### Content and messages

| Function | |
|---|---|
| `void! navigate(Window w, String url)` | Loads a URL in the shown tab. |
| `void! loadHtml(Window w, String html)` | Shows a page given as text. |
| `void! evalJs(Window w, String js)` | Runs JavaScript in the shown page. |
| `int! evalJsResult(Window w, int tab, String js)` | Runs JavaScript and returns an id. The value arrives on `__evalresult`. |
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
| `void! setContentInsets(Window w, int top, int left, int bottom, int right)` | Puts the content view in the window at these distances from the edges. |
| `void! setUiFront(Window w, bool front)` | Puts the UI above the content, or below it again. |
| `void! focusUi(Window w)` | Gives the keyboard to the UI page. |
| `bool! uiFocused(Window w)` | Whether the UI page has the keyboard. |

### Tabs and history

| Function | |
|---|---|
| `int! newTab(Window w)` | Creates a hidden tab and returns its id. |
| `void! showTab(Window w, int tab)` | Shows a tab on screen. |
| `void! closeTab(Window w, int tab)` | Destroys a hidden tab. |
| `void! focusTab(Window w)` | Gives the keyboard to the shown tab. |
| `void! back(Window w)`, `forward`, `reload`, `stopLoading` | Control the shown tab. |
| `bool! canBack(Window w)`, `canForward` | Whether the history has a previous or next page. |
| `String tabState(Window w, int tab)` | An opaque snapshot of the tab's session, or `""`. |
| `void! tabRestore(Window w, int tab, String state)` | Restores a snapshot into a tab that has not navigated yet. |
| `void! tabZoom(Window w, int tab, int percent)` | Page zoom, 25 to 500. |
| `bool! tabAudible(Window w, int tab)` | Whether the tab makes sound now. |
| `String! tabMediaState(Window w, int tab)` | `"none"`, `"playing"`, `"paused"` or `"suspended"`. |
| `String! tabCaptureState(Window w, int tab)` | `"none"`, `"camera"`, `"microphone"` or `"both"`. |
| `void! setUserAgent(Window w, String ua)` | Replaces the User-Agent of the content views. |
| `void! setUserAgentRule(Window w, String host, String ua)` | A different User-Agent for one host. |
| `void! setBackspaceNavigation(Window w, bool on)` | Whether Backspace goes back. |
| `void! find(Window w, int tab, String text, int flags, int maxCount)` | Searches a page. The result arrives on `__find`. |
| `void! clearFind(Window w, int tab)` | Removes the find highlights. |
| `FIND_BACKWARDS`, `FIND_CASE_SENSITIVE`, `FIND_WRAP` | Flags for `find`, added with `+`. |

### Window, menus and system

| Function | |
|---|---|
| `void! setTitle(Window w, String title)` | Sets the window title. |
| `void! setMinSize(Window w, int width, int height)` | Sets the smallest size that the user can resize to. |
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
| `void! captureContextMenuItem(Window w, String id)` | Reports the pick of an engine item and does not run its action. |
| `void! addDockMenuItem(String id, String title)` | Adds a Dock menu entry. |
| `void! addDockMenuSeparator(String id)` | Adds a Dock menu separator. |
| `void! removeDockMenuItem(String id)` | Removes a Dock menu entry. |
| `void! setDevTools(Window w, bool on)` | Enables the web inspector. |
| `void! printPage(Window w)` | Opens the print dialog. |
| `void! emojiPicker(Window w)` | Opens the character palette. |
| `void! openPath(String p)` | Opens a file or folder. |
| `void! revealPath(String p)` | Shows a file in its folder. |
| `String pickPath()` | Opens a file panel. Returns the chosen path, or `""`. |

### Permissions, downloads and profiles

| Function | |
|---|---|
| `void! permReply(Window w, int reqId, String answer)` | Replies to a `__perm` request. |
| `void! setGeolocation(Window w, bool on)` | Gives pages a working `navigator.geolocation`. |
| `void! setDownloadDir(Window w, String dir)` | Sets the download folder. |
| `String downloadDir(Window w)` | The download folder in use. |
| `Download[] downloads(Window w)` | Every download that the window has seen. |
| `void! cancelDownload(Window w, int id)` | Stops a download. |
| `void! setProfile(Window w, String name)` | Sets the storage that new tabs use. |
| `void! deleteProfile(Window w, String name)` | Deletes the storage of a profile. |
| `void! setIncognito(Window w)` | Moves the window to in-memory storage. |

### Extensions

| Function | |
|---|---|
| `int! extLoad(Window w, String path)` | Loads an extension. |
| `void! extUnload(Window w, int ext)` | Stops an extension. |
| `Extension[] extensions(Window w)` | The loaded extensions. |
| `void! extSetPermission(Window w, int ext, String perm, bool granted)` | Grants or revokes one permission. |
| `void! extActionClick(Window w, int ext, int x, int y, int width, int height)` | Reports a click on the toolbar button. |
| `void! extPopupClose(Window w)` | Closes the popup. |
| `String extIcon(Window w, int ext, int size)` | The toolbar icon as a `data:` URI. |
| `int! extNewTab(Window w, int ext)` | A tab that can show the extension's own pages. |
| `void! extReply(Window w, int reqId, String answer)` | Replies to `__extperm` or `__extnewtab`. |
| `InstalledExt[] installedExtensions()` | Extensions installed on this computer. |

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
