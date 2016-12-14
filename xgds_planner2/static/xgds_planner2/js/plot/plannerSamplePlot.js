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

sample_plot = {}; //namespace

$.extend(sample_plot, {
	initialize: function(startMoment, endMoment) {
		// in case you need to initialize anything, load files
	},
	getDataValues: function(startMoment, endMoment, intervalSeconds) {
		var result = [];
		var nowMoment = startMoment.clone();
		var myIntervalSeconds = sample_plot.getIntervalSeconds(intervalSeconds);
		while (nowMoment.isBefore(endMoment)){
			result.push([nowMoment.toDate().getTime(), nowMoment.minute()]);
			nowMoment = nowMoment.add(myIntervalSeconds, 's');
		}
		console.log(result);
		return result;
	},
	getLineColor: function() {
		return 'blue';
	},
	getIntervalSeconds: function(intervalSeconds) {
		// in case you want specific control over this.
		return intervalSeconds;
	},
	usesPosition: false // for plots that require map position instead of time.
	
	
});