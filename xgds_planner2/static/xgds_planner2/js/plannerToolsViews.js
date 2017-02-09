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

app.views.PlanToolsView = Marionette.View.extend({
    template: '#template-plan-tools',
    events: {
        'click #ok-button': 'okClicked',
        'click #btn-reverse': 'reverseStations',
    },
    initialize: function() {
        this.listenTo(app.vent, 'clearAppendTool', this.clearAppendTool);
        this.listenTo(app.vent, 'setAppendError', this.setAppendError);
    },
    serializeData: function() {
        var data = this.model.toJSON();
        data.planIndex = app.planIndex;
        data.moniker = app.options.planMoniker;
        return data;
    },
    onAttach: function() {
        if (app.options.readOnly) {
            this.disableForReadOnly();
        }
    },
    okClicked: function() {
        var selectPlan = parseInt(this.$('#plan-select').val());
        var planUrl = undefined;
        _.each(app.planIndex, function(plan) {
            if (plan.id == selectPlan) {
                planUrl = plan.url;
            }
        });
        if (_.isUndefined(planUrl))
            // no plan selected
            return;
        this.$('#ok-button').attr('disabled', 'true');
        this.$('#append-error').empty();
        app.reversePlanOnAppend = this.$('#reverse-plan').is(':checked');
        app.prependPlanOnAppend = this.$('#prepend-plan').is(':checked');
        $.getJSON(planUrl).done(this.appendPlan).error(this.failAppendPlan);
    },
    failAppendPlan: function() {
        app.vent.trigger('clearAppendTool');
        app.vent.trigger('setAppendError', 'Error gettting plan to append');
    },
    setAppendError: function(message) {
        this.$('#append-error').empty().append(message);
    },
    clearAppendTool: function() {
        this.$('#ok-button').removeAttr('disabled'); //('disabled','false');
        this.$('#append-error').empty();
        delete app.reversePlanOnAppend;
        delete app.prependPlanOnAppend;
    },
    appendPlan: function(data) {
        if (data.sequence.length == 0) {
            // no sequence to add
            app.vent.trigger('clearAppendTool');
            return;
        }
        if (app.reversePlanOnAppend)
            data.sequence.reverse();
        if (app.prependPlanOnAppend && !app.reversePlanOnAppend)
            data.sequence.reverse(); // plan is pushed in reverse order when prepending
        delete app.reversePlanOnAppend;
        var method = undefined;
        var sequence = app.currentPlan.get('sequence').models.slice();
        if (app.prependPlanOnAppend) {
            if (sequence.length > 0) {
                var segment = app.models.segmentFactory();
                sequence.unshift(segment);
            }
            while (data.sequence.length > 0) {
                var item = data.sequence.shift();
                var model = undefined;
                if (item.type == 'Station') {
                    model = app.models.stationFactory(item);
                } else if (item.type == 'Segment') {
                    model = app.models.segmentFactory(item);
                } else {
                    break;
                }
                sequence.unshift(model);
            }
        } else {
            if (sequence.length > 0) {
                var segment = app.models.segmentFactory();
                sequence.push(segment);
            }
            while (data.sequence.length > 0) {
                var item = data.sequence.shift();
                var model = undefined;
                if (item.type == 'Station') {
                    model = app.models.stationFactory(item);
                } else if (item.type == 'Segment') {
                    model = app.models.segmentFactory(item);
                } else {
                    break;
                }
                sequence.push(model);
            }
        }
        delete app.prependPlanOnAppend;
        app.Actions.disable();
        app.currentPlan.get('sequence').models = sequence;
        app.currentPlan.get('sequence').resequence();
        app.vent.trigger('clearAppendTool');
        app.updatePlan(undefined);
        app.Actions.enable();
        app.Actions.action();
        app.vent.trigger('change:plan');
    },
    reverseStations: function() {
        app.vent.trigger('plan:reversing');
        app.currentPlan.get('sequence').models.reverse();
        app.currentPlan.get('sequence').resequence();
        app.vent.trigger('plan:reverse');
    },
    disableForReadOnly: function() {
        this.$('#btn-reverse').attr('disabled', 'true');
        this.$('#ok-button').attr('disabled', 'true');
    }
});