/*******************************************************************************
 * 
 * Nagios TV Monitor
 * by Christopher P Carey - Dec 09 2010
 * Last Modified - Feb 20 2013
 * 
 * Update for EmberJS 1.0.0 RC
 *
 * main.js
 *
 ******************************************************************************/




/*******************************************************************************
 * Document Ready
 ******************************************************************************/

function ember_setup() {

	// Create the Ember Application
	window.App = Ember.Application.create();  

	// Create App.Item template
	App.Item = Em.Object.extend();
	
	// Use this for logging
	App.log = function(msg){
		if (window.console) console.info(msg);
	};
	
	// Set up Ember Routing
	/*
	App.Router.map(function() {
		this.route("about", { path: "/about" });
		this.route("detail", { path: "/detail" });
	});

	App.IndexRoute = Ember.Route.extend({
		setupController: function(controller) {
			// Set the IndexController's `title`
			controller.set('title', "My App");
		}
	});
	*/
	
}

function ember_setup_controllers() {

	App.ApplicationController = Ember.ArrayController.extend({

		name: 'NagiosTV',
		
		current: [],
		acked: [],
		history: [],
		
		refreshCurrent: 30,
		refreshAcked: 31,
		refreshNotification: 16,
		maxCountNotification: 30,
		
		timerCurrent: null,
		timerAcked: null,
		timerHistory: null,
		
		versionMismatch: false,
		version: '6',
		versionString:'0.6',
		versionServer: '',
		versionStringServer: '',

		remoteTime: '',
		remoteTimeObject: 0,
		remoteTimeZone: config_timezone || 'US/Pacific',

		timeZoneDiffHours: 0,
		currentDisconnected: true,
		lastIdNotification: 0,


		versionCheck: function() {

			var that=this;
							
			if (!config_version_check) {
				App.log('versionCheck() Disabled');
				return;
			}

			App.log('versionCheck() Starting');
			
			$.ajax({
				type: "POST",
				url: "api.php",
				data: "func=versioncheck&client_version="+that.get('versionCurrent'),
				dataType: "json",
				timeout: 5000,
				error: function(data1, data2) {
					App.log('versionCheck() Error getting version');
					cancelTimers();
				},
				success: function(data){

					App.log('VersionCheck success, ');
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

		startCountdown: function(obj) {

			var that = this;
			var count = that.get('refreshCurrent') - 1;
			var origcount = that.get('refreshCurrent');

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
			
			$.ajax({
				type: "GET",
				url: "api.php",
				data: "func=current",
				dataType: "json",
				timeout: 5000,
				error: function(data1, data2) {
					that.set('currentDisconnected', true);
					var jsondata = eval('(' + data1.responseText + ')');
					if (jsondata.OK == 0) {
						App.log('updateCurrent() JSON Error');
						$('#disconnected').html(jsondata.ERROR);
					}
					cancelTimers();
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
							var diff = remotetime.getHours() - localdate.getHours();
							that.set('timeZoneDiffHours', diff);

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
								//console.info('foreach clearInterval '+e);
								//console.info('foreach clearInterval '+e.softcountdown);
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
						
						$('#acked-spinner').show();
						
						// request the page
						$.ajax({
								type: "GET",
								url: "api.php",
								data: "func=acked",
								dataType: "json",
								success: function(data){
				
										//App.log('updateAcked() success');
										//App.log(data);
										
				
										//that.set('currentDisconnected', false);
										
										$('#acked-spinner').fadeOut('slow');
										
										if (data) {
												
												var metadata = data[0];
												var resultdata = data[1]["result"];
												
												//App.log('updateAcked() resultdata.length is '+resultdata.length);
												
												if (!resultdata) {
														return;
												}
												
												
										
												// grab the current list of items
												var acked = that.get('acked');
												//App.log('updateAcked() acked.length is '+acked.length);
												
												// create an ember array if one does not exist
												if (typeof(acked) === "undefined") acked = Ember.MutableArray();
												
												// set the found bit on each item to 0. we will check for this bit later
												// to compare the existing list of items against the one the server sends down
												for(var j=0;j<acked.length;j++) {
														//App.log('updateAcked() setting found to 0 on item '+j);
														acked[j].set('found', 0);
												}
												

												// aliases to keep inner loop fast
												var cachedRes, newRes, found; 

												// We can't just blindly replace all the data. Thats sloppy as hell yo
												// loop through the returned data and take a look at what we've got
												for(var i=0;i<resultdata.length;i++) {
												
														// search for a existing record
														found = false;
														newRes = resultdata[i];

														for(var j=0;j<acked.length;j++) {
																cachedRes = acked[j];
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
																//App.log('updateAcked() new item');
																//App.log(resultdata[i]);
																
																// add this new item into the current array
																acked.pushObject( App.Item.create(newRes) );

														}
												}
												
												// If the server returns nothing, lets clear the items out all at once. 
												// Fixes the delayed All services are UP bug
												if (resultdata.length === 0) {

														$('.ackeditem').slideUp('slow', function(){

																acked.forEach(function(e) {
																	console.info('foreach clearInterval '+e);
																	console.info('foreach clearInterval '+e.softcountdown);
																	if (e && e.softcountdown) clearInterval(e.softcountdown);
																});
																acked.clear();
														});

												}

												// erase any items which were not returned
												if (resultdata.length > 0 && typeof(acked) !== "undefined") {

														for(var j=acked.length-1;j>=0;j--) {
																
																//App.log('updateAcked() Searching for found=0. acked length is '+acked.length+'. index '+j+' - found:'+acked[j].get('found'));
														
																if (acked[j].get('found') === 0) {
																		//App.log('updateAcked() Erasing index '+j+ ' acked length is '+acked.length);
																		_removeAndAnimate(j);
																} else {
																		//App.log('updateAcked() Item found at index '+j+'. Nothing to erase from acked.');
																}
														}
												}
												
												// set the new current array back into the controller
												that.set('acked', acked);
												
												// Kick off the countdown again (which runs the bar chart and/or any other animations)        
												//that.startCountdown(App.mainView);
										}

										// private helper function
										function _removeAndAnimate(idx) {
												$('#acked-'+acked[idx].servicestatus_id).slideUp('slow', function(){

																if (acked[idx] && acked[idx].softcountdown) clearInterval(acked[idx].softcountdown);
																//App.log('updateCurrent() before removeAt():');
																//App.log(current);
																acked.removeAt(idx);
														});
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
								data: "func=history&maxcount="+App.applicationController.get('maxCountNotification')+"&lastid="+that.lastIdNotification,
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
																		
																		//give us the minutes since the previous history element 
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

																		resultdata[i].since_raw = diff;

																		diff = diff/(60*1000);
																		diff = diff.toFixed(0);
																		
																		// set it
																		
																		resultdata[i].since = diff;
																		// give us the minutes since the previous history element
																		
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

														// erase any history more than the g_maxCountNotification
														//
														//
														for(var j=that.get('maxCountNotification');j<newhistoryarray.length;j++) {
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
								//date1.addHours(-diffhours);
								
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
		App.applicationController = App.ApplicationController.create();
		

	App.MainView = Ember.View.extend({
				
				
				
				templateName: 'main-view',

				totalGateways: -1,
				
				
				currentDisconnected: function() {
						//App.log('currentDisconnected() '+App.applicationController.current.length);
						return App.applicationController.currentDisconnected;
				}.property("App.applicationController.currentDisconnected"),
					 
				didInsertElement: function() {
						//App.log('mainView didInsertElement');
						//App.log(this.$());
				},
				
				currentEmpty: function() {
						App.log('currentEmpty() '+App.applicationController.current.length);
						if (App.applicationController.current.length > 0) {
								return false;
						} else {
								return true;
						}
				}.property("App.applicationController.current.length"),
				
				ackedEmpty: function() {
						App.log('ackedEmpty() '+App.applicationController.get('acked').length);
						if (App.applicationController.get('acked').length > 0) {
								return false;
						} else {
								return true;
						}
				}.property("App.applicationController.acked.length"),
				
				
				timerPercent:100,

				
				timerWidth: function() {
						return "width:"+this.timerPercent+"%";
				}.property("timerPercent"),

				
				didInsertElement: function() {
				
						this.set('name', 'Nagios');
						if (config_servername) {
								//this.set('name', config_servername);
								App.applicationController.set('name', config_servername);
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
		App.mainView = App.MainView.create();

		App.mainView.appendTo('#col1');
		
		
		App.BarCurrent = Ember.View.extend({
				
				templateName: 'bar-chart',

				
				timerPercent:100,
				
				timerWidth: function() {
						return "width:"+App.mainView.get('timerPercent')+"%";
						//return "width:50%";
				}.property("App.mainView.timerPercent"),
				
				bgColor: function() {
				
					var found_crit = false;
					var found_warn = false;
					var current = App.applicationController.get('current');


					// find out if there are any criticals
					for(var j=0;j<current.length;j++) {
						App.log(current[j].get('current_state'));
						if (current[j].get('current_state') == 2) found_crit = true;
					}
					// find out if there are any warnings
					for(var j=0;j<current.length;j++) {
						if (current[j].get('current_state') == 1) found_warn = true;
					}

					if (found_crit) {
						return "bgred";
					} else if (found_warn) {
						return "bgyellow";
					} else {
						return "bggreen";
						//return "bggray";
					}
						
					
						
						
						
				}.property("App.applicationController.current.length"),

				howManySeconds: function() {
						return "width:"+App.applicationController.get('refreshCurrent');
				}.property("App.applicationController.refreshCurrent")


		});
		App.barCurrent = App.BarCurrent.create();
		
		//App.barCurrent.appendTo('#barAreaCurrent');
		
			 
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
		
		App.ackedOkView = Ember.View.extend({
			 tagName: 'div',
				//classNames: ['displayNone'],
				templateName: 'acked-ok',
				didInsertElement: function() { 
						this.$().slideDown('slow');
				}
		});
		
		App.historyItemView = Ember.View.extend({

				tagName: 'div',
				classNames: ['displayNone'],
				templateName: 'history-item',
				
				stringAgo: function() {
				
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}
						
						
						var seconds = content.seconds_ago;
						
						var numdays = Math.floor(seconds / 86400);
						var numhours = Math.floor((seconds % 86400) / 3600);
						var numminutes = Math.floor(((seconds % 86400) % 3600) / 60);
						var numseconds = ((seconds % 86400) % 3600) % 60;
						
						return numdays + " days " + numhours + " hours " + numminutes + " minutes " + numseconds + " seconds";

				}.property("this._context.ago"),

				firstTimespan: function() {
				
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}
						
						if (content.first) {
								return true;
						} else {
								return false;
						}
				}.property("this._context.first"),
				
				largeTimespan: function() {
				
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}
						
						if (content.since > 30) {
								return true;
						} else {
								return false;
						}
				}.property("this._context.since"),
				
				stateClass: function() {
					
						
						var content = this._context;

						if (typeof(content) == "undefined") {
							App.log('currentItemView() stateClass() this._context undefined ');
							return false;
						}
						var state = content.state;
						
						//App.log('currentItemView() stateClass() current_state '+state);
						
						if (state === "1") {
								return "state1";
						} else if(state === "2") {
								return "state2";
						} else {
								return "state";
						}
						
				}.property('this._context.state'),

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
					
						
						var content = this._context;

						if (typeof(content) == "undefined") {
							App.log('currentItemView() currentStateClass() this._context undefined ');
							return false;
						}
						var current_state = content.current_state;
						
						App.log('currentItemView() currentStateClass() current_state '+current_state);
						
						if (current_state === "1") {
								return "state1";
						} else if(current_state === "2") {
								return "state2";
						} else {
								return "state";
						}
						
				}.property('this._context.current_state'),

				
				
				stateTypeName: function() {
				
					//console.dir(this);
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}
						
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
						
				}.property('this._context.state_type'),
				
				isSoft: function() {
				
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}
						App.log('currentItemView() isSoft state_type '+content.state_type);
						
						if (content.state_type === "0") {
								return true;
						} else if(content.state_type === "1") {
								return false;
						} else {
								return false;
						}
						
				}.property('this._context.state_type'),
				
				downFor: function() {
				
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}
						
						var that = this;
						var diffhours = App.applicationController.get('timeZoneDiffHours');
						var date1 = new Date(Date.parse(content.last_state_change));
						
						date1.addHours(-diffhours);
				 
						var remotedate = App.applicationController.get("remoteTimeObject");

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
						
				}.property('App.applicationController.remoteTimeObject'),

				downForMinutes: function() {
				
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}

						

						var last_state_change = new Date(Date.parse(content.last_state_change));
						var diff = new Date() - last_state_change;
						var numminutes = Math.floor(diff / 86400);
						
						/*console.info('downForMinutes');
						console.dir (new Date());
						console.dir (last_state_change);
						console.dir (diff);
						console.dir (numminutes);
*/
						return numminutes;
						
				}.property('App.applicationController.remoteTimeObject'),
				
				didInsertElement: function() {
						
						this.$().slideDown('slow');
				}
		});
		
		App.ackedItemView = Ember.View.extend({

				tagName: 'div',
				classNames: ['displayNone'],
				templateName: 'acked-item',


				softtimerPercent:100,
				softtimerWidth: function() {
						return "width:"+this.softtimerPercent+"%";
				}.property("softtimerPercent"),

				bgColor: function() {
				
						//return "bggreen";
						return "bgyellow";
						//return "bgred";
						
				}.property(),

				



				click: function() {
						App.log('ackedItemView() click()');
						this.$().find('.eventDetail').slideToggle();
				},
								
				currentStateClass: function() {
					
						var content = this._context;

						var current_state = content.current_state;
						
						App.log('ackedItemView() currentStateClass() current_state '+current_state);
						
						if (current_state === "1") {
								return "state1";
						} else if(current_state === "2") {
								return "state2";
						} else {
								return "state";
						}
						
				}.property('this._context.current_state'),
				
				stateTypeName: function() {
				
						var content = this._context;
						
						App.log('ackedItemView() stateTypeName state_type '+content.state_type);
							 
						if (content.state_type === "0") {

								// TODO: fix and re-enable this
								//this.startsoftCountdown();

								return "SOFT";
						} else if(content.state_type === "1") {
								return "HARD";
						} else {
								return "UNKNOWN";
						}
						
				}.property('this._context.state_type'),
				
				isSoft: function() {
				
						var content = this._context;
				 
						App.log('ackedItemView() isSoft state_type '+content.state_type);
						
						if (content.state_type === "0") {
								return true;
						} else if(content.state_type === "1") {
								return false;
						} else {
								return false;
						}
						
				}.property('this._context.state_type'),
				
				downForMinutes: function() {
				
						var content = this._context;
						if (typeof(content) == "undefined") {
							return false;
						}

						

						var last_state_change = new Date(Date.parse(content.last_state_change));
						var diff = new Date() - last_state_change;
						var numminutes = Math.floor(diff / 86400);
						
						/*console.info('downForMinutes');
						console.dir (new Date());
						console.dir (last_state_change);
						console.dir (diff);
						console.dir (numminutes);
*/
						return numminutes;
						
				}.property('App.applicationController.remoteTimeObject'),
								
				didInsertElement: function() {
						
						this.$().slideDown('slow');
		}
	});
		
}

function updateTime() {    
	$('#localTime').html(new timezoneJS.Date(new Date().toString(), config_timezone).toString());
}

function cancelTimers() {

	clearTimeout(App.applicationController.get('timerCurrent'));
	clearTimeout(App.applicationController.get('timerAcked'));
	clearTimeout(App.applicationController.get('timerHistory'));
}

$(document).ready(function(){

	// Init the TimeZone libraries
	timezoneJS.timezone.zoneFileBasePath = 'lib/timezone-js/tz';
	timezoneJS.timezone.init();

	// This hides the jQuery warning
	$('.welcome').hide();

	// Load up the EmberJS framework
	ember_setup();
	ember_setup_controllers();

	// Version Check
	App.applicationController.versionCheck();

	// Some welcome console info
	App.log('Welcome to Nagios Stats.');
	App.log('Current refresh is set to '+App.applicationController.get('refreshCurrent')+' seconds');
	App.log('Acked refresh is set to '+App.applicationController.get('refreshAcked')+' seconds');
	App.log('History refresh is set to '+App.applicationController.get('refreshNotification')+' seconds');


	// Kick off the update timers
	App.applicationController.updateCurrent(); // Update current Now
	App.applicationController.set('timerCurrent', setInterval("App.applicationController.updateCurrent()", App.applicationController.get('refreshCurrent') * 1000)); // Update page every n seconds

	App.applicationController.updateAcked();
	App.applicationController.set('timerAcked', setInterval("App.applicationController.updateAcked()", App.applicationController.get('refreshAcked') * 1000));

	App.applicationController.updateHistory();
	App.applicationController.set('timerHistory', setInterval("App.applicationController.updateHistory()", App.applicationController.get('refreshNotification') * 1000));

	setInterval("updateTime()", 5*1000); // Update clock every 5s

});
