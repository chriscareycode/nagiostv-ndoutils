/*******************************************************************************
 * 
 * Nagios TV Monitor
 * by Christopher P Carey 2010-12-09
 * Last Modified Nov 12 2012
 * 
 * main.js
 *
 ******************************************************************************/

var refreshCurrent = 10; // in seconds
var refreshAcked = 31; // in seconds
var refreshNotification = 16; // in seconds

var maxCountNotification = 30;

/*******************************************************************************
 * Document Ready
 ******************************************************************************/

function emberStart() {

    window.App = Ember.Application.create();  
    
    App.Item = Em.Object.extend();
    
    App.log = function(msg){
       if (window.console) console.info(msg);
    };
        
    App.currentController = Ember.ArrayController.create({

        current: [],
        acked: [],
        history: [],
        
        versionMismatch: false,
        version: '5',
        versionString:'0.5',
        versionServer: '',
        versionStringServer: '',

        versionCheck: function() {

            if (!config_version_check) {
                App.log('versionCheck() Disabled');
                return;
            }
            var that=this;

            $.ajax({
                type: "POST",
                url: "api.php",
                data: "func=versioncheck&client_version="+that.get('versionCurrent'),
                dataType: "json",
                timeout: 5000,
                error: function(data1, data2) {
                    App.log('versionCheck() Error getting version');
                    
                    var jsondata = eval('(' + data1.responseText + ')');

                    if (jsondata.OK == 0) {
                        App.log('versionCheck() Error VersionCheck');
                        $('#disconnected').html(jsondata.ERROR);
                    }
                    
                    cancelTimers();
                    
                },
                success: function(data){
                    
                    //App.log('success, ');
                    //App.log(data);
                    var jsondata = eval('(' + data + ')');
                    //App.log(jsondata);

                    if (jsondata.OK == 0) {
                        App.log('versionCheck() Error VersionCheck');
                    }
                    
                    that.set('versionServer', jsondata.version);
                    that.set('versionStringServer', jsondata.version_string);

                    if (jsondata.version > that.get('version')) {

                        that.set('versionMismatch', true);
                        App.log('versionCheck() out of date. Client has '+that.get('version')+' and latest version is '+jsondata.version);
                    } else {
                        App.log('versionCheck() up to date. Client has '+that.get('version')+' and latest version is '+jsondata.version);

                    }
                }
            });
        },



        localTimeZone: function() {
            // Auto Detect with http://www.pageloom.com/automatic-timezone-detection-with-javascript
            var timezone = jstz.determine();
            App.log('Detecting Local TimeZone as '+timezone.name());
            return timezone.name();

        }.property(),
        
        remoteTime: '',
        remoteTimeObject: 0,
        remoteTimeZone: config_timezone || 'US/Pacific',
        
        timeZoneDiffHours: 0,
        
        currentDisconnected: true,
        
        lastIdNotification: 0,
        
        startCountdown: function(obj) {

            var count = refreshCurrent - 1;
            var origcount = refreshCurrent;
            
            clearInterval(obj.countdown);
            
            obj.set('timerPercent','100');
            obj.countdown = setInterval(function(){
            
                var pct = ((count-1) / origcount)*100;
                obj.set('timerPercent',pct);
                
                // set the piecon to the percent as well
                Piecon.setProgress(pct);
                
                if (count == 0) {
                    clearInterval(obj.countdown);
                }
                count--;
            }, 1000);
        },

        
        
        updateCurrent: function() {
            
            var that = this;
            
            $('#current-spinner').show();
            
            // request the page
            $.ajax({
                type: "GET",
                url: "api.php",
                data: "func=current",
                dataType: "json",
                timeout: 5000,
                error: function(data) {
                    that.set('currentDisconnected', true);
                },
                success: function(data){
                    
                    that.set('currentDisconnected', false);
                    
                    $('#current-spinner').fadeOut('slow');
                    
                    if (data) {
                        
                        var metadata = data[0];
                        var resultdata = data[1]["result"];
                        
                        if (!resultdata) {
                            return;
                        }
                        
                        if (metadata["stamp"] && metadata["offset"]) {
                        
                            // set Local Time
                            var localdate = new timezoneJS.Date(new Date().toString(), that.get('localTimeZone'));
                            var local_offset = -localdate.getTimezoneOffset() / 60;
                                                       
                            // set Remote Time
                            var remotetime = new Date(0);
                            remotetime.setUTCSeconds(metadata["stamp"]);
                            remotetime = new timezoneJS.Date(remotetime.toString(), that.get('remoteTimeZone'));
                            that.set('remoteTimeObject', remotetime);
                            that.set('remoteTime', remotetime.toString());
                            
                            // difference time
                            //var diff = remotetime.getHours() - localdate.getHours();
                            //that.set('timeZoneDiffHours', diff);

                            // calculate difference hours with datejs TimeSpan
                            var span = localdate.getTimezoneOffset() - remotetime.getTimezoneOffset();
                            that.set('timeZoneDiffHours', span/60);
                            
                        }
                    
                        // grab the current list of items
                        var current = that.get('current');
                        
                        // create an ember array if one does not exist
                        if (typeof(current) === "undefined") current = Ember.MutableArray();
                        
                        // set the found bit on each item to 0. we will check for this bit later
                        // to compare the existing list of items against the one the server sends down
                        for(var j=0;j<current.length;j++) {
                            current[j].set('found', 0);
                        }
                        

                        // aliases to keep inner loop fast
                        var cachedRes, newRes, found; 

                        // We can't just blindly replace all the data. Thats sloppy as hell yo
                        // loop through the returned data and take a look at what we've got
                        for(var i=0;i<resultdata.length;i++) {
                        
                            // search for a existing record
                            found = false;
                            newRes = resultdata[i];

                            for(var j=0;j<current.length;j++) {
                                cachedRes = current[j];
                                if (cachedRes.servicestatus_id === newRes.servicestatus_id) {
                                    cachedRes.set('state_type', newRes.state_type);
                                    cachedRes.set('current_state', newRes.current_state);
                                    cachedRes.set('next_check', newRes.next_check);
                                    cachedRes.set('output', newRes.output);
                                    cachedRes.set('found', 1);
                                    found = true;
                                }
                            }                
                            if (!found) {
                                // item was returned and it was not found. lets add it into the array of items
                                //App.log('updateCurrent() new item');
                                //App.log(resultdata[i]);
                                
                                // add this new item into the current array
                                current.pushObject( App.Item.create(newRes) );

                            }
                        }
                        
                        // If the server returns nothing, lets clear the items out all at once. 
                        // Fixes the delayed All services are UP bug
                        if (resultdata.length === 0) {

                            $('.currentitem').slideUp('slow', function(){

                                current.forEach(function(e) {
                                  console.info('foreach clearInterval '+e);
                                  console.info('foreach clearInterval '+e.softcountdown);
                                  if (e && e.softcountdown) clearInterval(e.softcountdown);
                                });
                                current.clear();
                            });

                        }

                        // erase any items which were not returned
                        if (resultdata.length > 0 && typeof(current) !== "undefined") {

                            for(var j=current.length-1;j>=0;j--) {
                                
                                //App.log('updateCurrent() Searching for found=0. current length is '+current.length+'. index '+j+' - found:'+current[j].get('found'));
                            
                                if (current[j].get('found') === 0) {
                                    //App.log('updateCurrent() Erasing index '+j+ ' current length is '+current.length);
                                    _removeAndAnimate(j);
                                } else {
                                    //App.log('updateCurrent() Item found at index '+j+'. Nothing to erase from current.');
                                }
                            }
                        }
                        
                        // set the new current array back into the controller
                        that.set('current', current);
                        
                        // Kick off the countdown again (which runs the bar chart and/or any other animations)        
                        that.startCountdown(App.mainView);
                    }

                    // private helper function
                    function _removeAndAnimate(idx) {
                        $('#current-'+current[idx].servicestatus_id).slideUp('slow', function(){

                                if (current[idx] && current[idx].softcountdown) clearInterval(current[idx].softcountdown);
                                //App.log('updateCurrent() before removeAt():');
                                //App.log(current);
                                current.removeAt(idx);
                            });
                    }

                } // end success
            });
        },

        updateAcked: function() {
            
            var that = this;
            
            //TODO: fix ACKed. Its broken right now.
            
            //$('#current-spinner').show();
            
            // request the page
            $.ajax({
                type: "GET",
                url: "api.php",
                data: "func=acked",
                dataType: "json",
                success: function(data){
        
                    //$('#current-spinner').fadeOut('slow');
                    
                    if (data) {
                    
                        var metadata = data[0];
                        var resultdata = data[1];
                        
                        
                        //App.log('acked set');
                        //App.log(typeof(acked));
                        
                        
                        //App.currentController.set('acked', resultdata);
                    }
                }
            });
        },
        
        updateHistory: function() {
            
            var that = this;
            
            $('#notifications-spinner').show();
            
            $.ajax({
                type: "GET",
                url: "api.php",
                data: "func=history&maxcount="+maxCountNotification+"&lastid="+that.lastIdNotification,
                dataType: "json",
                success: function(data){
                    
                    $('#notifications-spinner').fadeOut('slow');
                    
                    if (data) {
                        
                        var metadata = data[0];
                        var resultdata = data[1]["result"];
                          
                        if (resultdata.length > 0) that.lastIdNotification = resultdata[0].notification_id;
                                      
                        // Loop through all returned data and write to screen
                        if (resultdata.length != 0) {
                                           
                            var oldhistoryarray = that.get('history');
                            
                            // create an ember array if one does not exist
                            if (typeof(oldhistoryarray) === "undefined") oldhistoryarray = Ember.A();
                        
                            oldhistoryarray.reverse();  
                            
                            var temphistoryarray = Ember.A();
                                                        
                            for (var i=resultdata.length-1; i>=0; i--) {
                                // only add this item if it does not already exist on the page
                                if ($('#notification-'+resultdata[i].notification_id).length == 0) {
                                    
                                    //* give us the minutes since the previous history element */
                                    // subtract start_time from current time
                                    var date1;
                                    var date2 = new Date(Date.parse(resultdata[i].start_time));
                                    if (oldhistoryarray.length > 0) {
                                    
                                        //date1 = new Date(oldhistoryarray[oldhistoryarray.length-1].start_time);
                                        
                                        date1 = new Date(Date.parse(oldhistoryarray[oldhistoryarray.length-1].start_time));
                                        App.log('updateHistory() oldhistoryarray got date '+date1);
                                        
                                    } else if(temphistoryarray.length > 0) {
                                    
                                        //var datestring = Date.parse(temphistoryarray[temphistoryarray.length-1].start_time);
                                        
                                        //date1 = new Date(temphistoryarray[temphistoryarray.length-1].start_time);
                                        date1 = new Date(Date.parse(temphistoryarray[temphistoryarray.length-1].start_time));
                                        
                                        //App.log('date1');
                                        //App.log(temphistoryarray[temphistoryarray.length-1].start_time);
                                        //App.log(date1);
                                        
                                        //App.log('updateHistory() temphistory got date '+date1);
                                        
                                    } else {
                                        // FIXME: last one on the page falls into this
                                        App.log('updateHistory() noarrays');
                                        date1 = new Date();
                                    }
                                    var diff = date2.getTime() - date1.getTime();
                                    diff = diff/(60*1000);
                                    diff = diff.toFixed(0);
                                    
                                    // set it
                                    resultdata[i].since = diff;
                                    //* give us the minutes since the previous history element */
                                    
                                    temphistoryarray.pushObject(App.Item.create(resultdata[i]));
                                }
                            }
                            
                            var newhistoryarray = oldhistoryarray.concat(temphistoryarray);
                            //var newhistoryarray = temphistoryarray.concat(oldhistoryarray);
                            


                            newhistoryarray.reverse(); 
                                                        
                            for(var j=0;j<newhistoryarray.length;j++) {
                                newhistoryarray[j].set('first', false);
                            }
                            
                            //if (typeof(newhistoryarray) !== "undefined" && newhistoryarray.length > 0) {
                            newhistoryarray[0].set('first', true);
                            //}

                            // erase any history more than the maxCountNotification
                            //
                            //
                            for(var j=maxCountNotification;j<newhistoryarray.length;j++) {
                              console.info("Erasing extra history item "+j+".");
                              newhistoryarray.removeAt(j);
                            }
                            

                            that.set('history', newhistoryarray);  // need to appendChild
                        }
                    }
                    
                    // update history even if no new data
                    that.updateHistoryAgo();
                }
            });   
        },
        
        
        
        
        
        
        
        
        // For each history item, update ago, seconds_ago, and minutes_ago values
        updateHistoryAgo: function() {
        
            var that = this;
            
            var history = that.get('history');
            var date2 = new Date(); //now
            var diffhours = that.get('timeZoneDiffHours');
                        
            // for each item in the history, update the 'ago' value
            for (var h=history.length-1; h>=0; h--) {
            
                // subtract start_time from current time
                var date1 = new Date(Date.parse(history[h].start_time));
                date1.addHours(-diffhours);
                
                var diff = date2.getTime() - date1.getTime();
                var diff = date2 - date1;
                
                var seconds = (diff/1000).toFixed(0);
                var minutes = (diff/(60*1000)).toFixed(0);
                diff = diff/(60*1000);
                diff = diff.toFixed(0);
                
                history[h].set('ago', diff);
                history[h].set('seconds_ago', seconds);
                history[h].set('minutes_ago', minutes);
            }
        }
    });
    

    App.mainView = Ember.View.create({
        
        //currentDisconnected: true,
        
        // TODO: get teh controller not via this global way, but from the contextbinding or something
        
        templateName: 'main-view',
        //name: "No Name",
        totalGateways: -1,
        
        
        currentDisconnected: function() {
            //App.log('currentDisconnected() '+App.currentController.current.length);
            return App.currentController.currentDisconnected;
        }.property("App.currentController.currentDisconnected"),
           
        didInsertElement: function() {
            //App.log('mainView didInsertElement');
            //App.log(this.$());
        },
        
        currentEmpty: function() {
            App.log('currentEmpty() '+App.currentController.current.length);
            if (App.currentController.current.length > 0) {
                return false;
            } else {
                return true;
            }
        }.property("App.currentController.current.length"),
        
        
        
        timerPercent:100,
        timerWidth: function() {
            return "width:"+this.timerPercent+"%";
        }.property("timerPercent"),

        
        didInsertElement: function() {
            if (config_servername) {
                this.set('name', config_servername);
            }
            
            
            
            if (config_icon) {
                $('#config_icon').attr('src', config_icon);
            }
   
            /*
            $('#remoteTimeDiv').click(function(){
                $('#clockinfo').slideToggle();
            });
            */
            
            /*
            $('#remoteTimeDiv').hover(
              function(){
                //in
                //console.info('here');
                $('#clockinfo').slideDown();
              },
              function(){
                //out
                $('#clockinfo').slideUp();
            });
            */
            
        }

    });


    App.mainView.appendTo('#col1');
    
    
    App.barCurrent = Ember.View.create({
        
        templateName: 'bar-chart',
        name: "Nagios Debian",
        totalGateways: -1,
        
        timerPercent:100,
        timerWidth: function() {
            return "width:"+App.mainView.get('timerPercent')+"%";
        }.property("App.mainView.timerPercent"),
        
        bgColor: function() {
        
            return "bggray";
            //return "bggreen";
            //return "bgyellow";
            //return "bgred";
            
        }.property("App.currentController.current")
    });
    App.barCurrent.appendTo('#barAreaCurrent');
    
       
    App.currentOkView = Ember.View.extend({
       tagName: 'div',
        classNames: ['displayNone'],
        templateName: 'current-ok',
        didInsertElement: function() { 
            this.$().slideDown('slow');
        }
    });
    
    App.currentDisconnectedView = Ember.View.extend({
       tagName: 'div',
        classNames: ['displayNone'],
        templateName: 'current-disconnected',
        didInsertElement: function() { 
            this.$().slideDown('slow');
        }
    });
    
    App.historyItemView = Ember.View.extend({

        tagName: 'div',
        classNames: ['displayNone'],
        templateName: 'history-item',
        
        stringAgo: function() {
        
            var content = this.bindingContext;
            var seconds = content.seconds_ago;
            
            var numdays = Math.floor(seconds / 86400);
            var numhours = Math.floor((seconds % 86400) / 3600);
            var numminutes = Math.floor(((seconds % 86400) % 3600) / 60);
            var numseconds = ((seconds % 86400) % 3600) % 60;
            
            return numdays + " days " + numhours + " hours " + numminutes + " minutes " + numseconds + " seconds";

        }.property("this.bindingContext.ago"),
        
        firstTimespan: function() {
        
            var content = this.bindingContext;
                        
            if (content.first) {
                return true;
            } else {
                return false;
            }
        }.property("this.bindingContext.first"),
        
        largeTimespan: function() {
        
            var content = this.bindingContext;
                        
            if (content.since > 30) {
                return true;
            } else {
                return false;
            }
        }.property("this.bindingContext.since"),
        
        didInsertElement: function() {
            this.$().slideDown('slow');
        }
        
    });
    
    App.currentItemView = Ember.View.extend({

        tagName: 'div',
        classNames: ['displayNone'],
        templateName: 'current-item',


        softtimerPercent:100,
        softtimerWidth: function() {
            return "width:"+this.softtimerPercent+"%";
        }.property("softtimerPercent"),

        bgColor: function() {
        
            //return "bggreen";
            return "bgyellow";
            //return "bgred";
            
        }.property(),

        startsoftCountdown: function() {

            var that=this;

            var count = 60 - 1;
            var origcount = 60;
            
            clearInterval(that.softcountdown);
            
            that.set('softtimerPercent','100');
            that.softcountdown = setInterval(function(){
           
                
                var pct = ((count-1) / origcount)*100;
                that.set('softtimerPercent',pct);
                
                // set the piecon to the percent as well
                //Piecon.setProgress(pct);
                
                if (count == 0) {
                    clearInterval(that.softcountdown);
                }
                count--;
            }, 1000);
        },



        click: function() {
            App.log('currentItemView() click()');
            this.$().find('.eventDetail').slideToggle();
        },
                
        currentStateClass: function() {
          
            var content = this.bindingContext;

            var current_state = content.current_state;
            
            App.log('currentItemView() currentStateClass() current_state '+current_state);
            
            if (current_state === "1") {
                return "state1";
            } else if(current_state === "2") {
                return "state2";
            } else {
                return "state";
            }
            
        }.property('this.bindingContext.current_state'),
        
        stateTypeName: function() {
        
            var content = this.bindingContext;
            
            App.log('currentItemView() stateTypeName state_type '+content.state_type);
               
            if (content.state_type === "0") {

                // TODO: fix and re-enable this
                //this.startsoftCountdown();

                return "SOFT";
            } else if(content.state_type === "1") {
                return "HARD";
            } else {
                return "UNKNOWN";
            }
            
        }.property('this.bindingContext.state_type'),
        
        isSoft: function() {
        
            var content = this.bindingContext;
         
            App.log('currentItemView() isSoft state_type '+content.state_type);
            
            if (content.state_type === "0") {
                return true;
            } else if(content.state_type === "1") {
                return false;
            } else {
                return false;
            }
            
        }.property('this.bindingContext.state_type'),
        
        downFor: function() {
        
            var content = this.bindingContext;

            var that = this;
            var diffhours = App.currentController.get('timeZoneDiffHours');
            var date1 = new Date(Date.parse(content.last_state_change));
            
            date1.addHours(-diffhours);
         
            var remotedate = App.currentController.get("remoteTimeObject");

            var diff = remotedate - date1;

            var seconds = (diff/1000).toFixed(0);
            //seconds = seconds + (diffhours*3600);
            
            
            
            
            //var seconds = content.seconds_ago;
            
            var numdays = Math.floor(seconds / 86400);
            var numhours = Math.floor((seconds % 86400) / 3600);
            var numminutes = Math.floor(((seconds % 86400) % 3600) / 60);
            var numseconds = ((seconds % 86400) % 3600) % 60;
            
            return numdays + "d " + numhours + "h " + numminutes + "m " + numseconds + "s";
            
            
            
            //
            
            
            //return diff;
            
        }.property('App.mainView.timerPercent'),
        
        didInsertElement: function() {
            
            this.$().slideDown('slow');
        }
    });
}

