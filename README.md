NagiosTV
------------

Watch multiple Nagios servers on a wall mounted TV (or your desktop)

- Client Side: HTML5, Javascript, jQuery, EmberJS, Twitter Bootstrap
- Server Side: PHP, MySQL
- Data transfer: AJAX, JSON

Screenshot
------------

![Display](http://chriscarey.com/projects/ajax-monitor-for-nagios/ajax-monitor-2.0-1.png)

Installation
------------

This project is built upon Nagios ndoutils.
NDOUtils allows you to export current and historical data from one or more Nagios instances to a MySQL database.
Install ndoutils package on your Nagios installation and have that up and running first.

- copy config.php.dist to config.php. This is the server-side configuration file
- copy config.js.dist to config.js. This is the client-side configuration file
- edit config.php and set the values 
- edit config.js and set the values


To do the four-in-one, just make a simple html frames page as such:

<!--

<!DOCTYPE html>
<html>
    <head>
    <title>Stats All-in-one</title>
    </head>
    <frameset framespacing="0" COLS="25%,25%,25%,25%" frameborder="0" noresize>
        <frame name="one" src="http://10.4.4.6/nagiostv/" target="_blank">
        <frame name="two" src="http://192.168.0.70/nagiostv/" target="_blank">
        <frame name="three" src="http://192.168.10.10/nagiostv/" target="_blank">
        <frame name="four" src="http://192.168.0.70/nagiostv/" target="_blank">
    </frameset>
</html>

-->