document.addEventListener('DOMContentLoaded', function() {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        alert('Please enter a valid email address!');
        return false;
    }
    
    return true;
});

// Parallax grid effect (batched via requestAnimationFrame, cached lookups)
(function() {
    if (window.PerfSettings?.reducedMotion) return;
    const layers = [
        [document.querySelector('.parallax-grid-layer-1'), 0.1],
        [document.querySelector('.parallax-grid-layer-2'), 0.25],
        [document.querySelector('.parallax-grid-layer-3'), 0.4]
    ].filter(function(l) { return l[0]; });
    if (!layers.length) return;

    let ticking = false;
    function update() {
        ticking = false;
        const scrollY = window.scrollY;
        for (let i = 0; i < layers.length; i++) {
            layers[i][0].style.transform = 'translateY(' + scrollY * layers[i][1] + 'px)';
        }
    }
    document.addEventListener('scroll', function() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });
})();

// Add some retro console art
console.log('%c' + `
 ██████╗ ██████╗ ███████╗███╗   ███╗    ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗ 
██╔════╝ ██╔══██╗██╔════╝████╗ ████║    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
██║  ███╗██████╔╝█████╗  ██╔████╔██║    ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
██║   ██║██╔══██╗██╔══╝  ██║╚██╔╝██║    ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
╚██████╔╝██║  ██║███████╗██║ ╚═ ╝██║    ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ 
                                                                              
`, 'color: #7700ffff; font-family: monospace; font-size: 10px;');
