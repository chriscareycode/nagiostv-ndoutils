/*******************************************************************************
 * main.js
 * by Christopher P Carey 2010-12-09
 ******************************************************************************/

var g_temp;
var g_debug = false;

var refreshCurrent = 10; // in seconds
var refreshAcked = 61; // in seconds
var refreshNotification = 31; // in seconds

var datePageLoad;
var refreshCount = 0; // counts up each refresh
var refreshMax = 10000; // maximum times to refresh the page before quitting
var refreshId = 0; // interval ID of the setTimeout
var byteTotal = 0;

var lastIdCurrent = 0;
var g_blnCurrentAllGood = false;
var lastIdServiceStatus = 0;
var lastIdNotification = 0;
var maxCountNotification = 50;


/*******************************************************************************
 * Display Templates
 ******************************************************************************/
 
function displayCurrentItem(arr, divid) {

    var msg = '';
    
    msg += '<div id="current-'+arr.servicestatus_id+'" class="graybg alert critical" style="display:none;">'+"\n";
    msg += '\t<span class="datetime">\n';
    msg += '\t\t<span style="color:lime;">(</span>'+arr.status_update_time+'<span style="color:lime;">)</span>'+"\n";
    msg += '\t</span>'+"\n";
    
    if (arr.name1) msg += '<span class="alertname1">['+arr.name1+']</span>'+"\n";
    if (arr.name2) msg += '<span class="alertname2">['+arr.name2+']</span>'+"\n";
    
    msg += '\t<span class="state'+arr.current_state+'">'+arr.output+'</span>'+"\n";
    msg += '</div>'+"\n";
    
    $(divid).prepend(msg);
    
    // Expand it
    $('#current-'+ arr.servicestatus_id).slideDown();

}

function displayServiceStatusItem(arr, divid) {

    var msg = '';
    
    if (arr.notifications_enabled == 0 || arr.problem_has_been_acknowledged == 1) {
        msg += '<div id="ss'+ arr.servicestatus_id +'" class="graybg alert acked" style="display:block;opacity:0.7">';
    } else {
        msg += '<div id="ss'+ arr.servicestatus_id +'" class="graybg alert acked" style="display:block;">';
    }
    if (arr.problem_has_been_acknowledged == 1) {
        msg += '<span class="ack">ACK\'ed by Bob Dobbs</span>';
    }
    if (arr.notifications_enabled == 0){
        msg += '<span class="notifications-disabled">Notification Disabled</span>';
    }
    
    msg += '\t<span class="datetime">'+"\n";
    msg += '\t\t<span style="color:lime;">(</span>'+arr.status_update_time+'<span style="color:lime;">)</span>'+"\n";
    msg += '\t</span>';
    
    if (arr.name1) msg += '<span class="alertname1">['+arr.name1+']</span>'+"\n";
    if (arr.name2) msg += '<span class="alertname2">['+arr.name2+']</span>'+"\n";
    
    msg += '\t<span class="state'+arr.current_state+'">'+arr.output+'</span>'+"\n";
    msg += '</div>'+"\n";
    
    $(divid).append(msg);
    
    // Expand it
    //$('#ss'+ arr.servicestatus_id).fadeIn('normal');
    
}

function displayNotificationItem(arr, divid) {

    var msg = '';
    msg += '<div id="notification-'+arr.notification_id+'" class="graybg alert notification" style="display:none;">'+"\n";
    
    msg += '\t<span class="datetime">'+"\n";
    msg += '\t\t<span style="color:lime;">(</span>'+arr.start_time+'<span style="color:lime;">)</span>'+"\n";
    msg += '\t</span>';
    
    if (arr.name1) {
        msg += '<span class="alertname1">['+arr.name1+']</span>'+"\n";
    }
    if (arr.name2) {
        msg += '<span class="alertname2">['+arr.name2+']</span>'+"\n";
    }
    if (arr.output.indexOf('CRITICAL') > -1) arr.state = 2;// a hack to make criticals red
    
    msg += '\t<span class="state'+arr.state+'">'+arr.output+'</span>'+"\n";
    msg += '</div>'+"\n";
    
    $(divid).prepend(msg);
    
    // Expand it
    $('#notification-'+ arr.notification_id).slideDown('normal');
    
    // Remove childrent if the count is higher than allowed
    // (this probably only needs an IF and not a WHILE)
    
    if ($('#notifications > div').size() > maxCountNotification) {
    
        $('#notifications > div:last').slideUp('normal', function() {
            $(this).remove();
        });
        
    }
                
}


