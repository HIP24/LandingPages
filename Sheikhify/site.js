// The day and night looks, background sounds, "Get the app" going to the
// visitor's store, and sections fading in as they come into view. The hero
// is the app's scene as SVG (img/hero_*.svg), animated inside itself.
(function () {
    var root = document.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Day or night: each picture with a day version shows it by day. Every
    // picture is loaded up front, so a switch never waits for one.
    var pictures = document.querySelectorAll('img[data-day]');
    pictures.forEach(function (img) {
        img.dataset.night = img.getAttribute('src');
        new Image().src = img.dataset.day;
    });

    function show(look) {
        root.dataset.theme = look;
        pictures.forEach(function (img) {
            var src = look === 'day' ? img.dataset.day : img.dataset.night;
            if (img.getAttribute('src') !== src) img.setAttribute('src', src);
        });
        if (sound.playing) sound.crossfade(look);
    }

    // Background sounds: the app's own day and night ambience, quiet, off
    // until the visitor turns them on. Browsers only let sound start from a
    // tap or click, so a visitor who left them on hears them again from
    // their first one.
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
                var t = Math.min(1, (now - start) / ms);
                track.volume = from + (to - from) * t;
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

    function soundSaved() {
        try { return localStorage.getItem('sheikhify-sound') === 'on'; } catch (e) { return false; }
    }

    var soundButtons = document.querySelectorAll('.sound-toggle');
    function markSound(on) {
        soundButtons.forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    markSound(soundSaved());
    soundButtons.forEach(function (button) {
        button.addEventListener('click', function (e) {
            e.stopPropagation();
            var on = !sound.playing;
            try { localStorage.setItem('sheikhify-sound', on ? 'on' : 'off'); } catch (err) {}
            markSound(on);
            if (on) sound.start(); else sound.stop();
        });
    });
    if (soundSaved()) {
        var resume = function () {
            document.removeEventListener('pointerdown', resume, true);
            document.removeEventListener('keydown', resume, true);
            if (soundSaved() && !sound.playing) sound.start();
        };
        document.addEventListener('pointerdown', resume, true);
        document.addEventListener('keydown', resume, true);
    }
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

    var items = document.querySelectorAll('.reveal');
    if (reduce || !('IntersectionObserver' in window)) {
        items.forEach(function (el) { el.classList.add('shown'); });
        return;
    }
    var seen = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) {
                e.target.classList.add('shown');
                seen.unobserve(e.target);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -5% 0px' });
    items.forEach(function (el) { seen.observe(el); });
})();
