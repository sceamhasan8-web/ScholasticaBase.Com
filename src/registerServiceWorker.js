export const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
            console.log('✅ Service worker registered successfully with scope:', reg.scope);
        }).catch((err) => {
            console.warn('Service worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
        register();
    } else {
        window.addEventListener('load', register);
    }
};

