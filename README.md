NagiosTV
------------

Watch one or more Nagios servers on a wall mounted TV (or your desktop)

New items slide in and out of place with animations. Soft alerts show an animated 60 second bar chart timer.
Hosts and services are clickable to jump to the Nagios web interface

- Client Side: HTML5, Javascript, jQuery, EmberJS, Twitter Bootstrap
- Server Side: PHP, MySQL
- Data transfer: AJAX, JSON

Screenshot of 5 Nagios servers on one TV (5-in-1)
------------

![Display](http://chriscarey.com/projects/ajax-monitor-for-nagios/nagios-5-in-1.png)


Requirements
------------

Packages needed by api.php:

apt-get install php5 php5-mysql php5-curl libapache2-mod-php5

This project is built upon Nagios ndoutils.
NDOUtils allows you to export current and historical data from one or more Nagios instances to a MySQL database.

- Install ndoutils package on your Nagios installation and have that up and running first.
- The hostname/username/password to your database will be needed in the config.php file.
- A read-only user is fine since no writes are done to the database.

Installation
------------

- git clone git://github.com/chriscareycode/NagiosTV.git
- $ cd NagiosTV
- copy config.php.dist to config.php. This is the server-side configuration file
- copy config.js.dist to config.js. This is the client-side configuration file
- edit config.php and set the values 
- edit config.js and set the values

* Make sure date_default_timezone_set is set in your PHP.ini.
* date_default_timezone_set('Europe/London');

Upgrading
------------
- $ cd NagiosTV
- $ git pull

Your customized config files (config.js, config.php) will not be overwritten.
  You may want to check config.php.dist and config.js.dist for new options
  until I get around to automating that process.
  
If you are having problems, backup your NagiosTV folder, or move it.
  Then run through Installation above, and copy your old
  config.js and config.php into the new NagiosTV folder.

How to show multiple Nagios on one TV
------------
To do the four-in-one, you can look at frame-sample.htm included.

TODO
------------
Features to work on next:

- a config.php page which checks prerequisites on the server side and communicates that down to the client if there is a problem.
- Improve version number
- Intelligent auto-updater?

Credits
------------
NagiosTV by Chris Carey
http://chriscarey.com
