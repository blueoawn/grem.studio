<style>
    #navbar .nav-dropdown {
        position: relative;
    }

    #navbar .nav-dropdown > a {
        cursor: pointer;
    }

    #navbar .dropdown-menu {
        display: none;
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 10, 14, 0.98);
        border: 1px solid #00ffff;
        border-top: none;
        list-style: none;
        padding: 0;
        margin: 0;
        min-width: 140px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
        z-index: 1001;
    }

    #navbar .dropdown-menu li {
        margin: 0;
    }

    #navbar .dropdown-menu li a {
        display: block;
        padding: 10px 15px;
        color: #00ffff;
        text-decoration: none;
        font-weight: bold;
        transition: all 0.2s;
        border-bottom: 1px solid rgba(0, 255, 255, 0.2);
    }

    #navbar .dropdown-menu li:last-child a {
        border-bottom: none;
    }

    #navbar .dropdown-menu li a:hover {
        background: rgba(0, 255, 255, 0.15);
        color: #ff00ff;
    }

    #navbar .nav-dropdown:hover .dropdown-menu,
    #navbar .nav-dropdown:focus-within .dropdown-menu {
        display: block;
    }

    #navbar a:hover {
        color: #ff00ff;
    }
</style>
<nav id="navbar" style="position:center; top:0; left:0; right:0; background:rgba(10,10,14,0.98); z-index:1000; padding:15px 0; box-shadow:0 2px 20px rgba(0,0,0,0.5); width:100%;">
    <ul style="max-width:1200px; margin:0 auto; padding:0 40px; list-style:none; display:flex; align-items:center; flex-wrap:wrap; justify-content:space-evenly;">
        <li style="margin:0;"><a href="https://grem.studio" style="color:#00ffff; text-decoration:none; font-weight:bold; transition:color 0.2s;">Home</a></li>
        <li class="nav-dropdown" style="margin:0; position:relative;">
            <a href="#" style="color:#00ffff; text-decoration:none; font-weight:bold; transition:color 0.2s;">Games <span style="font-size:0.7em;">▼</span></a>
            <ul class="dropdown-menu">
                <li><a href="https://grem.studio/minecraft.php">Minecraft</a></li>
                <li><a href="https://hdh.grem.studio">Half Dozen Heroz</a></li>
                <li><a href="https://grem.studio/deck-helper">SWU Deck Helper</a></li>
            </ul>
        </li>
        <li class="nav-dropdown" style="margin:0; position:relative;">
            <a href="#" style="color:#00ffff; text-decoration:none; font-weight:bold; transition:color 0.2s;">Collaborate <span style="font-size:0.7em;">▼</span></a>
            <ul class="dropdown-menu">
                <li><a href="https://grem.studio/graffiti-together/">Graffiti Together</a></li>
                <li><a href="https://grem.studio/picto-forum/">Picto Forum</a></li>
            </ul>
        </li>
        <li class="nav-dropdown" style="margin:0; position:relative;">
            <a href="#authors" style="color:#00ffff; text-decoration:none; font-weight:bold; transition:color 0.2s;">Founders <span style="font-size:0.7em;">▼</span></a>
            <ul class="dropdown-menu">
                <li><a href="https://danielstein.xyz">Bluepawn</a></li>
                <li><a href="https://armando.grem.studio">Nero</a></li>
                <li><a href="https://william.grem.studio">Koji-san</a></li>
            </ul>
        </li>
    </ul>
</nav>
