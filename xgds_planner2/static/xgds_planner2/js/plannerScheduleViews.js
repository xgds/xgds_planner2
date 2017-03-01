//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

app.views = app.views || {};

var DEFAULT_FORMAT = 'MM/DD/YYYY HH:mm'

app.views.ScheduleView = Marionette.View.extend({
    template: '#template-schedule',
    initialize: function() {
    	Handlebars.registerHelper('flightSelected', function (input, flightName) {
            return input === flightName ? 'selected' : '';
        });
    },
    templateContext: function() {
    	var planned_start_time = "";
    	if (app.options.planExecution !== null){
    		moment.tz.setDefault('Etc/UTC');
    		planned_start_time = moment(app.options.planExecution.planned_start_time).tz(app.getTimeZone()).format('MM/DD/YYYY HH:mm');
    	}
    	var data = {planned_start_time: planned_start_time,
    			    planExecution: app.options.planExecution,
    			    planId: app.planJson.serverId,
    			    flight_names: app.options.flight_names}
    	return data;
    },
    onAttach: function() {
    	$('#schedule_message').empty();
    	
        var scheduleDate = this.$el.find("#id_schedule_date");
        scheduleDate.datetimepicker({'controlType': 'select',
            'oneLine': true,
            'showTimezone': false,
            'timezone': moment.tz(app.getTimeZone()).utcOffset()
           });
        if (app.options.planExecution){
        	scheduleDate.val(moment(app.options.planExecution.planned_start_time).format(DEFAULT_FORMAT));
        }
        this.$el.find('#submit_button').click(function(event)
		    {
        	event.preventDefault();
            var theForm = $("#scheduleForm");
        	var postData = theForm.serializeArray();
        	// update the date to be in utc
        	moment.tz.setDefault(app.getTimeZone());
        	var tzified = moment.tz(postData[2].value, 'MM/DD/YYYY HH:mm', app.getTimeZone());
        	var theUtc = tzified.utc().format('MM/DD/YYYY HH:mm');
        	postData[2].value = theUtc;
            $.ajax(
            {
                url: "/xgds_planner2/schedulePlan/",
                type: "POST",
                dataType: 'json',
                data: postData,
                success: function(data)
                {
                	var flightName = data['flight'];
                	if ($("#id_flight option[value='" + flightName + "']").length == 0){
                		$("#id_flight").append("<option value=" + flightName + " selected>" + flightName +"</option>");
                	}
                	$("#id_flight").val(flightName);
                	var startMoment = moment.utc(data['planned_start_time']).tz(playback.displayTZ);
                	scheduleDate.val(getLocalTimeString(startMoment, playback.displayTZ));
                	$("#id_planExecutionId").val(data['pk']);
                	$('#schedule_message').text("Plan scheduled for " + scheduleDate.val());
                	app.options.planExecution = data;
                	playback.updateStartTime(startMoment);
                	playback.updateEndTime(moment(startMoment).add(app.currentPlan._simInfo.deltaTimeSeconds, 's'));
                	playback.setCurrentTime(startMoment);
                	app.vent.trigger('change:scheduledStartTime', startMoment);
                },
                error: function(data)
                {
                	$('#schedule_message').text(data.responseJSON.msg);
                }
            });
        });
        
    }
});

