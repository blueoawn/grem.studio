document.addEventListener('DOMContentLoaded', function() {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        alert('Please enter a valid email address!');
        return false;
    }
    
    return true;
});

// Parallax grid effect
document.addEventListener('scroll', function() {
    const scrollY = window.scrollY;
    const gridLayer1 = document.querySelector('.parallax-grid-layer-1');
    const gridLayer2 = document.querySelector('.parallax-grid-layer-2');
    const gridLayer3 = document.querySelector('.parallax-grid-layer-3');
    
    if (gridLayer1) {
        gridLayer1.style.transform = `translateY(${scrollY * 0.1}px)`;
    }
    if (gridLayer2) {
        gridLayer2.style.transform = `translateY(${scrollY * 0.25}px)`;
    }
    if (gridLayer3) {
        gridLayer3.style.transform = `translateY(${scrollY * 0.4}px)`;
    }
});

// Add some retro console art
console.log('%c' + `
 ██████╗ ██████╗ ███████╗███╗   ███╗    ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗ 
██╔════╝ ██╔══██╗██╔════╝████╗ ████║    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
██║  ███╗██████╔╝█████╗  ██╔████╔██║    ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
██║   ██║██╔══██╗██╔══╝  ██║╚██╔╝██║    ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
╚██████╔╝██║  ██║███████╗██║ ╚═ ╝██║    ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ 
                                                                              
`, 'color: #7700ffff; font-family: monospace; font-size: 10px;');
