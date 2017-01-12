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


//This file supports overriding how the plan is represented in the plan plot

planPlots = {};

$.extend(planPlots, {
	defaultStationColor: '#FFA500',
	selectedStationColor: '#FF4000',
	lastSelectedStation: undefined,
	getStationMarkings: function(startEndTimes) {
    	var stationMarkings = [];
    	var lastSelectedIndex = -1;
    	if (planPlots.lastSelectedStation !== undefined){
    		try {
    			lastSelectedIndex = planPlots.lastSelectedStation.collection.indexOf(planPlots.lastSelectedStation)/2;
    		} catch (err){
    			planPlots.lastSelectedStation = app.getPathElementByUuid(planPlots.lastSelectedStation.get('uuid'));
    			if (planPlots.lastSelectedStation == null){
    				planPlots.lastSelectedStation = undefined;
    			} else {
        			lastSelectedIndex = planPlots.lastSelectedStation.collection.indexOf(planPlots.lastSelectedStation)/2;
    			}
    		}
    	}
    	
    	for (var i=0; i<startEndTimes.length; i++){
    		var stationColor = (lastSelectedIndex == i) ? planPlots.selectedStationColor : planPlots.defaultStationColor;
    		stationMarkings.push({xaxis: {from:startEndTimes[i].start.toDate().getTime(),
    							 		  to: startEndTimes[i].end.toDate().getTime()},
    							 		  color:stationColor});
    	}
    	return stationMarkings;
    },
});


