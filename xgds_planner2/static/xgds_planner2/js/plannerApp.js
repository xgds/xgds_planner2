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

var DEBUG_EVENTS = false;


/*
** Override the TemplateCache function responsible for
** rendering templates so that it will use Handlebars.
*/
Marionette.TemplateCache.prototype.compileTemplate = function(
    rawTemplate, options) {
    return Handlebars.compile(rawTemplate, options);
};

/*
** Main Application object
*/
var app = (function($, _, Backbone) {
	
	const RootView = Marionette.View.extend({
		template: '#application_contents',
		regions: {
			mapRegion: '#map',
			toolbar: '#toolbar',
			tabs: '#tabs',
			plot: '#plot-container'
		},
		onRender: function() {
			app.map = new app.views.OLPlanView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('toolbar', new app.views.ToolbarView());
			this.showChildView('tabs', new app.views.TabNavView());
			this.showChildView('plot', new app.views.PlanPlotView());
		},
		onAttach: function() {
			var pageTopHeight = $('#page-top').outerHeight();
	        var pageElement = $('#page');
	        var pageContentElement = $('#page-content');
	        pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
	        $(window).bind('resize', function() {
	            pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
	        });
	        app.vent.trigger('initialRender');
		}
	});
	
	const App = Marionette.Application.extend( {
		views: {},
		resequencing: false,
	    dirty: false,
	    colors: {},
		region: '#application',
        tree: undefined,
        treeData: null,
        mapBottomPadding: 120,
		vent: Backbone.Radio.channel('global'),
		onStart: function() {
			this.rootView = new RootView();
			this.showView(this.rootView);
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
            siteFrameMode: false,
		},
		Actions: {
			undoStack: new Array(),
            redoStack: new Array(),
            currentState: undefined,
            enabled: true,
            _disableCount: 0,
            _inAction: false,
            _enterAction: function() {
                this._inAction = true;
            },
            _exitAction: function() {
                this._inAction = false;
            },
            disable: function() {
                if (this._inAction)
                    return;
                this._enterAction();
                this._disableCount += 1;
//                console.log('DISABLED COUNT ' + this._disableCount);
                this.enabled = false;
                this._exitAction();
            },
            enable: function() {
                if (this._inAction)
                    return;
                this._enterAction();
                this._disableCount -= 1;
//                console.log('ENABLING: DISABLED COUNT ' + this._disableCount);
                if (this._disableCount <= 0) {
                    this.enabled = true;
                    this._disableCount = 0;
                }
                this._exitAction();
            },
            undoEmpty: function() {
                return this.undoStack.length == 0;
            },
            redoEmpty: function() {
                return this.redoStack.length == 0;
            },
            setInitial: function() {
                if (this.currentState == undefined) {
                    this.currentState = JSON.stringify(app.currentPlan.toJSON());
                }
            },
            resetCurrent: function() {
                if (this._inAction)
                    return;
                this._enterAction();
                this.currentState = JSON.stringify(app.currentPlan.toJSON());
                this._exitAction();
            },
            action: function() {
                if (this._inAction)
                    return;
                if (!this.enabled)
//                	console.log('NOT ENABLED ACTION');
//                	console.trace();
                    return;
                if (this.currentState == undefined)
                    return;
                this.disable();
                this._enterAction();
                var plan = app.currentPlan.toJSON();
                var planString = JSON.stringify(plan);
                if (this.currentState == planString) {
                    // plan unchanged from current state
                } else {
                    this.undoStack.push(this.currentState);
                    this.currentState = planString;
                    this.redoStack = new Array();
                    app.vent.trigger('undoNotEmpty');
                    app.vent.trigger('redoEmpty');
                    app.vent.trigger('actionOcurred');
                }
                this._exitAction();
                this.enable();
            },
            undo: function() {
                if (this._inAction)
                    return;
                if (!this.enabled)
                    return;
                this.disable();
                this._enterAction();
                var planString = this.undoStack.pop();
                var plan = JSON.parse(planString);
                if (plan == undefined) {
                    app.vent.trigger('undoEmpty');
                } else {
                    this.redoStack.push(this.currentState);
                    this.currentState = planString;
                    app.updatePlan(plan);
                    app.vent.trigger('redoNotEmpty');
                    if (this.undoStack.length == 0)
                        app.vent.trigger('undoEmpty');
                }
                this._exitAction();
                this.enable();
            },
            redo: function() {
                if (this._inAction)
                    return;
                if (!this.enabled)
                    return;
                this.disable();
                this._enterAction();
                var planString = this.redoStack.pop();
                var plan = JSON.parse(planString);
                if (plan == undefined) {
                    app.vent.trigger('redoEmpty');
                } else {
                    this.undoStack.push(this.currentState);
                    this.currentState = planString;
                    app.updatePlan(plan);
                    app.vent.trigger('undoNotEmpty');
                    if (this.redoStack.length == 0)
                        app.vent.trigger('redoEmpty');
                }
                this._exitAction();
                this.enable();
            }
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
            _.bind(Backbone.history.start, Backbone.history);
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

            this.stationParamSpecs = this.util.indexBy(this.planSchema.stationParams, 'id');
            this.segmentParamSpecs = this.util.indexBy(this.planSchema.segmentParams, 'id');
            this.planParamSpecs = this.util.indexBy(this.planSchema.planParams, 'id');
            
            // Indexes to make command types easier to retrieve.
            this.commandSpecs = this.util.indexBy(this.planSchema.commandSpecs, 'id');
            
            //this.commandPresetsByCode = this.util.indexBy( this.planLibrary.commands, 'presetCode' );
            this.commandPresetsByName = this.util.indexBy(this.planLibrary.commands, 'name');
            _.extend(this.commandPresetsByName, this.util.indexBy(this.planLibrary.commands, 'presetName'));
            this.commandPresetsByType = this.util.groupBy(this.planLibrary.commands, 'type');

            // create lookup table for units, based on the unit spects
            this.unitSpecs = this.util.indexBy(this.planSchema.unitSpecs,'id');
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
            
            this.planJson = JSON.parse($('#plan_json').html());
            if (this.planJson) {
                this.currentPlan = new app.models.Plan(this.planJson);
                this.simulatePlan(); // do this before the change:plan event is mapped
                this.currentPlan.get('sequence').resequence();
                this.Actions.setInitial();
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
	    getColor: function(key) {
	        function allocateColor() {
	            return app.util.randomColor();
	        } 
	        if (!app.colors) {
	            app.colors = {};
	        }
	        var color;
	        if (_.has(app.colors, key)) {
	            color = app.colors[key];
	        } else {
	            color = allocateColor();
	            app.colors[key] = color;
	        }
	        return color;
	    },
	    util: {
            indexBy: function(list, keyProp) {
                // Return an object that indexes the objects in a list by their key property.
                // keyProp should be a string.
                obj = {};
                _.each(list, function(item) {
                    obj[item[keyProp]] = item;
                });
                return obj;
            },
            groupBy: function(list, keyProp) {
                obj = {};
                _.each(list, function(item) {
                    if (_.isUndefined(obj[item[keyProp]])) {
                        obj[item[keyProp]] = [];
                    }
                    obj[item[keyProp]].push(item);
                });
                return obj;
            },
            HMSToSeconds: function(hms) {
                // given a time in HH:mm:ss return the seconds
            	var duration = moment.duration(hms);
            	return duration.asSeconds();
            },
            secondsToHMS: function(seconds) {
            	// given a time in seconds return the HH:mm:ss
            	var duration = moment.duration(seconds, "seconds");
            	return duration.format("HH:mm:ss", { trim: false });
            },
            randomColor: function() {
                return '#' + ((1 << 24) * Math.random() | 0).toString(16);
            },
            rainbow: function(numOfSteps, step) {
                // This function generates vibrant, 'evenly spaced' colours (i.e. no clustering).
                // This is ideal for creating easily distiguishable vibrant markers in Google Maps and other apps.
                // Adam Cole, 2011-Sept-14
                // HSV to RBG adapted from:
                // http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
                // source: http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript/7419630
                var r, g, b;
                var h = step / numOfSteps;
                var i = ~~(h * 6);
                var f = h * 6 - i;
                var q = 1 - f;
                switch (i % 6) {
                case 0:
                    r = 1, g = f, b = 0;
                    break;
                case 1:
                    r = q, g = 1, b = 0;
                    break;
                case 2:
                    r = 0, g = 1, b = f;
                    break;
                case 3:
                    r = 0, g = q, b = 1;
                    break;
                case 4:
                    r = f, g = 0, b = 1;
                    break;
                case 5:
                    r = 1, g = 0, b = q;
                    break;
                }
                var c = '#' + ('00' + (~~(r * 255)).toString(16)).slice(-2) +
                    ('00' + (~~(g * 255)).toString(16)).slice(-2) +
                    ('00' + (~~(b * 255)).toString(16)).slice(-2);
                return (c);
            },

            toSiteFrame: function(coords, alternateCrs) {
                if (alternateCrs.type == 'roversw' &&
                    alternateCrs.properties.projection == 'utm') {
                    var utmcoords = [null, null, null];
                    LLtoUTM(coords[1], coords[0], utmcoords, alternateCrs.properties.zone);
                    var x = utmcoords[1] - alternateCrs.properties.originNorthing;
                    var y = utmcoords[0] - alternateCrs.properties.originEasting;
                    return [x, y]; // northing, easting for roversw
                } else if (alternateCrs.type == 'proj4') {
                    var proj = proj4(alternateCrs.properties.projection);
                    return proj.forward(coords);
                } else {
                    console.warn('Alternate CRS unknown');
                    return coords;
                }
            },

            toLngLat: function(coords, alternateCrs) {
                if (alternateCrs.type == 'roversw' &&
                    alternateCrs.properties.projection == 'utm') {
                    var oeasting = alternateCrs.properties.originEasting;
                    var onorthing = alternateCrs.properties.originNorthing;
                    var utmEasting = parseFloat(coords[1]) + alternateCrs.properties.originEasting;
                    var utmNorthing = parseFloat(coords[0]) + alternateCrs.properties.originNorthing;
                    var lonLat = {};
                    UTMtoLL(utmNorthing, utmEasting,
                            alternateCrs.properties.zone,
                            lonLat);
                    return [lonLat.lon, lonLat.lat];
                } else if (alternateCrs.type == 'proj4') {
                    var proj = proj4(alternateCrs.properties.projection);
                    return proj.inverseTransform(coords);
                } else {
                    console.warn('Alternate CRS unknown');
                    return coords;
                }
            }
	    }
	});
	

    
	var app = new App(appOptions);

    return app;

}(jQuery, _, Backbone));
