// The day and night looks, background sounds, "Get the app" going to the
// visitor's store, and sections fading in as they come into view. The hero
// is the app's scene as SVG (img/hero_*.svg), animated inside itself.
(function () {
    var root = document.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Day or night: each picture with a day version shows it by day. Every
    // picture is loaded up front, so a switch never waits for one.
    function pictures() { return document.querySelectorAll('img[data-day]'); }
    function readyPictures() {
        pictures().forEach(function (img) {
            if (img.dataset.night) return;
            img.dataset.night = img.getAttribute('src');
            new Image().src = img.dataset.day;
        });
    }
    readyPictures();

    function show(look) {
        root.dataset.theme = look;
        pictures().forEach(function (img) {
            var src = look === 'day' ? img.dataset.day : img.dataset.night;
            if (img.getAttribute('src') !== src) img.setAttribute('src', src);
        });
        if (sound.playing) sound.crossfade(look);
    }

    // Background sounds: the app's own day and night ambience, quiet, off
    // until the visitor turns them on.
    var sound = (function () {
        var level = 0.25;
        var tracks = { day: new Audio('sound/ambience_day.m4a'), night: new Audio('sound/ambience_night.m4a') };
        Object.keys(tracks).forEach(function (k) {
            tracks[k].loop = true;
            tracks[k].preload = 'none';
            tracks[k].volume = 0;
        });
        var fades = {};
        function fade(track, to, ms, done) {
            cancelAnimationFrame(fades[track.src]);
            var from = track.volume, start = performance.now();
            (function step(now) {
                // A frame's time can be a touch before [start]: kept in 0..1.
                var t = Math.max(0, Math.min(1, (now - start) / ms));
                track.volume = Math.max(0, Math.min(1, from + (to - from) * t));
                if (t < 1) fades[track.src] = requestAnimationFrame(step);
                else if (done) done();
            })(start);
        }
        var api = {
            playing: false,
            start: function () {
                var t = tracks[root.dataset.theme === 'day' ? 'day' : 'night'];
                var p = t.play();
                if (p && p.catch) p.catch(function () {});
                fade(t, level, 1200);
                api.playing = true;
            },
            stop: function () {
                Object.keys(tracks).forEach(function (k) {
                    var t = tracks[k];
                    fade(t, 0, 500, function () { t.pause(); });
                });
                api.playing = false;
            },
            crossfade: function (look) {
                var on = tracks[look], off = tracks[look === 'day' ? 'night' : 'day'];
                var p = on.play();
                if (p && p.catch) p.catch(function () {});
                fade(on, level, 1500);
                fade(off, 0, 1500, function () { off.pause(); });
            },
            pauseAll: function () { Object.keys(tracks).forEach(function (k) { tracks[k].pause(); }); }
        };
        return api;
    })();

    // Off on every visit: browsers only let sound start from a tap or click,
    // so the switch never shows it on while it is silent.
    var soundButtons = document.querySelectorAll('.sound-toggle');
    soundButtons.forEach(function (button) {
        button.addEventListener('click', function (e) {
            e.stopPropagation();
            var on = !sound.playing;
            soundButtons.forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
            if (on) sound.start(); else sound.stop();
        });
    });
    // Quiet while the page is in the background.
    document.addEventListener('visibilitychange', function () {
        if (!sound.playing) return;
        if (document.hidden) sound.pauseAll();
        else sound.start();
    });

    function saved() {
        try { return localStorage.getItem('sheikhify-theme'); } catch (e) { return null; }
    }

    show(root.dataset.theme === 'day' ? 'day' : 'night');

    // The switch: the new look sweeps over the old with a soft edge (see
    // style.css); without view transitions, the scene cross-fades.
    document.querySelectorAll('.theme-toggle').forEach(function (button) {
        button.addEventListener('click', function () {
            var look = root.dataset.theme === 'day' ? 'night' : 'day';
            try { localStorage.setItem('sheikhify-theme', look); } catch (e) {}
            if (!document.startViewTransition || reduce) {
                show(look);
                return;
            }
            // Day rises from below like the sun coming up; night comes down
            // from above like dusk.
            root.dataset.going = look === 'day' ? 'up' : 'down';
            var t = document.startViewTransition(function () { show(look); });
            // A transition the browser cancels (a hidden tab) still shows
            // the new look; nothing to report.
            var done = function () { delete root.dataset.going; };
            t.ready.catch(function () {});
            t.finished.then(done, done);
        });
    });

    // Following the device's setting until the visitor picks a look.
    var light = window.matchMedia('(prefers-color-scheme: light)');
    var follow = function (e) {
        var choice = saved();
        if (choice !== 'day' && choice !== 'night') show(e.matches ? 'day' : 'night');
    };
    if (light.addEventListener) light.addEventListener('change', follow);

    // "Get the app": straight to the store on iPhone, iPad, Mac and Android,
    // to the download box anywhere else.
    var ua = navigator.userAgent || '';
    var apple = /iPhone|iPad|iPod|Macintosh/.test(ua);
    var android = /Android/.test(ua);
    document.querySelectorAll('.nav-get').forEach(function (link) {
        if (android) link.href = 'https://play.google.com/store/apps/details?id=com.sheikhify.app';
        else if (apple) link.href = 'https://apps.apple.com/app/id6760123606';
    });

    // Sections fade in as they come into view.
    var seen = !reduce && 'IntersectionObserver' in window
        ? new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('shown');
                    seen.unobserve(e.target);
                }
            });
        }, { threshold: 0.05, rootMargin: '0px 0px -5% 0px' })
        : null;
    function reveal() {
        document.querySelectorAll('.reveal:not(.shown)').forEach(function (el) {
            if (seen) seen.observe(el); else el.classList.add('shown');
        });
    }
    reveal();

    // Moving between the site's pages swaps only their content, so the
    // background sounds play on without a break (a full page load would
    // stop them, and browsers let them start again only from a tap).
    var pages = /\/(index|privacy|terms|delete-account)\.html$|\/$/;
    function inSite(url) {
        return url.origin === location.origin && pages.test(url.pathname) &&
            url.pathname.replace(/[^/]*$/, '') === location.pathname.replace(/[^/]*$/, '');
    }
    function land(url) {
        var target = url.hash && document.getElementById(url.hash.slice(1));
        // At once, as a page load would, not with the page's smooth scrolling.
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
        else window.scrollTo({ top: 0, behavior: 'instant' });
    }
    var shownPath = location.pathname;
    function go(url, push) {
        fetch(url.href).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            return r.text();
        }).then(function (html) {
            var next = new DOMParser().parseFromString(html, 'text/html');
            document.title = next.title;
            ['main', 'footer'].forEach(function (tag) {
                var now = document.querySelector(tag), then = next.querySelector(tag);
                if (now && then) now.replaceWith(then);
            });
            // The bar stays (with the sound and look switches); only which
            // page it marks as open changes.
            var file = url.pathname.split('/').pop() || 'index.html';
            document.querySelectorAll('.nav-links a').forEach(function (a) {
                var href = a.getAttribute('href').split('#')[0];
                if (href === file && file !== 'index.html') a.setAttribute('aria-current', 'page');
                else a.removeAttribute('aria-current');
                // Links back to the home page from another page, and the
                // other way round.
                var hash = a.getAttribute('href').split('#')[1];
                if (hash) a.setAttribute('href', (file === 'index.html' ? '' : 'index.html') + '#' + hash);
            });
            if (push) history.pushState({}, '', url.href);
            shownPath = url.pathname;
            readyPictures();
            show(root.dataset.theme === 'day' ? 'day' : 'night');
            reveal();
            land(url);
        }).catch(function () { location.href = url.href; });
    }
    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || a.target || a.hasAttribute('download')) return;
        var url = new URL(a.href, location.href);
        if (!inSite(url)) return;
        // A link to a part of the page already open just scrolls there.
        if (url.pathname === location.pathname && url.hash) return;
        e.preventDefault();
        go(url, true);
    });
    // Back and forward: another page is fetched; within the page shown, the
    // browser scrolls by itself.
    window.addEventListener('popstate', function () {
        if (location.pathname !== shownPath) go(new URL(location.href), false);
    });
})();
