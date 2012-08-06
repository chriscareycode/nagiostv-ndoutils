/*******************************************************************************
 * 
 * Nagios TV Monitor
 * by Christopher P Carey 2010-12-09
 * 
 * main.js
 *
 ******************************************************************************/



var refreshCurrent = 10; // in seconds
var refreshAcked = 31; // in seconds
var refreshNotification = 16; // in seconds





var refreshCount = 0; // counts up each refresh
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
                    
                        var current = App.currentController.get('current');
                        
                        if (typeof(current) === "undefined") current = [];
                        
                        for(var j=0;j<current.length;j++) {
                            current[j].set('found', 0);
                        }
                        
                        // We can't just blindly replace all the data. Thats sloppy as hell yo
                        for(var i=0;i<data.length;i++) {
                        
                            // search for a existing record
                            var found = false;
                            for(var j=0;j<current.length;j++) {
                                if (current[j].servicestatus_id === data[i].servicestatus_id) {
                                    current[j].set('state_type', data[i].state_type);
                                    current[j].set('current_state', data[i].current_state);
                                    current[j].set('next_check', data[i].next_check);
                                    current[j].set('output', data[i].output);
                                    current[j].set('found', 1);
                                    found = true;
                                }
                            }                
                            if (!found) {
                                // item was returned and it was not found. lets add it into the array of items
                                App.log('updateCurrent() new item');
                                App.log(data[i]);
                                
                                current.pushObject( App.Item.create(data[i]) );
                            }
                        }
                        
                        // todo: backwards
                        // erase any items which were not returned
                        if (typeof(current) !== "undefined") {
                            for(var j=current.length-1;j>=0;j--) {
                                App.log('updateCurrent() Searching index '+j+' - found:'+current[j].get('found'));
                            
                                if (current[j].get('found') === 0) {
                                    App.log('updateCurrent() Erasing index '+j+ 'current length is '+current.length);
                                    
                                    $('#current-'+current[j].servicestatus_id).slideUp('slow', function(){
                                        
                                        try {
                                            current.removeAt(j);
                                        } catch(err) {
                                            App.log('remove Error:'+err);
                                            App.log(current);
                                        }
                                    });
                                } else {
                                    App.log('updateCurrent() Item found at index '+j+'. Nothing to erase from current.');
                                }
                            }
                        }
                        
                        
                        
                        // replace some of the items
                        App.currentController.set('current', current);
                                 
                        that.startCountdown(App.mainView);
                    }
                }
            });
        },
        
        updateAcked: function() {
                
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
                        App.currentController.set('acked', data);
                    }
                }
            });
        },
        
        updateHistory: function() {
            
            $('#notifications-spinner').show();
            
            $.ajax({
                type: "GET",
                url: "api.php",
                data: "func=history&maxcount="+maxCountNotification+"&lastid="+App.currentController.lastIdNotification,
                dataType: "json",
                success: function(data){
                    
                    $('#notifications-spinner').fadeOut('slow');
                    
                    if (data) {
                                    
                        if (data.length > 0) App.currentController.lastIdNotification = data[0].notification_id;
                                      
                        // Loop through all returned data and write to screen
                        if (data.length != 0) {
                                           
                            var oldhistoryarray = App.currentController.get('history');
                            oldhistoryarray.reverse();  
                            
                            var temphistoryarray = Ember.A();
                            
                            for (var i=data.length-1; i>=0; i--) {
                                // only add this item if it does not already exist on the page
                                if ($('#notification-'+data[i].notification_id).length == 0) {
                                    
                                    //* give us the minutes since the previous history element */
                                    // subtract start_time from current time
                                    var date1;
                                    var date2 = new Date(data[i].start_time);
                                    if (oldhistoryarray.length > 0) {
                                    
                                        date1 = new Date(oldhistoryarray[oldhistoryarray.length-1].start_time);
                                        App.log('updateHistory() oldhistoryarray got date '+date1);
                                        
                                    } else if(temphistoryarray.length > 0) {
                                    
                                        date1 = new Date(temphistoryarray[temphistoryarray.length-1].start_time);
                                        App.log('updateHistory() temphistory got date '+date1);
                                        
                                    } else {
                                        // FIXME: last one on the page falls into this
                                        App.log('updateHistory() noarrays');
                                        date1 = new Date();
                                    }
                                    var diff = date2.getTime() - date1.getTime();
                                    diff = diff/(60*1000);
                                    diff = diff.toFixed(0);
                                    
                                    // set it
                                    data[i].since = diff;
                                    //* give us the minutes since the previous history element */
                                    
                                    temphistoryarray.pushObject(App.Item.create(data[i]));
                                }
                            }
                            
                            var newhistoryarray = oldhistoryarray.concat(temphistoryarray);
                            newhistoryarray.reverse(); 
                            
                            for(var j=0;j<newhistoryarray.length;j++) {
                                newhistoryarray[j].set('first', false);
                            }
                            newhistoryarray[0].set('first', true);
                                                
                            App.currentController.set('history', newhistoryarray);  // need to appendChild
                        }
                    }
                    
                    // update history even if no new data
                    App.currentController.updateHistoryAgo();
                }
            });   
        },
        
        
        
        
        
        
        
        
        // For each history item, update ago, seconds_ago, and minutes_ago values
        updateHistoryAgo: function() {
        
            var history = App.currentController.get('history');
            
            // for each item in the history, update the 'ago' value
            for (var h=history.length-1; h>=0; h--) {
                // subtract start_time from current time
                var date1 = new Date(history[h].start_time);
                var date2 = new Date();
                
                var diff = date2.getTime() - date1.getTime();
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
        
        templateName: 'stats',
        //name: "No Name",
        totalGateways: -1,
        
        timerPercent:100,
        timerWidth: function() {
            return "width:"+this.timerPercent+"%";
        }.property("timerPercent"),
        
        
       
        
        didInsertElement: function() {
            if (servername) {
                //App.log('settingname');
                this.set('name', servername);
            }
        }
    });
    App.mainView.appendTo('#col1');
    
    
    App.barCurrent = Ember.View.create({
        //content: [],
        //current: [],
        //acked: [],
        //history: [],
        templateName: 'bar-chart',
        name: "Nagios Debian",
        totalGateways: -1,
        
        timerPercent:100,
        timerWidth: function() {
            return "width:"+App.mainView.get('timerPercent')+"%";
        }.property("App.mainView.timerPercent"),
        
        bgColor: function() {
        
            return "bggreen";
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
            
            //App.log('firstTimespan');
            //App.log(content);
            
            //var position = jQuery.inArray(this, content);
            //App.log(position);
            
            if (content.first) {
                return true;
            } else {
                return false;
            }
        }.property("this.bindingContext.first"),
        
        largeTimespan: function() {
        
            var content = this.bindingContext;
            
            //App.log('largeTimespan');
            //App.log(content);
            
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

        click: function() {
            App.log('currentItemView() click()');
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
        
        didInsertElement: function() {
            
            this.$().slideDown('slow');
        }
    });
}

function updateTime() {

    // TODO: perform this with a timestamp sent down from the server
    var now = new Date();
    var hours = now.getHours(); if (hours < 10) hours = '0'+hours;
    var minutes = now.getMinutes(); if (minutes < 10) minutes = '0'+minutes;
    var seconds = now.getSeconds(); if (seconds < 10) seconds = '0'+seconds;
    //datePageLoad = hours +':'+ minutes +':'+ seconds;
    var str = hours + ':' + minutes + ':' + seconds;
    $('#currentTime').html(str);
}

$(document).ready(function(){

    

    
    // This hides the jQuery warning
    $('#jquery-test').hide();
    //return;

    

    
    /*
    var now = new Date();
    var hours = now.getHours(); if (hours < 10) hours = '0'+hours;
    var minutes = now.getMinutes(); if (minutes < 10) minutes = '0'+minutes;
    var seconds = now.getSeconds(); if (seconds < 10) seconds = '0'+seconds;
    datePageLoad = hours +':'+ minutes +':'+ seconds;
    */
    
    emberStart();
    
    App.log('Welcome to Nagios Stats.');
    App.log('Current refresh is set to '+refreshCurrent+' seconds');
    App.log('Acked refresh is set to '+refreshAcked+' seconds');
    App.log('History refresh is set to '+refreshNotification+' seconds');
    
    App.currentController.updateCurrent(); // Update current Now
    setInterval("App.currentController.updateCurrent()", refreshCurrent * 1000); // Update page every n seconds
    
    App.currentController.updateAcked();
    setInterval("App.currentController.updateAcked()", refreshAcked * 1000);
    
    App.currentController.updateHistory();
    setInterval("App.currentController.updateHistory()", refreshNotification * 1000);
    
    setInterval("updateTime()", 1000);
});