function findInArray(p_word, p_array) {

    var ret = false;
    if (p_array.length != 0) {
        for (var i=0;i<p_array.length; i++) {
            if (p_array[i].servicestatus_id == p_word) ret = true;
        }
    }
    return ret;                  
}


/*******************************************************************************
 * updatePage
 ******************************************************************************/

function updateStats() {

    // stop the refresh eventually (just a safety measure)
    if (refreshCount++ >= refreshMax) {
        clearTimeout(refreshIdCurrent);
        clearTimeout(refreshIdAcked);
        clearTimeout(refreshIdNotification);
        $('#stats-refresh').html('');
        $('#lastupdate').html('Auto-Update disabled. Refresh to start again.');
        return false;
    }
    
    
    // update info on the page
    //$('#stats-refresh').html('Refreshing every '+refreshCurrent+' seconds. '+refreshCount+' of '+refreshMax+' ');
    $('#stats-refresh').html('Refreshing every '+refreshCurrent+' seconds. ACK\'ed Refreshing every '+refreshAcked+' seconds. Notifications refreshing every '+refreshNotification+' seconds. ['+refreshCount+'/'+refreshMax+'] ');
    
    // show some debug info
    doConsole('lastIdCurrent:'+ lastIdCurrent);
    doConsole('lastIdServiceStatus:'+ lastIdServiceStatus);
    doConsole('lastIdNotification:'+ lastIdNotification);
    
}
function updateCurrent() {
    
    updateStats();
    
    $('#current-spinner').show();
    
    // request the page
    $.ajax({
        type: "POST",
        url: "api.php",
        data: "func=current",
        success: function(msg){
            
            $('#current-spinner').fadeOut('slow');
            
            if (msg) {
            
                updateByteCount(msg);
                        
                // Convert the return data from JSON to JavaScript Array
                var myobj = eval('(' + msg + ')');
                
                // Get the last id from the returned data
                if (myobj.length > 0) lastIdCurrent = myobj[0].servicestatus_id;
                                    
                // Display 'All is OK' since we have no current items
                if (myobj.length == 0) {
                
                    // only do this if we are changing state (to avoid flicker)
                    //if (!g_blnCurrentAllGood) {
                    if ($('#current-allgood').length == 0) {
                        // remove any children items which used to be here
                        $("#current").children().each(function() {
                            var myid = $(this)[0].id.substring($(this)[0].id.indexOf('-')+1);
                            doConsole('All Good. Sliding up child ' + $(this)[0].id);
                            $('#current-'+myid).slideUp('normal', function() { $(this).remove(); }); 
                        });
                        
                        // show the all good message
                        var allgood = '<div id="current-allgood" class="graybg alert allgood" style="display:none;">';
                        allgood += '<span style="color:lime;">All services are UP</span>';
                        allgood += '</div>';
                        $('#current').prepend(allgood);
                        $('#current-allgood').slideDown('normal');
                        g_blnCurrentAllGood = true;
                    }
                    
                } else {
                
                    // we have failure. Hide the "All Good" message
                    if (g_blnCurrentAllGood == true) $('#current-allgood').slideUp();
                    g_blnCurrentAllGood = false;
                    if (myobj.length != 0) {
                        for (var i=myobj.length-1; i>=0; i--) {                            
                            if ($('#current-'+myobj[i].servicestatus_id).length == 0) {
                                displayCurrentItem(myobj[i], '#current');     
                            }
                        }
                    }
                    
                    // kill any items on the page which were not returned
                    $("#current").children().each(function() {
                        var myid = $(this)[0].id.substring($(this)[0].id.indexOf('-')+1); 
                        if (findInArray(myid, myobj)) {
                            doConsole('div is still in array. leaving alone ' + $(this)[0].id);     
                        } else {
                            doConsole('not in array. killing div ' + $(this)[0].id);
                            $(this).slideUp('normal', function() {
                                $(this).remove();
                            });
                        }
                    });                
                }
            }
        }
    });
    
}

