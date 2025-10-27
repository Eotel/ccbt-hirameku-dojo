(() => {
    function onReady(app) {
        if (!app || typeof app.ensureGui !== 'function') {
            console.warn('[lsystem] ensureGui が利用できません');
            return;
        }
        window.__LSYSTEM_GUI_MODE = 'local';
        app.ensureGui('local');
    }

    if (window.LSYSTEM_APP) {
        onReady(window.LSYSTEM_APP);
    } else {
        window.addEventListener('lsystem-ready', (event) => onReady(event.detail), {once: true});
    }
})();
