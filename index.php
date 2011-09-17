<html>
<head>
<title>Nagios System Stats</title>
<link rel="stylesheet" type="text/css" href="style.css">
<script type="text/javascript" src="lib/jquery-1.4.2.min.js"></script>
<script type="text/javascript" src="main.js"></script>
</head>
<body>
    
<div id="main">

    <div id="statistics">
        <span id="stats-refresh"></span><br />
        <span id="pageloaded">Page Loaded: Never</span> -
        <span id="lastupdate">Last Update: Never</span> - 
        <span id="bytetotal" style="margin-bottom:10px;">Data Xfer: 0</span>
    </div>
   
    <div class="title">AJAX Monitor for Nagios
        <span id="current-spinner" style="display:none;"><img src="images/ajax-loader.gif" alt="ajax-loader" /></span>
    </div>
    <div id="current"></div>
    
    <div class="title">ACK'ed Status Updates
        <span id="acked-spinner" style="display:none;"><img src="images/ajax-loader.gif" alt="ajax-loader" /></span>
    </div>
    <div id="acked"></div>
        
    <div class="title">Notification Feed History
        <span id="notifications-spinner" style="display:none;"><img src="images/ajax-loader.gif" alt="ajax-loader" /></span>
    </div>
    <div id="notifications"></div>

    <div id="jquery-test" class="graybg alert allgood">
        <span style="color:pink;">jQuery is having a problem loading..</span>
    </div>
    
</div>

</body>
</html>