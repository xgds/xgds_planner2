//__BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the
//Administrator of the National Aeronautics and Space Administration.
//All rights reserved.

//The xGDS platform is licensed under the Apache License, Version 2.0
//(the "License"); you may not use this file except in compliance with the License.
//You may obtain a copy of the License at
//http://www.apache.org/licenses/LICENSE-2.0.

//Unless required by applicable law or agreed to in writing, software distributed
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
//CONDITIONS OF ANY KIND, either express or implied. See the License for the
//specific language governing permissions and limitations under the License.
//__END_LICENSE__

var DEBUG_EVENTS = false;


(function( xGDS, $, _, Backbone, Marionette ) {

	xGDS.PlannerRootView = xGDS.RootView.extend({
		regions: {
			mapRegion: '#map',
			toolbar: '#toolbar',
			tabs: '#tabs',
			plot: '#plot-container',
			validation: '#validation',
		},
		onRender: function() {
			app.map = new app.views.OLPlanView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('toolbar', new app.views.ToolbarView());
			this.showChildView('tabs', new app.views.TabNavView());
			this.showChildView('plot', new app.views.PlanPlotView());
			if (app.options.validation){
				this.showChildView('validation', new app.views.ValidationTableView());
			}
		}
	});

	xGDS.PlannerApplication = xGDS.Application.extend( {
		resequencing: false,
		expandableTab: 'sequence',
		dirty: false,
		colors: {},
		getRootView: function() {
			return new xGDS.PlannerRootView();
		},
		onStart: function() {
			xGDS.Application.prototype.onStart.call(this);
			this.parseJSON();
			this.listenTo(this.vent,'updatePlanDuration', function(newDuration) {
				playback.updateEndTime(app.getEndTime(newDuration));
			});
		},
		State: {
			commandSelected: undefined,
			stationSelected: undefined,
			segmentSelected: undefined,
			metaExpanded: undefined,
			addCommandsExpanded: undefined,
			disableSimulate: false,
			addStationOnMouseUp: false,
			mouseDownLocation: undefined,
			addStationLocation: undefined,
			planLoaded: false,
			disableAddStation: false,
			pageInnerWidth: undefined,
			tabsLeftMargin: undefined,
			pageContainer: undefined,
			tabsContainer: undefined,
			mapResized: false,
			mapHeightSet: false,
			siteFrameMode: false
		},
		Actions: xGDS.Actions,
		getSerializableObject: function() {
			if (!_.isUndefined(this.currentPlan)) {
				return this.currentPlan;
			} else {
				return '';
			}
		},
		updateSerializableObject: function(sObject){
			this.updatePlan(sObject);
		},
		initialize: function(options) {
			this.options = options = _.defaults(options || {}, {
				readOnly: false,
				planLineWidth: 2,
				plannerClampMode: undefined,
				showDetailView: false
			});

			// no directional stations defaults rotation handles to false
			if (!this.options.directionalStations) {
				this.options.mapRotationHandles = false;
			}

			this.Simulator = $.lookupFunctionByName(this.options.simulator);
			this.commandRenderers = this.options.commandRenderers;

			// rotation handles option
			this.mapRotationHandles = (_.isBoolean(this.options.mapRotationHandles)) ?
					this.options.mapRotationHandles : true;


			this.selectedViews = []; // This array holds the views currently selected by checkboxes
			this.copiedCommands = []; // array of copied commands

			// this.vent.trigger('onMapSetup', this);

			this.vent.trigger('clearSaveStatus');
			if (this.options.readOnly == true){
				this.vent.trigger('readOnly');
			}

			var context = this;
			this.listenTo(this.vent, 'simulatePlan', _.debounce(function() {
				context.simulatePlan();
			}, 10));
			this.listenTo(this.vent, 'updatePlan', _.debounce(function() {
				context.rerender();
			}, 10));

			this.listenTo(this.vent,'all', function(eventname, args) {
				if (DEBUG_EVENTS){
					console.log('event on app.vent: ' + eventname, args);
					console.log('current state:');
					console.log('Command Selected:', app.State.commandSelected);
					console.log('Station Selected:', app.State.stationSelected);
					console.log('Meta Expanded:', app.State.metaExpanded);
					console.log('Presets Expanded:', app.State.addCommandsExpanded);
				}
				if (eventname == 'change:plan') {
					app.Actions.action();
				} else if (eventname == 'plan:reversing') {
					app.Actions.disable();
				} else if (eventname == 'plan:reverse') {
					app.Actions.enable();
					app.Actions.action();
				} else if (eventname == 'actionOcurred') {
					if (_.isUndefined(this.currentPlan))
						return;
					app.vent.trigger('simulatePlan');
				}
			});
			this.vent.trigger('undoEmpty');
			this.vent.trigger('redoEmpty');
		},
		util: {
			HMSToSeconds: function(hms) {
				// given a time in HH:mm:ss return the seconds
				var duration = moment.duration(hms);
				return duration.asSeconds();
			},
			secondsToHMS: function(seconds) {
				// given a time in seconds return the HH:mm:ss
				var duration = moment.duration(seconds, "seconds");
				return duration.format("HH:mm:ss", { trim: false });
			}


		},
		parseJSON: function() {
			/*
			 * Initialize the plan schema, and build easy-access indecies.
			 * The plan schema is global to the planner deployment
			 */
			this.planSchema = JSON.parse($('#plan_schema_json').html());
			this.planLibrary = JSON.parse($('#plan_library_json').html());
			this.planIndex = JSON.parse($('#plan_index_json').html());
			this.planLinks = JSON.parse($('#plan_links_json').html());
			try {
				this.planNamedURLs = JSON.parse($('#plan_namedURLs_json').html());
			} catch (err) {
				this.planNamedURLs = [];
			} 

			this.stationParamSpecs = $.indexBy(this.planSchema.stationParams, 'id');
			this.segmentParamSpecs = $.indexBy(this.planSchema.segmentParams, 'id');
			this.planParamSpecs = $.indexBy(this.planSchema.planParams, 'id');

			// Indexes to make command types easier to retrieve.
			this.commandSpecs = $.indexBy(this.planSchema.commandSpecs, 'id');

			//this.commandPresetsByCode = $.indexBy( this.planLibrary.commands, 'presetCode' );
			this.commandPresetsByName = $.indexBy(this.planLibrary.commands, 'name');
			_.extend(this.commandPresetsByName, $.indexBy(this.planLibrary.commands, 'presetName'));
			this.commandPresetsByType = $.groupBy(this.planLibrary.commands, 'type');

			// create lookup table for units, based on the unit spects
			this.unitSpecs = $.indexBy(this.planSchema.unitSpecs,'id');
			this.units = {
					// this object will be filled
			};

			// creates lookup table for which unitspec a unit is contained in
			_.each(_.keys(this.unitSpecs), function(unitSpec) {
				_.each(_.keys(this.unitSpecs[unitSpec].units), function(
						unit) {
					if (_.has(this.units, unit)) {
						throw 'Unit conflict: ' + unit +
						' is defined in multiple unitSpecs';
					}
					this.units[unit] = unitSpec;
				}, this);
			}, this);

			// Extract color from command specs
			// The app.colors object holds a key --> color map for the whole application
			_.each(this.planSchema.commandSpecs, function(commandSpec) {
				this.colors[commandSpec.id] = commandSpec.color;
			}, this);

			var existingPlan = !_.isEmpty(this.planJson);
			this.planJson = JSON.parse($('#plan_json').html());
			if (this.planJson) {
				this.currentPlan = new app.models.Plan(this.planJson);
				this.simulatePlan(); // do this before the change:plan event is mapped
				this.currentPlan.get('sequence').resequence();
				if (!existingPlan){
					this.Actions.setInitial();
				}
				this.vent.trigger('onPlanLoaded');
			}
		},
		updatePlan: function(planJSON) {
			if (!_.isUndefined(planJSON)) {
				this.currentPlan.set(planJSON);
			}
			this.vent.trigger('simulatePlan');
			this.vent.trigger('updatePlan');
		},
		rerender: function() {
			if (!_.isUndefined(this.map.planView)){
				this.map.planView.render();
			}
		},
		isEmptyPlan: function() {
			return app.currentPlan.get('sequence').length == 0;
		},
		getStations: function() {
			result = [];
			app.currentPlan.get('sequence').each(function(pathElement, i, sequence) {
				if (pathElement.attributes.type == 'Station'){
					result.push(pathElement);
				}
			});
			return result;
		},
		getPathElementByUuid: function(uuid) {
			var sequence = app.currentPlan.get('sequence');
			for (var i=0; i<sequence.models.length; i++){
				if (sequence.models[i].attributes.uuid == uuid){
					return sequence.models[i];
				}
			}
			return null;
		},
		canHaveCommandsMap: {},
		canHaveCommands: function(pathElementType){
			result = false;
			// see if this type of path element can have child commands
			if (!(pathElementType in this.canHaveCommandsMap)){
				var presets = app.getCommandPresets(pathElementType);
				if (!_.isEmpty(presets)){
					result = true;
				}
				this.canHaveCommandsMap[pathElementType] = result;
			} else {
				result = this.canHaveCommandsMap[pathElementType];
			}
			return result;

		},
		getCoordinateList: function(startUuid, endUuid) {
			var sequence = app.currentPlan.get('sequence');
			var result = [];
			var start = undefined;
			var current = undefined;
			for (var i=0; i<sequence.models.length; i += 2){
				if (start == undefined) {
					if (sequence.models[i].attributes.uuid == startUuid){
						start = sequence.models[i];
						current=start;
					}
				} else {
					if (sequence.models[i].attributes.type == 'Station') {
						current = sequence.models[i];
						if (current.attributes.uuid == endUuid) {
							i = sequence.models.length;
						}
					} else {
						current = undefined;
					}
				}
				if (current !== undefined){
					result.push(current.attributes.geometry.coordinates);
				}
			}
			return result;
		},
		getPreviousPathElementByUuid: function(uuid) {
			// return the path element prior to the given uuid
			var sequence = app.currentPlan.get('sequence');
			var previous = null;
			for (var i=0; i<sequence.models.length; i++){
				if (sequence.models[i].attributes.uuid == uuid){
					return previous;
				}
				previous = sequence.models[i];
			}
			return null;
		},
		getNextPathElementByUuid: function(uuid) {
			// return the path element after the given uuid
			var sequence = app.currentPlan.get('sequence');
			for (var i=0; i<sequence.models.length; i++){
				if (sequence.models[i].attributes.uuid == uuid){
					if (i+1 < sequence.models.length){
						return sequence.models[i+1];
					}
					return null;
				}
			}
			return null;
		},
		getNextPathElementSameType: function(pathElement){
			var sequence = app.currentPlan.get('sequence');
			var index = sequence.indexOf(pathElement);
			if (index >= 0){
				index += 2;
				if (index < sequence.length){
					return sequence.models[index];
				}
			}
			return null;
		},
		getNextPathElement: function(pathElement){
			var sequence = app.currentPlan.get('sequence');
			var index = sequence.indexOf(pathElement);
			if (index >= 0){
				index += 1;
				if (index < sequence.length){
					return sequence.models[index];
				}
			}
			return null;
		},
		getLastStation: function() {
			try {
				var sequence = app.currentPlan.get('sequence');
				var last = sequence[sequence.length - 1];
				if (last.attributes.type == 'Station'){
					return last;
				}
			} catch (err){

			}
			return null;
		},
		getDepartureTime: function(station){
			if (app.options.planExecution){
				var startTime = moment(app.options.planExecution.planned_start_time);
				if (station._simInfo === undefined){
					app.simulatePlan();
				}
				var result = startTime.add(station._simInfo.elapsedTimeSeconds + station._simInfo.deltaTimeSeconds, 's');
				return result;
			}
			return null;
		},
		getArrivalTime: function(station){
			if (app.options.planExecution){
				var startTime = moment(app.options.planExecution.planned_start_time);
				if (station._simInfo === undefined){
					app.simulatePlan();
				}
				var result = startTime.add(station._simInfo.elapsedTimeSeconds, 's');
				return result;
			}
			return null;
		},
		getDurations: function(startStation, endStation){
			var sequence = app.currentPlan.get('sequence');
			var durations = [];
			durations.push(startStation._simInfo.deltaTimeSeconds);
			var startIndex = sequence.indexOf(startStation) + 2;
			for (var i = startIndex; i< sequence.length; i+= 2){
				var station = sequence.models[i];
				durations.push(station._simInfo.deltaTimeSeconds);
				if (station.attributes.uuid == endStation.attributes.uuid){
					i = sequence.length;
				}
			}
			return durations;
		},
		getArrivalTime: function(station){
			if (app.options.planExecution){
				var startTime = moment(app.options.planExecution.planned_start_time);
				if (station._simInfo === undefined){
					app.simulatePlan();
				}
				var result = startTime.add(station._simInfo.elapsedTimeSeconds, 's');
				return result;
			}
			return null;
		},
		getStartTime: function() {
			if (app.options.planExecution) {
				return moment.utc(app.options.planExecution.planned_start_time);
			} else {
				if (!app.startTime){
					app.startTime = moment().utc();
				}
				return app.startTime;
			}
		},
		getEndTime: function(newDuration) {
			var theStartTime = app.getStartTime();
			if (app.currentPlan._simInfo === undefined){
				app.simulatePlan();
			}
			var duration = newDuration;
			if (duration === undefined){
				duration = app.currentPlan._simInfo.deltaTimeSeconds;
			}
			var theEndTime = moment(theStartTime).add(duration, 's');
			return theEndTime;
		},
		getTimeZone: function(){
			var thesite = app.currentPlan.get('site');
			if ('timezone' in thesite){
				return thesite['timezone'];
			} else if ('alternateCrs' in thesite){
				if ('timezone' in thesite['alternateCrs'].properties){
					return thesite['alternateCrs'].properties.timezone
				}
			}
			return 'Etc/UTC';
		},
		getStationStartEndTimes: function() {
			var startTime = app.getStartTime();
			var endTime = undefined;
			var result = [];
			app.currentPlan.get('sequence').each(function(pathElement, i, sequence) {
				if (pathElement.attributes.type == 'Station'){
					if (pathElement._simInfo != undefined){
						endTime = startTime.clone().add(pathElement._simInfo.deltaTimeSeconds, 's');
						result.push({start: moment(startTime), end: moment(endTime)});
					}
				}
				if (pathElement._simInfo != undefined){
					startTime = startTime.add(pathElement._simInfo.deltaTimeSeconds, 's');
				}
			});
			return result;
		},
		getCommandPresets: function(modelType) {
			var key = (modelType + '_commandPresets')
			if (key in this) {
				return this[key]; 
			}
			var presets;
			// Lists of command types that pertain to Stations and Segments are available in
			// planSchema.StationSequenceCommands and planSchema.SegmentSequenceCommands, respectively
			var relevantCommandTypes = this.planSchema[modelType.toLowerCase() + 'SequenceCommands'];
			if (_.isUndefined(relevantCommandTypes)) {
				presets = this.planLibrary.commands;
			} else {
				presets = _.filter(this.planLibrary.commands, function(command) { 
					return _.contains(relevantCommandTypes, command.type)
				});
			}
			// add timing info in HMS format
			_.each(presets, function(command) {
				if (_.has(command, 'duration')) {
					command.timing = app.util.secondsToHMS(command.duration);
				} else {
					var paramSpec = app.commandSpecs[command.type];
					paramSpec.params.every(function(param){
						if (param.id == 'duration' && _.has(param, 'default')){
							command.timing = app.util.secondsToHMS(param.default);
							return false;
						}
						return true;
					});
				}
			});
			this[key] = presets;
			return presets;
		},
		buildValidation: function(container, status, name, description, timestamp, source, data){
			/* Builds a new validation objects and puts it in the container's validations attribute.  The container is a Plan, Station, Segment or Command. */

			try{
				var validations = container.get('validations'); //validations is a list. might be undefined.  If it's undefined, set it on the container
				//console.log(validations);
				if (validations==undefined) {
					validations=[];
					container.set("validations", validations);
				}				
				var timestampString = timestamp;
				if(timestamp instanceof moment){
					timestampString = timestamp.isoformat();
				}
				var newValidation = {'container_uuid': container.get('uuid'), 'planTime': this.getArrivalTime(container).toISOString(),'station': container._sequenceLabel,'status': status, 'name': name, 'description': description, 'timestamp':timestampString, 'source': source, 'data': data, 'uuid': new UUID(4).format()};
				validations.push(newValidation);
				app.vent.trigger('validation:add', newValidation);
				container.trigger('validation:add', newValidation);
				return newValidation;
			}
			catch(err){
				console.log(err.name);
			}
		},
		
		isMatch: function(validation, match){
			var keys = Object.keys(match); //gets keys in object
			var foundMatch = false;
			for(var k=0; k<keys.length; k++){
				var key = keys[k];
				if(key in validation){
					var value= match[key]; 
					if(key=='data'){
						var dataKeys = Object.keys(value);
						var validationData = validation[key];
						for(var d=0; d<dataKeys.length; d++){
							var matchData = value[dataKeys[d]];
							if(validationData[dataKeys[d]] !== undefined){
								if(validationData[dataKeys[d]] == matchData){
									foundMatch=true; 
								}
								else{
									foundMatch=false; 
									break;
								}
							}
							else{
								foundMatch=false;
								break;
							}
						}
					} else {
						if(value==validation[key]){								
							foundMatch = true;
						}
						else{				
							foundMatch = false;
							break;
						}
					}
				}
				else{
					foundMatch=false;
					break;
				}
			}
			return foundMatch;
		},
		getHighestValidationLevel: function(validations){
			var highest = undefined;
			for(var i=0;i<validations.length;i++){
				if (validations[i].status == 'error'){
					return validations[i].status;
				}
				if (highest === undefined) {
					highest = validations[i].status;
				} else {
					if (validations[i].status == 'warning'){
						highest = validations[i].status;
					}
				}
			}
			return highest;
		},
		getValidationsAsList: function(container, match, recursive, result, remove=false){
			//Find any matching validations on the container, recursing if the recursive flag is true
			// if remove is true, then delete them from the validations.
			// always return a flat list of all found validations that match.
			if (result === undefined){
				result = [];
			}
			var newMatches = [];
			var validations = container.get('validations');
			if(validations!== undefined) {

				if (match != undefined){
					//iterate through the validations list and check if everything matches
					for(var i=0; i<validations.length; i++){
						var v = validations[i];
						var foundMatch=this.isMatch(v, match);
						if(foundMatch == true){
							newMatches.push(v);
						}
					}
					console.log(newMatches);
				} else {
					newMatches = validations;
					console.log(newMatches);
				}
			}

			if (remove && newMatches.length > 0){
				for(var i=0; i<newMatches.length; i++){
					var index = validations.indexOf(newMatches[i]);
					if (index > -1){
						var deadValidation = validations[i];
						if (deadValidation !== undefined){
							validations.splice(index, 1);
							app.vent.trigger('validation:remove', deadValidation);
							if (deadValidation.container_uuid !== undefined){
								var pathElement = app.getPathElementByUuid(deadValidation.container_uuid);
								pathElement.trigger('validation:remove', deadValidation);
							}
						}
					}
				}
			}

			// add them to the result
			result.push.apply(result,newMatches);
			//see if recursive flag is true
			if(recursive == true){
				if (container.get('sequence') !== undefined){
					var sequence = container.get('sequence');
					if(sequence !== undefined){
						sequence.each(function(element){
							//TODO Sophie make sure this is actually iterating through station, segment, stations.dddd
							app.getValidationsAsList(element, match, recursive, result, remove);
						});
					}
				}

			}
			return result;

		}
		
	});

	
	xGDS.Factory = {
			construct: function(options){
				return new xGDS.PlannerApplication(options);
			}
	};

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));