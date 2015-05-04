// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

/*
** Override the TemplateCache function responsible for
** rendering templates so that it will use Handlebars.
*/
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(
    rawTemplate) {
    return Handlebars.compile(rawTemplate);
};

/*
** Main Application object
*/
var app = (function($, _, Backbone) {
    app = new Backbone.Marionette.Application();

    app.dirty = false;
    app.addRegions({
        toolbar: '#toolbar',
        'tabs' : '#tabs'
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
            this.addStationTime = undefined;
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
            //            console.log('\\\\\\\\\\Action called');
            //console.log('Disable stack: ' + this._disableCount);
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
                plannerClampMode: undefined
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

            // temporarily define ge so that we don't get a reference error later
//            window.ge = undefined;

            /*
             * Initialize the plan schema, and build easy-access indecies.
             * The plan schema is global to the planner deployment
             */
            this.planSchema = JSON.parse($('#plan_schema_json').html());
            this.planLibrary = JSON.parse($('#plan_library_json').html());
            this.planIndex = JSON.parse($('#plan_index_json').html());
            this.planLinks = JSON.parse($('#plan_links_json').html());

            // Indexes to make command types easier to retrieve.
            this.commandSpecs = this.util.indexBy(
                this.planSchema.commandSpecs, 'id');
            //this.commandPresetsByCode = this.util.indexBy( this.planLibrary.commands, 'presetCode' );
            this.commandPresetsByName = this.util.indexBy(
                this.planLibrary.commands, 'name');
            _.extend(this.commandPresetsByName, this.util.indexBy(
                this.planLibrary.commands, 'presetName'));
            this.commandPresetsByType = this.util.groupBy(
                this.planLibrary.commands, 'type');

            // create lookup table for units, based on the unit spects
            this.unitSpecs = this.util.indexBy(this.planSchema.unitSpecs,
                                               'id');
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
                //console.log('Updating plan');
                //console.log(planJSON);
                if (!_.isUndefined(planJSON)) {
                    app.currentPlan.set(planJSON);
                }
                app.simulatePlan();
                if (!_.isUndefined(app.map.planView))
                    app.map.planView.render();
                app.vent.trigger('newPlan');
                app.tabs.currentView.render();
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
            app.toolbar.show(new app.views.ToolbarView());
            app.tabs.show(new app.views.TabNavView());
            
            app.vent.trigger('clearSaveStatus');
            if (this.options.readOnly == true){
                app.vent.trigger('readOnly');
            }
        });

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
        console.log('event on app.vent: ' + eventname, args);
        //        console.log('current state:');
        //        console.log('Command Selected:', app.State.commandSelected);
        //        console.log('Station Selected:', app.State.stationSelected);
        //        console.log('Meta Expanded:', app.State.metaExpanded);
        //        console.log('Presets Expanded:', app.State.addCommandsExpanded);
        // if (eventname == 'change:plan') {
        //     var stack = new Error().stack;
        //     console.log(stack);
        // }
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
            app.simulatePlan();
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
        HMSToMinutes: function(hms) {
            // given a time in hh:mm:ss return the decimal minutes
            var splits = hms.split(":");
            if (splits.length == 1) {
                return parseFloat(hms);
            } else if (splits.length == 3) {
                var hours = parseInt(splits[0]);
                var minutes = parseInt(splits[1]);
                var seconds = parseInt(splits[2]);
            } else if (splits.length == 2){
                var hours = 0
                var minutes = parseInt(splits[0]);
                var seconds = parseInt(splits[1]);
            }
            minutes = minutes + 60*hours;
            if (seconds > 0) {
                minutes = minutes + seconds/60;
            }
            return minutes;
        },
        minutesToHMS: function(minutes) {
            // given a floating point time duration in minutes, output 'hh:mm:ss'
            var hh = 0;
            if (minutes > 0) {
                hh = Math.floor(minutes / 60);
            }
            minutes = minutes - (hh * 60.0);
            var mm = Math.floor(minutes);
            var ss = Math.floor(60.0 * (minutes % 1));
            var output = '';
            if (hh > 0) {
                if (hh < 10){
                    hh = "0" + hh;
                }
                output = output + '{hour}:'.format({
                    hour: hh
                });
            }
            if (mm < 10){
                mm = "0" + mm;
            }
            if (ss < 10){
                ss = "0" + ss;
            }
            output = output + '{minute}:{second}'.format({
                minute: mm,
                second: ss
            });
            return output;
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
                return proj.inverse(coords);
            } else {
                console.warn('Alternate CRS unknown');
                return coords;
            }
        }

    };

    return app;

}(jQuery, _, Backbone));