function updateTime() {

    var localdate = new timezoneJS.Date(new Date().toString(), config_timezone);
    
    $('#localTime').html(localdate.toString());

}

function cancelTimers() {

    clearTimeout(g_timerCurrent);
    clearTimeout(g_timerAcked);
    clearTimeout(g_timerHistory);

}

var g_timerCurrent;
var g_timerAcked;
var g_timerHistory;

$(document).ready(function(){

    // Init the TimeZone libraries
    timezoneJS.timezone.zoneFileBasePath = 'lib/timezone-js/tz';
    timezoneJS.timezone.init();

    // This hides the jQuery warning
    $('#jquery-test').hide();
    
    // Load up the EmberJS framework
    emberStart();

    // Version Check
    App.currentController.versionCheck();
   
    // Some welcome console info
    App.log('Welcome to Nagios Stats.');
    App.log('Current refresh is set to '+refreshCurrent+' seconds');
    App.log('Acked refresh is set to '+refreshAcked+' seconds');
    App.log('History refresh is set to '+refreshNotification+' seconds');
    
    
    // Kick off the update timers
    App.currentController.updateCurrent(); // Update current Now
    g_timerCurrent = setInterval("App.currentController.updateCurrent()", refreshCurrent * 1000); // Update page every n seconds
    
    App.currentController.updateAcked();
    g_timerAcked = setInterval("App.currentController.updateAcked()", refreshAcked * 1000);
    
    App.currentController.updateHistory();
    g_timerHistory = setInterval("App.currentController.updateHistory()", refreshNotification * 1000);
    
    setInterval("updateTime()", 1000);

});
