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
        object.set('_simInfo', getSimInfo(sim, startState));
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

            pathElement.get('sequence').each(function(command) {
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
    };

    function renderSimState(plan) {
        output = '<table style="position:absolute; top:1000px; left:50px;"> \n';
        output = output + getRow('id,dt,t,dd,d'.split(','), 'th');
        output = output + getItemRow(plan);
        plan.get('sequence').each(function(item) {
            output = output + getItemRow(item);
            item.get('sequence').each(function(command) {
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
        var si = item.get('_simInfo');
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