function updateAcked() { 
    
    $('#acked-spinner').show();
    
    $.ajax({
        type: "POST",
        url: "api.php",
        data: "func=servicestatus&lastid="+lastIdNotification,
        success: function(msg){
            
            $('#acked-spinner').fadeOut('slow');
                    
            // Convert the return data from JSON to JavaScript Array
            var myobj = eval('(' + msg + ')');
            
            // Get the last id from the returned data
            if (myobj.length > 0) lastIdServiceStatus = myobj[0].servicestatus_id;
            
            if (myobj.length == 0) {
            
                if ($('#acked-allgood').length == 0) {
                    // show the all good message
                    var allgood = '<div id="acked-allgood" class="graybg alert allgood" style="display:none;">';
                    allgood += '<span style="color:grey;">No services ACK\'ed</span>';
                    allgood += '</div>';
                    $('#acked').html(allgood);
                    $('#acked-allgood').slideDown('normal');
                    //g_blnCurrentAllGood = true;
                }
                        
            }
                        
            // Loop through all returned data and write to screen
            for (var i=0; i<myobj.length; i++) {
                displayServiceStatusItem(myobj[i], '#acked');      
            }
        }
    });
    
}

function updateNotification() {
    
    $('#notifications-spinner').show();
    
    $.ajax({
        type: "POST",
        url: "api.php",
        data: "func=notifications&maxcount="+maxCountNotification+"&lastid="+lastIdNotification,
        success: function(msg){
            
            $('#notifications-spinner').hide();
            
            if (msg) {
            
                updateByteCount(msg);
            
                // Convert the return data from JSON to JavaScript Array
                var myobj = eval('(' + msg + ')');
                
                // Get the last id from the returned data
                if (myobj.length > 0) lastIdNotification = myobj[0].notification_id;
                                
                // Loop through all returned data and write to screen
                if (myobj.length != 0) {
                    for (var i=myobj.length-1; i>=0; i--) {
                        // only add this item if it does not already exist on the page
                        if ($('#notification-'+myobj[i].notification_id).length == 0) {
                            displayNotificationItem(myobj[i], '#notifications');
                        }
                         
                    }
                }
            }
        }
    });
        
}

/*******************************************************************************
 * Various Functions
 ******************************************************************************/

function updateByteCount(msg) {

    // todo: split this into two functions one for time, one for bytes
    var byteAmount = 0;
    var now = new Date();
    var hours = now.getHours(); if (hours < 10) hours = '0'+hours;
    var minutes = now.getMinutes(); if (minutes < 10) minutes = '0'+minutes;
    var seconds = now.getSeconds(); if (seconds < 10) seconds = '0'+seconds;
    
    byteAmount = unescape(encodeURIComponent(msg)).length;
    byteTotal += byteAmount;
    
    $('#pageloaded').html('Page Loaded: ' + datePageLoad);
    $('#lastupdate').html('Last Update: '+ hours +':'+ minutes +':'+ seconds);
    $('#bytetotal').html('Data Xfer: ' + showBytes(byteTotal) + ' ');
}

function showBytes(bytes) {
    var temp;
    if (bytes > 1000000000) {
        temp = Math.floor(bytes / 1000000000) + ' GB';
    } else if (bytes > 1000000) {
        temp = Math.floor(bytes / 1000000) + ' MB'; 
    } else if (bytes > 1000) {
        temp = Math.floor(bytes / 1000) + ' KB';    
    } else {
        temp = bytes + ' bytes';
    }
    return temp;
}

function toggleVisibility(id) {
    $('#'+id).toggle();
}

function doConsole(msg) {
    if (g_debug && window.console && window.console.firebug) console.info(msg);  
}

/*******************************************************************************
 * Document Ready
 ******************************************************************************/
 
$(document).ready(function(){

    // This hides the jQuery warning
    $('#jquery-test').hide();

    doConsole('Welcome to Nagios Stats.');
    doConsole('Current refresh is set to '+refreshCurrent+' seconds');
    
    var now = new Date();
    var hours = now.getHours(); if (hours < 10) hours = '0'+hours;
    var minutes = now.getMinutes(); if (minutes < 10) minutes = '0'+minutes;
    var seconds = now.getSeconds(); if (seconds < 10) seconds = '0'+seconds;
    datePageLoad = hours +':'+ minutes +':'+ seconds;
    
    
    // Update current Now
    updateCurrent();
    updateAcked();
    updateNotification();

    // Update page every n seconds
    refreshIdCurrent = setInterval("updateCurrent()", refreshCurrent * 1000);
    refreshIdAcked = setInterval("updateAcked()", refreshAcked * 1000);
    refreshIdNotification = setInterval("updateNotification()", refreshNotification * 1000);
    
});
