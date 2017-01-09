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

$(function() {

    function getSimState(sim) {
        return {
            elapsedTimeSeconds: sim.getElapsedTimeSeconds(),
            distanceTraveledMeters: sim.getDistanceTraveledMeters()
        };
    }

    function getSimInfo(sim, startState) {
        var currentState = getSimState(sim);
        return _.extend({}, startState, {
            deltaTimeSeconds: currentState.elapsedTimeSeconds -
                startState.elapsedTimeSeconds,
            deltaDistanceMeters: currentState.distanceTraveledMeters -
                startState.distanceTraveledMeters
        });
    }

    function setSimInfo(sim, object, startState) {
    	var newSimInfo = getSimInfo(sim, startState);
    	if (!_.isUndefined(object._simInfo)){
    		if (JSON.stringify(newSimInfo) === JSON.stringify(object._simInfo)){
    			return; // has not changed
    		} 
    	}
        object._simInfo = newSimInfo;
        object.trigger('change');
    }

    app.simulatePlan = function() {
        if (app.State.disableSimulate)
            return; // don't simulate while we simulate
        
        app.State.disableSimulate = true;
        app.Actions.disable();
        var sim = new app.Simulator();
        var plan = app.currentPlan;
        if (plan.get('sequence').length == 0) {
            // no stations means we don't simulate
            setSimInfo(sim, plan, getSimState(sim));
            app.State.disableSimulate = false;
            app.Actions.enable();
            return;
        }

        var prePlanSimState = getSimState(sim);
        sim.startPlan(plan);

        var context = {
            plan: plan
        };
        plan.get('sequence').each(function(pathElement, i, sequence) {
            var ctx = _.extend({}, context); // make a copy
            var prePathElementSimState = getSimState(sim);

            var type = pathElement.get('type');
            if (type == 'Station') {
                sim.startStation(pathElement, ctx);
            } else if (type == 'Segment') {
                ctx.nextStation = sequence[i + 1];
                sim.startSegment(pathElement, ctx);
            } else {
                throw 'Invalid PathElement type.';
            }

            pathElement.get('commands').each(function(command) {
                var preCommandSimState = getSimState(sim);
                sim.executeCommand(command);
                setSimInfo(sim, command, preCommandSimState);
            });

            if (type == 'Station') {
                sim.endStation(pathElement, ctx);
            } else if (type == 'Segment') {
                sim.endSegment(pathElement, ctx);
            } else {
                throw 'How did you even get here?';
            }

            setSimInfo(sim, pathElement, prePathElementSimState);

        });

        sim.endPlan(plan);
        setSimInfo(sim, plan, prePlanSimState);
        app.Actions.enable();
        app.State.disableSimulate = false;
        app.vent.trigger('updatePlanDuration', app.currentPlan._simInfo.deltaTimeSeconds);
        if (app.State.stationSelected != undefined){
        	var stationStartTime = app.getStartTime().add(app.State.stationSelected._simInfo.elapsedTimeSeconds, 's');
        	app.vent.trigger('playback:setCurrentTime', stationStartTime);
        }
    };

    function renderSimState(plan) {
        output = '<table style="position:absolute; top:1000px; left:50px;"> \n';
        output = output + getRow('id,dt,t,dd,d'.split(','), 'th');
        output = output + getItemRow(plan);
        plan.get('sequence').each(function(item) {
            output = output + getItemRow(item);
            item.get('commands').each(function(command) {
                output = output + getItemRow(command);
            });
        });
        output = output + '</table>';
        return output;
    }

    function getRow(list, tag) {
        if (tag == undefined)
            tag = 'td';
        var ths = _.map(list, function(v) {
            return '<' + tag + '>' + v + '</' + tag + '>';
        });
        return '<tr>' + ths.join('') + '</tr>';
    }

    function getItemRow(item) {
        var si = item._simInfo;
        var infoArr = [item.get('id'), si.deltaTimeSeconds,
                       si.elapsedTimeSeconds, si.deltaDistanceMeters,
                       si.distanceTraveledMeters];
        return getRow(infoArr);
    }

    window.debugSim = function() {
        app.simulatePlan();
        var html = renderSimState(app.currentPlan);
        $('body').append($(html));
    };

});
