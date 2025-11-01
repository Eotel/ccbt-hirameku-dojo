(() => {
    if (typeof window === 'undefined') {
        return;
    }

    window.addEventListener('ca-ready', (event) => {
        const context = event.detail;
        if (!context) {
            console.warn('[local-gui] ca-ready イベントに context が含まれていません');
            return;
        }

        console.log('[local-gui] Cellular Automaton が準備完了しました', context);
    });
})();
