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

$.extend(playback, {
	vehicleDriver : {
		lastUpdate: undefined,
		invalid: false,
		ranges: [],
		elements: [],
		lastIndex: 0,
		getStationTransform: function(currentTime, station) {
			return {location:transform(station.get('geometry').coordinates), rotation:0};
		},
		getSegmentTransform: function(currentTime, segment, index){
			// interpolate along straight line
			var range = this.ranges[this.lastIndex];
			var newRange = moment.range(range.start, currentTime);
			var currentDuration = newRange.diff('seconds');
			var fullDuration = segment.getDuration();
			var percentage = currentDuration / fullDuration;
			
			var prevStation = this.elements[index - 1];
			var prev = prevStation.get('geometry').coordinates;
			var nextStation = this.elements[index + 1];
			var next = nextStation.get('geometry').coordinates;
			
			var newx = prev[0] + ( percentage * (next[0] - prev[0]));
			var newy = prev[1] + ( percentage * (next[1] - prev[1]));
			var newcoordinates = [newx, newy];
			return {location:transform(newcoordinates), rotation:0};
		},
		getPosition: function(currentTime, lastIndex) {
			var pathElement = this.elements[this.lastIndex];
			if (pathElement.get('type') == 'Station') {
				return this.getStationTransform(currentTime, pathElement);
			} else if (pathElement.get('type') == 'Segment') {
				return this.getSegmentTransform(currentTime, pathElement, lastIndex);
			}
		},
		lookupTransform: function(currentTime){
			if (this.elements.length == 0){
				return null;
			}
			if (currentTime.unix() == this.ranges[this.lastIndex].start.unix() || currentTime.within(this.ranges[this.lastIndex])){
				return this.getPosition(currentTime, this.lastIndex);
			} else {
				while (this.lastIndex < this.ranges.length){
					this.lastIndex = this.lastIndex + 1;
					if (currentTime.unix() == this.ranges[this.lastIndex].start.unix() || currentTime.within(this.ranges[this.lastIndex])){
						return this.getPosition(currentTime, this.lastIndex);
					}
				}
			}
			return null;
			
		},
		analyze: function() {
			var plan = app.currentPlan;
			this.elements = [];
			this.ranges = [];
			if (plan.get('sequence').length < 3) {
				this.invalid = true;
				return true;
			} else {
				this.invalid = false;
			}

			var analysisTime = moment(app.getStartTime());
			var _this = this;
			var seq = plan.get('sequence').toArray();
			for (var i=0; i<seq.length; i++){
				var pathElement = seq[i];
				var startTime = moment(moment.analysisTime);
				analysisTime.add(pathElement.getDuration(), 's');
				var endTime = moment(analysisTime);
				this.ranges.push(moment.range(startTime, endTime))
				this.elements.push(pathElement);
			}
		},
		initialize: function() {
			moment.tz.setDefault(app.getTimeZone());
			this.analyze();
		},
		doSetTime: function(currentTime){
			this.lastUpdate = moment(currentTime);
			var newPositionRotation = this.lookupTransform(this.lastUpdate);
			if (newPositionRotation != null){
				app.vent.trigger('vehicle:change',newPositionRotation);
			}
		},
		start: function(currentTime){
			this.doSetTime(currentTime);
		},
		update: function(currentTime){
			if (this.lastUpdate === undefined){
				this.doSetTime(currentTime);
				return;
			}
			var delta = currentTime.diff(this.lastUpdate);
			if (Math.abs(delta) >= 1000) {
				this.doSetTime(currentTime);
			}
		},
		pause: function() {
			// noop
		}
	}
});