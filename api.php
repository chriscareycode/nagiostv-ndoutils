<?php

    // Includes
	require_once('config.php');
	require_once('db.php');

    // Declare
    $sql = '';

    // Catch
    $func = ''; if (isset($_POST['func'])) $func = $_POST['func'];
    if (isset($_GET['func'])) $func = $_GET['func']; //disable me after debug
    $lastid = ''; if (isset($_POST['lastid'])) $lastid = $_POST['lastid'];
    if (isset($_GET['lastid'])) $lastid = $_GET['lastid'];
    $maxcount = '50'; if (isset($_POST['maxcount'])) $maxcount = $_POST['maxcount'];
    if (isset($_GET['maxcount'])) $maxcount = $_GET['maxcount'];

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
            array_push($json_array, array('stamp'=> time() ));
            
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
