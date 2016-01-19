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

app.views.ScheduleView = Backbone.View.extend({
    template: '#template-schedule',
    initialize: function() {
    	Handlebars.registerHelper('flightSelected', function (input, flightName) {
            return input === flightName ? 'selected' : '';
        });
    	Handlebars.registerHelper('evSelected', function (input, evID) {
            return input.pk === evID ? 'selected' : '';
        });
        var source = $(this.template).html();
        if (_.isUndefined(source)) {
            this.template = function() {
                return '';
            };
        } else {
            this.template = Handlebars.compile(source);
        }
    },
    render: function() {
    	$('#schedule_message').empty();

        this.$el.html(this.template({
            planExecution: app.options.planExecution,
            evList: app.options.evList,
            planId: app.planJson.serverId,
            flight_names: app.options.flight_names
        }));
        this.$el.find("#id_schedule_date").datetimepicker({'controlType': 'select',
            'oneLine': true,
            'showTimezone': false,
            'timezone': '-0000'
           });
        this.$el.find('#submit_button').click(function(event)
		    {
        	event.preventDefault();
            var theForm = $("#scheduleForm");
        	var postData = theForm.serializeArray();
            $.ajax(
            {
                url: "/xgds_planner2/schedulePlan/",
                type: "POST",
                dataType: 'json',
                data: postData,
                success: function(data)
                {
                	$('#schedule_message').text(data.responseJSON.msg);
                },
                error: function(data)
                {
                	$('#schedule_message').text(data.responseJSON.msg);
                }
            });
        });
        
    }
});

