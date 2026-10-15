<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How to Connect to Our Minecraft Server</title>
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="minecraftpage.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="wp2005">
  <?php include 'navbar.php'; ?>
  <div class="wrap">
    <div class="header">
      <h1>How to Connect to the GREM Minecraft Server</h1>
      <p>A very official tutorial page</p>
    </div>

    <div class="content">
      <div class="note">
        Server Address: <strong>minecraft.grem.studio</strong>
        <br/>
        Default Version: <strong>Java Edition 1.21.x</strong> (updates hapen sometimes)
      </div>

      <h2>Quick Start (Java Edition, Windows/macOS/Linux)</h2>
      <ol>
        <li>Open the Minecraft Launcher and select <strong>Java Edition</strong>.</li>
        <li>Click <strong>Installations</strong> and make sure you're on our version.</li>
        <li>Click <strong>Play</strong> → once in-game choose <strong>Multiplayer</strong>.</li>
        <li>Click <strong>Add Server</strong>.</li>
        <li>Enter <strong>Server Name</strong>: Team GREM</li>
        <li>Enter <strong>Server Address</strong>: <span class="codebox">minecraft.grem.studio</span></li>
        <li>Hit <strong>Done</strong>, select the server, then click <strong>Join Server</strong>.</li>
      </ol>

      <div class="widget">
        <h3>Troubleshooting Java (common oopsies)</h3>
        <ul>
          <li><strong>Version mismatch:</strong> If you see "Incompatible client", switch your installation to the server version listed above.</li>
          <li><strong>Can't resolve hostname:</strong> Try the raw IP if provided on our homepage; otherwise check your DNS settings or just reboot the router (ancient ritual, still works).</li>
          <li><strong>Connection timed out:</strong> Make sure your firewall isn't blocking <em>javaw.exe</em>. Add an allow rule, then retry.</li>
          <li><strong>Mods/Forge:</strong> If you use mods, please dont. We vanilla. kinda</li>
        </ul>
      </div>

      <h2>Switching Between Survival and Creative Mode Zones</h2>
      <p>Our server uses the Multiworld plugin to separate Survival and Creative mode areas. Here's how to switch between them as a player:</p>
      <h3>Using the /mvtp Command</h3>
      <ol>
        <li>Open your chat by pressing <strong>T</strong> (default key).</li>
        <li>Type the command: <span class="codebox">/mvtp creative</span> to go to Creative mode zone.</li>
        <li>Press <strong>Enter</strong> to execute the command.</li>
        <li>You'll be teleported to the Creative mode world instantly.</li>
      </ol>

      <h3>Returning to Survival Mode</h3>
      <ol>
        <li>Open chat again with <strong>T</strong>.</li>
        <li>Type: <span class="codebox">/mvtp survival</span> to return to Survival mode zone.</li>
        <li>Press <strong>Enter</strong> and you'll be back in Survival mode.</li>
      </ol>

      <div class="widget">
        <h3>Multiworld Quick Tips</h3>
        <ul>
          <li><strong>Available worlds:</strong> You can list all available worlds with <span class="codebox">/mvlist</span></li>
          <li><strong>World info:</strong> Get details about a specific world using <span class="codebox">/mvinfo survival</span> or <span class="codebox">/mvinfo creative</span></li>
          <li><strong>Spawn point:</strong> If you need to return to a world's spawn, use <span class="codebox">/mvspawn [world]</span></li>
        </ul>
      </div>

      <div class="callout">
        <strong>Whitelist / Rules:</strong> If the server says you're not whitelisted, ping us on Discord. Please no griefing, keep chat civil-ish, and don't be a square.
      </div>

      <h2>Optional: Using Direct Connect (Java)</h2>
      <p>If you just want to jump in fast:</p>
      <div class="codebox">Multiplayer → Direct Connect → minecraft.grem.studio</div>
      <p>This won't save the server in your list. Works when ur in a hurry.</p>

      <h2>Common Fixes (when things act weird)</h2>
      <ul>
        <li><strong>Update Java:</strong> Use the latest Java runtime that matches your Minecraft version. Old Java can be crusty.</li>
        <li><strong>Reboot everything:</strong> Launcher, PC, router.</li>
        <li><strong>Check status:</strong> If we're doing maintenance, the server might be offline. Try again later or see our Discord announcements.</li>
      </ul>

      <div class="warning">
        <strong>Heads up:</strong> Our address can change after maintenance. If <span class="codebox">minecraft.grem.studio</span> doesn't resolve, check the homepage for a temporary IP.
      </div>

      <p style="margin-top: 10px;">Need help? Join our Discord.<a href="https://discord.gg/S8nw7FkKCj" class="social-badge discord" title="Discord Server"><i class="fab fa-discord"></i></a></p>
    </div>

    <div class="footer">© 2025 Team GREM. All rights reserved.</div>
  </div>
</body>
</html>
