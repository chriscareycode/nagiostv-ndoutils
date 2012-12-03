<?php

    // Includes (Part 1)
    require_once('config.php');
    
    // This must be set here or in php.ini. Until such time that I can detect this…
    if (!isset($g_timezone)) {
        header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error', true, 500);
        $fail = array('OK'=>0, 'ERROR'=>'Error: Must set default timezone. Check config.php.dist');
        print json_encode($fail);
        exit;
    }
    
    date_default_timezone_set($g_timezone);
    
    // check for curl extension
    if (!extension_loaded("curl")) {
        header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error', true, 500);
        $fail = array('OK'=>0, 'ERROR'=>'Error: Missing extension php5-curl');
        print json_encode($fail);
        exit;
    }
    
    // check for mysql extension
    if (!extension_loaded("mysql")) {
        header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error', true, 500);
        $fail = array('OK'=>0, 'ERROR'=>'Error: Missing extension php5-mysql');
        print json_encode($fail);
        exit;
    }
    
    // Includes (Part 2)
	require_once('db.php');

    // Functions
    function doCheckVersion($version) {
                
        $post_data = "version=".$version;
        $page = "/software/nagiostv/version/json/";
        $url = "http://chriscarey.com".$page;
        $headers = array(
            "POST ".$page." HTTP/1.0",
            "Content-type: text/xml;charset=\"utf-8\"",
            "Accept: text/xml",
            "Cache-Control: no-cache",
            "Pragma: no-cache",
            "Content-length: ".strlen($post_data)
        );
      
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL,$url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
        $data = curl_exec($ch);
        if (!curl_errno($ch)) {
            curl_close($ch);
        }
        return $data;
    }

    // Declare
    $sql = '';

    // Catch
    $func = ''; if (isset($_POST['func'])) $func = $_POST['func'];
    $lastid = ''; if (isset($_POST['lastid'])) $lastid = $_POST['lastid'];
    $maxcount = '50'; if (isset($_POST['maxcount'])) $maxcount = $_POST['maxcount'];
    $client_version = '0'; if (isset($_POST['client_version'])) $client_version = $_POST['client_version'];

    if (isset($_GET['func'])) $func = $_GET['func']; //disable me after debug
    if (isset($_GET['lastid'])) $lastid = $_GET['lastid'];
    if (isset($_GET['maxcount'])) $maxcount = $_GET['maxcount'];
    if (isset($_GET['client_version'])) $client_version = $_GET['client_version'];

    // Start PHP Session
	session_start();

    // Decide what we need to do
	switch($func) {
	
        case "current":
        
            $sql = "SELECT * FROM nagios_servicestatus s INNER JOIN nagios_objects o ON s.service_object_id=o.object_id ";
            $sql .= "WHERE current_state <> 0 AND ";
                $sql .= "(problem_has_been_acknowledged = 0 AND notifications_enabled = 1) ";
                //if (is_numeric($lastid)) $sql .= "AND (servicestatus_id > ".$lastid.") ";
            $sql .= "ORDER BY problem_has_been_acknowledged, notifications_enabled DESC, status_update_time DESC ";
            $sql .= "LIMIT 500;";
            break;
            
        case "acked":
            
            $sql = "SELECT * FROM nagios_servicestatus s  ";
            $sql .= "INNER JOIN nagios_objects o ON s.service_object_id=o.object_id ";
            $sql .= "WHERE current_state <> 0 AND ";
                $sql .= "(problem_has_been_acknowledged = 1 OR notifications_enabled = 0) ";
                //if (is_numeric($lastid)) $sql .= "AND (servicestatus_id > ".$lastid.") ";
            $sql .= "ORDER BY problem_has_been_acknowledged DESC, status_update_time ";
            $sql .= "DESC LIMIT 500;";
	       break;
	       
	   case "history":
	   
	       $sql = "SELECT n.*, o.name1, o.name2 FROM nagios_notifications n ";
	       $sql .= "INNER JOIN nagios_objects o ON n.object_id=o.object_id ";
	       if (is_numeric($lastid)) $sql .= "WHERE (notification_id > ".$lastid.") ";
	       $sql .= "ORDER BY start_time DESC LIMIT ".$maxcount.";";
	       break;

        case "versioncheck":
       
           $latest_version = doCheckVersion($client_version);
           //$latest_version = json_encode($latest_version);
          // $json_version = array('result'=>$latest_version);
           print json_encode($latest_version);
           exit;
           break;
	       
	   default:
	       $fail = array('OK'=>0, 'ERROR'=>'Bad Request');
	       print json_encode($fail);
	       exit;
	       break;
	}
	
	// Prep Database
	$my_db = new DB();
	$my_db->construct($g_db_host, $g_db_name, $g_db_user, $g_db_pass);
	$my_db->connect();
	$my_db->select();
	if ($sql) {
    	$result = $my_db->query($sql);
        if ($result) {
            $json_array = array();
            $result_array = array();
            // add a time stamp to this array
            
            //$dtz = new DateTimeZone();
            //$offset = tdz.getOffset();
            $seconds = date_offset_get(new DateTime);
            $offset = $seconds / 3600;
            
            array_push($json_array, array('stamp'=> time(), 'offset'=>$offset ));
            
            // push all the results down into a json string
            while ($row = mysql_fetch_array($result)) {
            
                array_push($result_array, $row);
            }
            mysql_free_result($result);
            
            array_push($json_array, array('result'=>$result_array));
            print json_encode($json_array);
        }
	} else {
	   $fail = array('OK'=>0, 'ERROR'=>'No SQL');
	   print json_encode($fail);
	}
	$my_db->disconnect();
	
?>
