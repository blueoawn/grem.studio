document.addEventListener('DOMContentLoaded', function() {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        alert('Please enter a valid email address!');
        return false;
    }
    
    return true;
}

// Add some retro console art
console.log('%c' + `
 ██████╗ ██████╗ ███████╗███╗   ███╗    ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗ 
██╔════╝ ██╔══██╗██╔════╝████╗ ████║    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
██║  ███╗██████╔╝█████╗  ██╔████╔██║    ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
██║   ██║██╔══██╗██╔══╝  ██║╚██╔╝██║    ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
╚██████╔╝██║  ██║███████╗██║ ╚═ ╝██║    ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ 
                                                                              
`, 'color: #7700ffff; font-family: monospace; font-size: 10px;');
