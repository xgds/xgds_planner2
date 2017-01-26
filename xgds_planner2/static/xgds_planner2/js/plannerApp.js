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
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(
    rawTemplate, options) {
    return Handlebars.compile(rawTemplate, options);
};

/*
** Main Application object
*/
var app = (function($, _, Backbone) {
    app = new Backbone.Marionette.Application();

    app.resequencing = false;
    app.dirty = false;
    app.addRegions({
        toolbar: '#toolbar',
        tabs: '#tabs',
        plot: '#plot-container'
        	
    });

    app.module('State', function(options) {
        this.addInitializer(function(options) {
            this.commandSelected = undefined;
            this.stationSelected = undefined;
            this.segmentSelected = undefined;
            this.metaExpanded = undefined;
            this.addCommandsExpanded = undefined;
            this.disableSimulate = false;
            this.addStationOnMouseUp = false;
            this.mouseDownLocation = undefined;
            this.addStationLocation = undefined;
            this.planLoaded = false;
            this.disableAddStation = false;
            this.pageInnerWidth = undefined;
            this.tabsLeftMargin = undefined;
            this.pageContainer = undefined;
            this.tabsContainer = undefined;
            this.mapResized = false;
            this.mapHeightSet = false;
            this.siteFrameMode = false;
            this.tree = undefined;
            this.treeData = null;
        });
    });

    app.module('Actions', function(options) {
        this.addInitializer(function(options) {
            this.undoStack = new Array();
            this.redoStack = new Array();
            this.currentState = undefined;
            this.enabled = true;
            this._disableCount = 0;
            this._inAction = false;
            app.vent.trigger('undoEmpty');
            app.vent.trigger('redoEmpty');
        });

        this._enterAction = function() {
            this._inAction = true;
        };

        this._exitAction = function() {
            this._inAction = false;
        };

        this.disable = function() {
            if (this._inAction)
                return;
            this._enterAction();
            this._disableCount += 1;
            this.enabled = false;
            this._exitAction();
        };

        this.enable = function() {
            if (this._inAction)
                return;
            this._enterAction();
            this._disableCount -= 1;
            if (this._disableCount <= 0) {
                this.enabled = true;
                this._disableCount = 0;
            }
            this._exitAction();
        };

        this.undoEmpty = function() {
            return this.undoStack.length == 0;
        };

        this.redoEmpty = function() {
            return this.redoStack.length == 0;
        };

        this.setInitial = function() {
            if (this.currentState == undefined) {
                this.currentState = JSON.stringify(app.currentPlan.toJSON());
            }
        };

        this.resetCurrent = function() {
            if (this._inAction)
                return;
            this._enterAction();
            this.currentState = JSON.stringify(app.currentPlan.toJSON());
            this._exitAction();
        };

        this.action = function() {
            if (this._inAction)
                return;
            if (!this.enabled)
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
        };

        this.undo = function() {
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
            //console.log('-----------------------------------Undo finished');
            this._exitAction();
            this.enable();
        };

        this.redo = function() {
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
        };

    });

    app.addInitializer(function(options) {
        var pageTopHeight = $('#page-top').outerHeight();
        var pageElement = $('#page');
        var pageContentElement = $('#page-content');
        pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        $(window).bind('resize', function() {
            pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        });
    });

    app.addInitializer(function(options) {

            this.options = options = _.defaults(options || {}, {
                readOnly: false,
                planLineWidth: 2,
                plannerClampMode: undefined,
                showDetailView: false
                // This enum value has to be sniffed out of the Plugin once it's loaded.
            });

            // no directional stations defaults rotation handles to false
            if (!this.options.directionalStations) {
                this.options.mapRotationHandles = false;
            }

            this.Simulator = this.options.simulator;
            this.commandRenderers = this.options.commandRenderers;

            // rotation handles option
            this.mapRotationHandles = (_.isBoolean(this.options.mapRotationHandles)) ?
                this.options.mapRotationHandles : true;

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
            this.colors = {};
            _.each(this.planSchema.commandSpecs, function(commandSpec) {
                this.colors[commandSpec.id] = commandSpec.color;
            }, this);

            this.updatePlan = function(planJSON) {
                if (!_.isUndefined(planJSON)) {
                    app.currentPlan.set(planJSON);
                }
                app.vent.trigger('simulatePlan');
                app.vent.trigger('updatePlan');
            };

            this.planJson = JSON.parse($('#plan_json').html());
            if (this.planJson) {
                app.currentPlan = new app.models.Plan(this.planJson);
                app.simulatePlan(); // do this before the change:plan event is mapped
                app.currentPlan.get('sequence').resequence();
                app.Actions.setInitial();
            }

            app.selectedViews = []; // This array holds the views currently selected by checkboxes
            app.copiedCommands = []; // array of copied commands

            app.map = new app.views.OLPlanView({
                el: '#map'
            });
            app.vent.trigger('onMapSetup', this);
            app.toolbar.show(new app.views.ToolbarView());
            app.tabs.show(new app.views.TabNavView());
            new app.views.PlanPlotView().render();
            
            
            app.vent.trigger('clearSaveStatus');
            if (this.options.readOnly == true){
                app.vent.trigger('readOnly');
            }
            
            app.vent.on('updatePlanDuration', function(newDuration) {
            	playback.updateEndTime(app.getEndTime(newDuration));
            });
            
            var context = this;
            app.vent.on('simulatePlan', _.debounce(context.simulatePlan, 10));
            app.vent.on('updatePlan', _.debounce(context.rerender, 10));
            
            
        });
    
    app.rerender = function() {
        if (!_.isUndefined(app.map.planView)){
            app.map.planView.render();
        }
    };

    app.router = new Backbone.Router({
        routes: {
            'meta' : 'meta',
            'sequence' : 'sequence',
            'layers' : 'layers',
            'tools' : 'tools'
        }
    });

    /*
    ** Debug global event triggering.
    */
    app.router.on('all', function(eventname) {
        console.log('Router event: ' + eventname);
    });

    app.vent.on('all', function(eventname, args) {
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
            if (_.isUndefined(app.currentPlan))
                return;
            app.vent.trigger('simulatePlan');
        }
    });

    app.addInitializer(_.bind(Backbone.history.start, Backbone.history));

    /*
     * Application-level Request & Respond services
     */

    app.hasHandler = function(name) {
        return !!this.reqres._wreqrHandlers[name];
    };

    // Return the color mapped to a given key.
    // If no color has been assigned to that key, allocate one to be forever associated with it.
    app.reqres.setHandler('getColor', function(key) {
        var color;
        function allocateColor() {
            return app.util.randomColor();
        } //TODO: replace this with something that draws from a list of non-horrible colors
        if (!app.colors) {
            app.colors = {};
        }
        if (_.has(app.colors, key)) {
            color = app.colors[key];
        } else {
            color = allocateColor();
            app.colors[key] = color;
        }
        return color;
    });

    app.getStations = function() {
    	result = [];
    	app.currentPlan.get('sequence').each(function(pathElement, i, sequence) {
    		if (pathElement.attributes.type == 'Station'){
    			result.push(pathElement);
    		}
    	});
    	return result;
    };
    
    app.getPathElementByUuid = function(uuid) {
    	var sequence = app.currentPlan.get('sequence');
    	for (var i=0; i<sequence.models.length; i++){
    		if (sequence.models[i].attributes.uuid == uuid){
    			return sequence.models[i];
    		}
    	}
    	return null;
    };
    
    app.getCoordinateList = function(startUuid, endUuid) {
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
    }
    
    app.getPreviousPathElementByUuid = function(uuid) {
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
    };
    
    app.getNextPathElementByUuid = function(uuid) {
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
    };
    
    app.getNextPathElementSameType = function(pathElement){
    	var sequence = app.currentPlan.get('sequence');
    	var index = sequence.indexOf(pathElement);
    	if (index >= 0){
    		index += 2;
    		if (index < sequence.length){
    			return sequence.models[index];
    		}
    	}
    	return null;
    }
    
    app.getNextPathElement = function(pathElement){
    	var sequence = app.currentPlan.get('sequence');
    	var index = sequence.indexOf(pathElement);
    	if (index >= 0){
    		index += 1;
    		if (index < sequence.length){
    			return sequence.models[index];
    		}
    	}
    	return null;
    }
    
    app.getLastStation = function() {
    	try {
	    	var sequence = app.currentPlan.get('sequence');
	    	var last = sequence[sequence.length - 1];
	    	if (last.attributes.type == 'Station'){
	    		return last;
	    	}
    	} catch (err){
    		
    	}
    	return null;
    }
    app.getDepartureTime = function(station){
    	if (app.options.planExecution){
    		var startTime = moment(app.options.planExecution.planned_start_time);
    		if (station._simInfo === undefined){
    			app.simulatePlan();
    		}
    		var result = startTime.add(station._simInfo.elapsedTimeSeconds + station._simInfo.deltaTimeSeconds, 's');
    		return result;
    	}
    	return null;
    }
    
    app.getArrivalTime = function(station){
    	if (app.options.planExecution){
    		var startTime = moment(app.options.planExecution.planned_start_time);
    		if (station._simInfo === undefined){
    			app.simulatePlan();
    		}
    		var result = startTime.add(station._simInfo.elapsedTimeSeconds, 's');
    		return result;
    	}
    	return null;
    }
    
    app.getDurations = function(startStation, endStation){
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
    	
    }
    
    app.getArrivalTime = function(station){
    	if (app.options.planExecution){
    		var startTime = moment(app.options.planExecution.planned_start_time);
    		if (station._simInfo === undefined){
    			app.simulatePlan();
    		}
    		var result = startTime.add(station._simInfo.elapsedTimeSeconds, 's');
    		return result;
    	}
    	return null;
    }
    
    app.getStartTime = function() {
    	if (app.options.planExecution) {
    		return moment.utc(app.options.planExecution.planned_start_time);
    	} else {
    		if (!app.startTime){
    			app.startTime = moment().utc();
    		}
    		return app.startTime;
    	}
    };
    
    app.getEndTime = function(newDuration) {
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
    };
    
    app.getTimeZone = function(){
    	var thesite = app.currentPlan.get('site');
    	if ('timezone' in thesite){
    		return thesite['timezone'];
    	} else if ('alternateCrs' in thesite){
    		if ('timezone' in thesite['alternateCrs'].properties){
    			return thesite['alternateCrs'].properties.timezone
    		}
    	}
    	return 'Etc/UTC';
    };
    
    app.getStationStartEndTimes = function() {
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
    }
    /*
    ** Global utility functions
    */

    app.util = {
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

    };
    
    return app;

}(jQuery, _, Backbone));
