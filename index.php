<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team GREM - Welcome to Our Digital Haven</title>
    <link rel="stylesheet" href="styles.css?v=2">
    <link rel="stylesheet" href="ant-background.css?v=2">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body style="margin:0; padding:0; overflow-x:hidden; background:rgba(6,7,10,0.95); position:relative; z-index:0;">
    <?php include 'navbar.php'; ?>
    <canvas id="c" aria-hidden="true" style="position:fixed; inset:0; z-index:-1; pointer-events:none;"></canvas>

    <!-- Parallax Grid Container (behind the wave canvas) -->
    <div class="parallax-grid-container" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:-2; overflow:hidden; pointer-events:none;">
        <div class="parallax-grid-layer-1"></div>
        <div class="parallax-grid-layer-2"></div>
        <div class="parallax-grid-layer-3"></div>
    </div>

    <div id="container" style="position:relative; z-index:2; max-width:1200px; margin:32px auto; background:rgba(10,10,14,0.85); padding:40px; box-shadow:0 0 60px rgba(0,0,0,0.5); border-radius:16px;">


        <header id="main-header" style="margin: -40px -40px 0 -40px; padding: 40px;">
            <div class="header-content">
            <h1 class="style-nine" data-text="GREM Studio">GREM.Studio</h1>
            <p class="tagline">Your Favorite Digital Haven</p>
            </div>
        </header>

        <main>
            <div class="welcome-box">
                    <div class="stats-counter">
                        <h2 class="grungy-text">Introducing Team Grem Studio</h2>
                    </div>

                <p style="padding-top:15px;">You've stumbled upon the weird corner of the internet. Here at GREM, we're a bunch of degenerate gamers staying up at crackhead hours to bring you the latest updates, creative content, and a some random cool fuck ass shit.</p>

                <section class="info-section">
                    <h3>Quick Access</h3>
                    <ul>
                        <li>Try our <a href="https://grem.studio/deck-helper">Probability Calculator for the Star Wars: Unlimited TCG</a></li>
                        <li>Connect to our Minecraft server: <a href="minecraft.php"> minecraft.grem.studio</a></li>
                        <li>Try our first game: <a href="https://hdh.grem.studio">Half Dozen Heroz</a></li>
                    </ul>
                </section>

                <section class="info-section">
                    <h3>What's New?</h3>
                    <ul>
                        <li><strong>1/13/2026: This website now runs on php! Enjoy the consistent navbar across all pages.</strong></li>
                        <li><strong>1/11/2026: Happy New Year! There's now a page for the probability calculator for the SWU cardgame, check it out <a href="https://grem.studio/deck-helper">here</a></strong></li>
                        <li><strong>Added our instagram button!</strong></li>
                        <li><strong>Our minecraft server is now <span class="live-text">live!</span> Come play at minecraft.grem.studio!</strong></li>
                        <li><strong>December 10, 2025:</strong> Site launched! Check out our author links!</li>
                        <li><strong>Coming Soon:</strong> Multiplayer browser arena deathmatch game</li>
                        <li><strong>Featured:</strong>Our game jam project <a href="https://itch.io/jam/jinglegamejam2025/rate/4103999">Half Dozen Heroz</a></li>
                    </ul>
                </section>


            </div>

            <div class="content-grid">
                <div class="content-box">
                    <h3>Featured Authors</h3>
                    <p>Meet the talented individuals behind Team GREM. Click on their links to learn more about their work and connect with them!</p>
                    <ul>
                        <li><a href="https://daniel.grem.studio">→ Daniel "Bluepawn" Stein</a></li>
                        <li><a href="https://armando.grem.studio">→ Armando "Nero" Arroyo</a></li>
                        <li><a href="https://william.grem.studio">→ William "Koji-san" Kim</a></li>
                    </ul>
                </div>

                <div class="content-box">
                              <div class="social-media-section">
                        <h3>Follow Us</h3>
                        <div class="social-badges-container">
                            <ul class="social-badges">
                                <a href="https://www.youtube.com/@grem.studio" class="social-badge youtube" title="YouTube Channel"><i class="fab fa-youtube"></i></a>
                                <a href="https://discord.gg/S8nw7FkKCj" class="social-badge discord" title="Discord Server"><i class="fab fa-discord"></i></a>
                                <a href="https://www.instagram.com/grem.studio?igsh=MzRlODBiNWFlZA==" class="social-badge instagram" title="Instagram"><i class="fab fa-instagram"></i></a>
                                <!-- Placeholder for future badges -->
                                <div class="social-badge placeholder" title="Coming Soon"><i class="fas fa-plus"></i></div>
                            </ul>
                        </div>
                    </div>

                    </div>
                </div>
                            <div class="announcement-marquee">
                <marquee behavior="loop" direction="left" scrollamount="11">
                                ★&nbsp;&nbsp;&nbsp;Welcome to GREM Studio!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Best viewed on a monitor&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Add us to your bookmarks!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Enjoy your stay!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Thanks for stopping by!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Don't forget to take ur shoes off!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;We're glad you exist&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Stay hydrated, friend!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Cringe free zone&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;You matter more than you know&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Don't forget to be awesome!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Smiles look good on you&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Take a deep breath&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Treat yourself kindly today&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;High five, internet friend&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;You're doing great&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Time for a stretch break&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Pet the doggo&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;the dress is blue and black&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Han shot first&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Cozy vibes enabled&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Have a lovely day&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Welcome to GREM Studio!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Best viewed on a monitor&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Add us to your bookmarks!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Enjoy your stay!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Thanks for stopping by!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Don't forget to take ur shoes off!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;We're glad you exist&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Stay hydrated, friend!&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;My other website is in the garage&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;You matter more than you know&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Keep being awesome&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;wake me up inside&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Take a deep breath&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Treat yourself kindly today&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;High five, internet friend&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;You're doing great&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Time for a stretch break&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Pet the doggo&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Send a meme to a pal&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Han shot first&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Cozy vibes enabled&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;Have a lovely day&nbsp;&nbsp;&nbsp;★
                </marquee>
            </div>
            </div>



        </main>

        <footer>
            <p>&copy; 2025 Team GREM. All rights reserved. | <a href="mailto:bluepawn@teamgrem.com">Contact Us</a></p>
            <p class="footer-note">Best viewed on desktop web browser, if u read this you are awesome</p>
        </footer>
    </div>

    <canvas id="ant-canvas" aria-hidden="true" style="z-index:1;"></canvas>
    <script src="perf-detect.js"></script>
    <script src="script.js"></script>
    <script src="waves.js"></script>
    <script src="langstonbg.js"></script>
</body>
</html>
