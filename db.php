<?php

class DB {

	var $link;
	var $my_host = "";
	var $my_db = "";
	var $my_user = "";
	var $my_pass = "";
	
	function construct($p_host, $p_db, $p_user, $p_pass) {
		$this->my_host = $p_host;
		$this->my_db = $p_db;
		$this->my_user = $p_user;
		$this->my_pass = $p_pass;
   }
  
    function connect() {
        $this->link = mysql_connect($this->my_host, $this->my_user, $this->my_pass);
		if (!$this->link) {
			printf("Error: Connection to MySQL server '%s' failed.<BR>\n", $this->my_host);
			return;
		} 
    }
	
	function select() {
		mysql_select_db($this->my_db);
	}
	
	function query($p_sql) {
		$result = mysql_query($p_sql, $this->link)
			or die ("Error: [$p_sql] - <b>" . mysql_error($this->link) . "</b>" );
		return $result;
    }
	
	function disconnect() {
		if (!mysql_close($this->link)) {
			die("Could not close DB");
		}
	}
}
?>