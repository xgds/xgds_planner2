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

var DEG2RAD = Math.PI / 180.0;

function kmlColor(rgbColor, alpha) {
    // Convert rgb hex color values to aabbggrr, which is what KML uses.
    if (alpha == undefined) {
        alpha = 'ff';
    }
    if (rgbColor.charAt(0) == '#') {
        rgbColor = rgbColor.slice(1);
    }
    var rr = rgbColor.substr(0, 2);
    var gg = rgbColor.substr(2, 2);
    var bb = rgbColor.substr(4, 2);
    return '' + alpha + bb + gg + rr;
}

var GE_CACHE = {};

function getGeCache(geObject) {
    var objId = geObject.getName(); 
    var objCache = GE_CACHE[objId];
    if (objCache == undefined) {
        objCache = {};
        GE_CACHE[objId] = objCache;
    }
    return objCache;
}

var styleMap = {};

//The below view can be used to generate polygons.  See xgds_kn.
var PolygonView = Backbone.View.extend({
    initialize: function(options) {
        this.options = options || {};
        this.station = this.options.station;
        this.command = this.options.command;
        this.commandFeatures = this.options.commandFeatures;

        this.lineColor = 'ffffffff';
        var rgbFillColor = app
            .request('getColor', this.command.get('type'));
        this.fillColor = kmlColor(rgbFillColor, '80');
        this.alternateCrs = _.has(app.planJson.site, 'alternateCrs') ?
                app.planJson.site.alternateCrs : null;
        this.placemark = this.createPlacemark(this.computeCoords());

        this.listenTo(this.command, 'change', this.update);
        this.listenTo(this.station, 'change', this.update);
        this.listenTo(this.station, 'change:geometry', this.update);
        this.listenTo(this.station, 'change:headingDegrees', this.update);

        this.listenTo(this.command, 'remove', this.erase);
        this.listenTo(this.station, 'remove', this.erase);

    },

    /*
     * Calculate the polygon's coordinates and output them
     * as an array of objects with lat & lng properties.
     */
    computeCoords: function() {
        var station = this.station;
        var command = this.command;

        coords = [];

        //TODO calculate and return some coords
        return coords;
    },

    createPlacemark: function(coords) {
        if (coords.length == 0) {
            return;
        }
        var gex = ge_gex;
        var visibility = this.command.get('showPolygon');
        if (visibility === undefined) {
            visibility = true;
        }

        var polygonOptions = {};
        polygonOptions.altitudeMode = app.options.plannerClampMode || ge.ALTITUDE_RELATIVE_TO_GROUND;
        var polygon = gex.dom.buildPolygon(_.map(coords, function(coord) {
            return [coord.lat, coord.lng, coord.alt];
        }), polygonOptions);

        var style = gex.dom.buildStyle({
            line: {
                color: this.lineColor
            },
            poly: {
                fill: true,
                outline: true,
                color: this.fillColor
            }
        });

        var pmOptions = {};
        pmOptions.style = style;
        var placemark = gex.dom.buildPolygonPlacemark(polygon, pmOptions);
        placemark.setVisibility(visibility);
        return placemark;
    },

    update: function() {
        var visibility = this.command.get('showPolygon');
        if (visibility === undefined) {
            visibility = true;
        }

        this.placemark.setVisibility(visibility);
        if (visibility) {
            var coords = this.computeCoords();
            if (coords.length > 0) {
                var polygonOptions = {};
                polygonOptions.altitudeMode =  ge.ALTITUDE_RELATIVE_TO_GROUND; 
                var polygon = ge_gex.dom.buildPolygon(_.map(coords, function(coord) {
                    return [coord.lat, coord.lng, coord.alt];
                }), polygonOptions);
                this.placemark.setGeometry(polygon);
            }
        }
    },

    erase: function() {
        if (!_.isUndefined(this.placemark)) {
            var geometry = this.placemark.getGeometry();
            var station = this.options.station;
            this.commandFeatures.removeChild(this.placemark);
            this.close();
        }
    },

    close: function() {
        this.stopListening();
    }
});
$(function() {
    app.views = app.views || {};

    function parseAltitudeMode(ge, modeString) {
        // Return an AltitudeMode object corresponding to the given string.
        // Stolen directly from the old planner
        var kml = ('<Document>' + '<Placemark>' + '<Point>' +
                   '<coordinates>0,0</coordinates>' + '<altitudeMode>' +
                   modeString + '</altitudeMode>' + '</Point>' + '</Placemark>' + '</Document>');
        return (ge.parseKml(kml).getFeatures().getFirstChild().getGeometry()
                .getAltitudeMode());
    }

    function vectorDiff(vec1, vec2) {
        var l = vec1.length;
        return _.map(_.range(l), function(i) {
            return vec1[i] - vec2[i];
        });
    }

    function vectorAdd(vec1, vec2) {
        var l = vec1.length;
        return _.map(_.range(l), function(i) {
            return vec1[i] + vec2[i];
        });
    }

    function vectorAbs(vec) {
        return Math.sqrt(_.reduce(vec, function(memo, num) {
            return memo + Math.pow(num, 2);
        }, 0));
    }

    var EARTH_RADIUS_METERS = 6371010;
    var RAD2DEG = 180.0 / Math.PI;

    /*
     * Spherical Mercator projectionator,
     * from: https://github.com/geocam/geocamTiePoint/blob/master/geocamTiePoint/static/geocamTiePoint/js/coords.js
     */
    var ORIGIN_SHIFT = 2 * Math.PI * 6378137 / 2.0;

    function latLonToMeters(latLon) {
        var mx = latLon.lng * ORIGIN_SHIFT / 180;
        var my = Math.log(Math.tan((90 + latLon.lat) * Math.PI / 360)) /
            (Math.PI / 180);
        my = my * ORIGIN_SHIFT / 180;
        return {
            x: mx,
            y: my
        };
    }

    function metersToLatLon(meters) {
        var lng = meters.x * 180 / ORIGIN_SHIFT;
        var lat = meters.y * 180 / ORIGIN_SHIFT;
        lat = ((Math.atan(Math.exp((lat * (Math.PI / 180)))) * 360) / Math.PI) - 90;
        return {
            lat: lat,
            lng: lng
        };
    }

    function getBearing(pointA, pointB) {
        /*
         * Calculat the bearing in degrees from point A to point B
         * Source: http://williams.best.vwh.net/avform.htm#Crs
         */
        var lat1 = pointA.lat;
        var lon1 = pointA.lng;
        var lat2 = pointB.lat;
        var lon2 = pointB.lng;

        var bearing = Math.atan2(Math.sin(lon2 - lon1) * Math.cos(lat2), Math
                                 .cos(lat1) *
                                 Math.sin(lat2) -
                                 Math.sin(lat1) *
                                 Math.cos(lat2) *
                                 Math.cos(lon2 - lon1)) %
            (2 * Math.PI);
        bearing = bearing * 180 / Math.PI; // radions --> degrees
        if (bearing < 0.0) {
            bearing = bearing + 360.0;
        }
        return bearing;
    }

    function makeDraggable(placemark, options) {
        options = _.defaults(options, {
            startCallback: function(placemark, data) {
            },
            dragCallback: function(placemark, data) {
            },
            dropCallback: function(placemark, data) {
            },
            getObjectPosition: function(placemark) {
                var geom = placemark.getGeometry();
                return [geom.getLatitude(), geom.getLongitude()];
            }
            /*
              setPosition: function(placemark, lat, lon) {
              var geom = placemark.getGeometry();
              geom.setLatitiude(lat);
              geom.setLongitude(lon);
              },
            */
        });

        var dragEngaged = false;
        var data = {
            cursorStartPos: undefined, // [lat, lon] position of the drag start point
            cursorPos: undefined
            // [lat, lon] of the current cursor while dragging
            //objectStartPos: undefined,
            //objectPos: undefined, // Whatever we determine to be the object's "location" ( i.e. the output of the getObjectPosition() callback )
            //dragOffset: undefined, // [lat, lon] offset between the curson position and object position
        };

        function dragStart(evt) {
            evt.preventDefault();
            dragEngaged = true;
            //data.objectPos = data.objectStartPos = options.getObjectPosition(placemark);
            data.cursorStartPos = data.cursorPos = [evt.getLatitude(),
                                                    evt.getLongitude()];
            google.earth.addEventListener(ge.getWindow(), 'mouseup', dragEnd);
            google.earth
                .addEventListener(ge.getWindow(), 'mousemove', dragMove);
            options.startCallback(placemark, data);
        }

        function dragMove(evt) {
            evt.preventDefault();
            data.cursorPos = [evt.getLatitude(), evt.getLongitude()];
            options.dragCallback(placemark, data);
        }

        function dragEnd(evt) {
            evt.preventDefault();
            dragEngaged = false;
            //data.dragOffset = undefined;
            google.earth.removeEventListener(ge.getWindow(), 'mouseup', dragEnd);
            google.earth.removeEventListener(ge.getWindow(), 'mousemove', dragMove);
            options.dropCallback(placemark, data);
        }

        google.earth.addEventListener(placemark, 'mousedown', dragStart);
        return [placemark, 'mousedown', dragStart]; // Need these references to tear down the event handler later.
    }

    app.views.EarthView = Backbone.View.extend({
            el: 'div',

            initialize: function(options) {
                this.options = options || {};
                _.bindAll(this);
                if (!app.options.offline) {
                    this.on('earth:loaded', this.render);
                    google.load('earth', '1', {
                        callback: this.render
                    });
                } else {
                    this.$el.css({
                        'background-color' : 'blue'
                    });
                }
                this.$el.resizable();
                // pre-set certain variables to speed up this code
                app.State.pageContainer = this.$el.parent();
                app.State.tabsContainer = $('#tabs');
                app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
                var horizOrigin = this.$el.width();
                this.$el.bind('resize', function() {
                    if (app.State.mapResized == false && app.map.$el.width() != horizOrigin) {
                        app.State.mapResized = true;
                    } else {
                        // only change element widths if the horizontal width has changed at least once
                        return;
                    }
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                });
                // also bind to window to adjust on window size change
                $(window).bind('resize', function() {
                    // window size changed, so variables need to be reset
                    if (_.isUndefined(app.tabs.currentView)) {return;}
                    if (!app.State.mapResized) {return;} // until the element is resized once, resizing happens automatically
                    app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                    app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                });

            },

            render: function() {
                //           console.log('re-rendering map');
                google.earth.createInstance(this.el, _.bind(this.earthInit,
                                                            this), _.bind(this.earthFailure, this));
            },

            earthInit: function(ge) {
                this.ge = ge;
                window.ge = ge;
                ge.getWindow().setVisibility(true);
                app.vent.trigger('earth:init');

                // Configure the Earth instance
                ge.getNavigationControl().setVisibility(ge.VISIBILITY_AUTO);
                ge.getLayerRoot().enableLayerById(ge.LAYER_BORDERS, true);
                ge.getLayerRoot().enableLayerById(ge.LAYER_ROADS, true);

                ge.getLayerRoot().enableLayerById(ge.LAYER_TERRAIN, true);
                ge.getLayerRoot().enableLayerById(ge.LAYER_BUILDINGS, true);
                ge.getOptions().setScaleLegendVisibility(true);
                ge.getOptions().setUnitsFeetMiles(false);
                ge.getOptions().setFlyToSpeed(ge.SPEED_TELEPORT);

                // Disable the terrain
                //ge.getLayerRoot().enableLayerById(ge.LAYER_TERRAIN, false);

                // Event to prevent double-clicks on the map (they're confusing)
                google.earth.addEventListener(ge.getGlobe(), 'dblclick',
                                              function(evt) {
                                                  evt.preventDefault();
                                              });

                // Event to auto untilt the map
                google.earth
                    .addEventListener(
                        ge.getView(),
                        'viewchangeend',
                        function() {
                            if (!app.State.planKMLLoaded)
                                return; // don't untilt until KML is loaded
                            if (!_
                                .isUndefined(app.State.untiltTimeoutId)) {
                                clearTimeout(app.State.untiltTimeoutId);
                                app.State.untiltTimeoutId = undefined;
                            }
                            if (app.State.untiltModalEnabled) {
                                app.State.untiltTimeoutId = setTimeout(
                                    function() {
                                        app.map.untiltMap();
                                        app.State.untiltTimeoutId = undefined;
                                    }, 500);
                            }
                        });

                // Clear timeout if user has started moving map again
                google.earth.addEventListener(ge.getView(),
                                              'viewchangebegin', function() {
                                                  if (!_.isUndefined(app.State.untiltTimeoutId)) {
                                                      clearTimeout(app.State.untiltTimeoutId);
                                                      app.State.untiltTimeoutId = undefined;
                                                  }
                                              }, 500);

                this.ge_gex = new GEarthExtensions(ge);
                // for certain global event handlers
                window.ge_gex = this.ge_gex;

                app.options.XGDS_PLANNER_CLAMP_MODE_JS = parseAltitudeMode(
                    this.ge, app.options.XGDS_PLANNER2_CLAMP_MODE_KML ||
                        'relativeToSeaFloor');

                var cb = app.options.XGDS_PLANNER_EARTH_LOADED_CALLBACK;
                if (cb != null) {
                    cb();
                }

                app.vent.trigger('earth:init');
                this.trigger('earth:init');
                this.drawPlan();
                app.vent.trigger('clearSaveStatus');
                app.vent.trigger('earth:loaded');
            },

            untiltMap: function() {
                var lookAt = app.map.ge.getView().copyAsLookAt(
                    app.map.ge.ALTITUDE_RELATIVE_TO_GROUND);
                if (lookAt.getTilt() == 0)
                    return; // map isn't tilted
                lookAt.setTilt(0);
                app.map.ge.getView().setAbstractView(lookAt);
            },

            earthFailure: function() {
                // the map view has a big "earth plugin not available"
                // text, so an alert isn't very necessary
                //alert("Earth plugin failed to load.");
                app.vent.trigger('earth:failed');
            },

            drawPlan: function() {
                if (this.planView) {
                    alert("PlanView was previosly instantiated.  It's intended to be a singleton.");
                }
                this.planView = new PlanKmlView({
                    collection: app.currentPlan.get('sequence'),
                    ge: this.ge
                });
                this.planView.render();
                this.ge.getFeatures().appendChild(this.planView.doc);
                window.ge_gex.util.flyToObject(this.planView.doc);
            }

        });

    // This view class manages a KML Document object that represents an entire plan.
    // On instantiation, pass in the plan sequence Backbone collection as the "collection" arguement.
    var PlanKmlView = Backbone.View
        .extend({
            // KML boilerplate and styles live in templates/handlebars/plan-kml.handlebars
            template: Handlebars.compile($('#template-plan-kml').html()),
            geEvents: [], // container holds GE events for later removal

            initialize: function(options) {
                this.options = options || {};
                var ge = this.ge = this.options.ge;
                var doc = this.doc = ge.parseKml(this.template({
                    options: app.options
                }));
                this.stationsFolder = ge_gex.dom.buildFolder({
                    name: 'stations'
                });
                this.dragHandlesFolder = ge_gex.dom.buildFolder({
                    name: 'dragHandles'
                });
                this.segmentsFolder = ge_gex.dom.buildFolder({
                    name: 'segments'
                });
                this.fovWedgesFolder = ge_gex.dom.buildFolder({
                    name: 'fovWedges'
                });
                this.commandFolder = ge_gex.dom.buildFolder({
                    name: 'commands'
                });
                this.kmlFolders = [this.stationsFolder,
                                   this.segmentsFolder, this.dragHandlesFolder,
                                   this.fovWedgesFolder,
                                   this.commandFolder];
                _.each(this.kmlFolders, function(folder) {
                    doc.getFeatures().appendChild(folder);
                });

                // re-rendering the whole KML View on add proves to be pretty slow.
                //this.collection.on('add', this.render, this);
                app.vent.on('mapmode', this.setMode, this);
                app.vent.trigger('mapmode', 'navigate');
                
                this.collection.resequence(); // Sometimes it doesn't resequence itself on load
                this.collection.plan.kmlView = this; // This is here so we can reference it via global scope from inside GE Event handlers.  Grrrr....
                this.listenTo(app.currentPlan, 'sync', this.render, this);

                // move to bounding box defined in plan, probably wrong place to do this
                var site = app.currentPlan.get('site');
                if (site != undefined)
                    var bbox = site.bbox;
                if (bbox != undefined) {
                    var aspect = $('#map').width() / $('#map').height();
                    var folder = ge_gex.dom.addFolder([
                        ge_gex.dom.buildPointPlacemark([bbox[0],
                                                        bbox[1]]),
                        ge_gex.dom.buildPointPlacemark([bbox[2],
                                                        bbox[3]])]);
                    var bounds = ge_gex.dom.computeBounds(folder);
                    ge_gex.view.setToBoundsView(bounds, {
                        aspectRatio: aspect,
                        scaleRange: 1.2
                    });
                    ge_gex.dom.removeObject(folder);
                }

                // set state so untilt can begin
                app.State.planKMLLoaded = true;
            },

            clearKmlFolder: function(folder) {
                var featureContainer = folder.getFeatures();
                while (featureContainer.hasChildNodes()) {
                    featureContainer.removeChild(featureContainer
                                                 .getLastChild());
                }
            },

            render: function() {
                //console.log('re-rending kml');
                _.each(this.kmlFolders, this.clearKmlFolder);
                this.drawStations();
                this.drawSegments();
                if (this.currentMode) {
                    this.resetMode();
                }
            },

            drawStation: function(station) {
//                console.log("making station point view " + station.id)
                var stationPointView = new StationPointView({
                    ge: this.ge,
                    model: station,
                    planKmlView: this
                });
                var stationFeatures = this.stationsFolder.getFeatures();
                stationFeatures.appendChild(stationPointView.placemark);

                //station.on('change', function(station) {
                //    console.log('geometry change: ' + JSON.stringify(station.get('geometry').coordinates));
                //});

                return stationPointView;
            },

            drawStations: function() {
                this.stationViews = [];
                _.each(this.collection.filter(function(model) {
                    return model.get('type') == 'Station';
                }), function(station) {
                    this.stationViews.push(this.drawStation(station));
                }, this // view context
                      );

                _.each(this.stationViews, function(stationView) {
                    stationView.addPolygons();
                });
            },

            drawSegment: function(segment, fromStation, toStation) {
                var segmentLineView = new SegmentLineView({
                    model: segment,
                    fromStation: fromStation,
                    toStation: toStation,
                    ge: this.ge
                });
                segment._geSegment = segmentLineView;
                this.segmentsFolder.getFeatures().appendChild(
                    segmentLineView.placemark);
            },

            drawSegments: function() {
                if (this.segmentsFolder.getFeatures().hasChildNodes()) {
                    this.clearKmlFolder(this.segmentsFolder);
                }
                this.collection.each(function(item, index, list) {
                    if (item.get('type') == 'Segment') {
                        var fromStation = list[index - 1];
                        var toStation = list[index + 1];
                        this.drawSegment(item, fromStation, toStation);
                    }
                }, this);
            },

            // Add an event handler and store a reference to it so we can clean up later.
            addGeEvent: function(target, eventID, listenerCallback,
                                 useCapture) {
                this.geEvents.push(arguments);
                google.earth.addEventListener(target, eventID,
                                              listenerCallback, useCapture);
            },

            // Remove event handlers that were added with this.addGeEvent()
            clearGeEvents: function() {
                while (this.geEvents.length > 0) {
                    google.earth.removeEventListener.apply(google.earth,
                                                           this.geEvents.pop());
                }
            },

            setMode: function(modeName) {
                //console.log('Set mouse mode: ' + modeName);
                var modeMap = {
                    'addStations' : 'addStationsMode',
                    'navigate' : 'navigateMode',
                    'reposition' : 'repositionMode'
                };

                if (this.currentMode) {
                    this.currentMode.exit.call(this);
                }
                var mode = _.isObject(modeName) ? modeName : this[modeMap[modeName]];
                mode.enter.call(this);
                this.currentMode = mode;
                this.currentModeName = modeName;
            },

            // Clean up, then re-enter the mode.  Useful for re-draws/
            resetMode: function() {
                if (this.currentMode) {
                    var mode = this.currentMode;
                    mode.exit.call(this);
                    mode.enter.call(this);
                }
            },

            addStationsMode: {
                enter: function() {
                    this.clearGeEvents();
                    this.addGeEvent(this.ge.getGlobe(), 'mousedown',
                                    this.addStationsMouseDown);
                    this.addGeEvent(this.ge.getGlobe(), 'mousemove',
                                    this.addStationsMouseMove);
                    this.addGeEvent(this.ge.getGlobe(), 'mouseup',
                                    this.addStationsMouseUp);
                    app.State.disableAddStation = false; // reset state possibly set in other mode
                },
                exit: function() {
                    // nothing
                }
            }, // end addStationMode

            navigateMode: {
                enter: function() {
                    this.clearGeEvents();
                    var stations = this.stationsFolder.getFeatures()
                        .getChildNodes();
                    var l = stations.getLength();
                    for (var i = 0; i < l; i++) {
                        var placemark = stations.item(i);
                        var station = getGeCache(placemark).view;
                        this.addGeEvent(placemark, 'dblclick',
                                        function(evt) {
                                            evt.preventDefault();
                                        });
                    }
                },
                exit: function() {
                    // nothing
                }
            },

            repositionMode: {
                enter: function() {
                    this.clearGeEvents();
                    var planview = this;
                    var stations = this.stationsFolder.getFeatures()
                        .getChildNodes();
                    var l = stations.getLength();
                    var point;
                    for (var station, i = 0; i < l; i++) {
                        station = stations.item(i);
                        //point = station.getGeometry().getGeometries().getFirstChild();
                        if (app.options.mapRotationHandles) {
                            var handle = getGeCache(station).view
                                .createDragRotateHandle();
                        }
                        this.processStation(station, handle);
                    }
                    this.drawMidpoints();

                }, // end enter
                exit: function() {
                    this.destroyMidpoints();
                    var stations = this.stationsFolder.getFeatures()
                        .getChildNodes();
                    var l = stations.getLength();
                    for (var station, i = 0; i < l; i++) {
                        station = stations.item(i);
                        window.ge_gex.edit.endDraggable(station);

                        getGeCache(station).view.model.off('change:headingDegrees'); // kill drag handle update binding
                    }

                    this.clearKmlFolder(this.dragHandlesFolder);

                }
            }, // end repositionMode

            addStationsMouseDown: function(evt) {
                if (app.State.disableAddStation) {
                    // don't react to a single click
                    // usually from events that fire before this one is
                    app.State.disableAddStation = false;
                    return;
                }
                var distance = -1;
                if (!_.isUndefined(app.State.addStationLocation) &&
                    _.isFinite(app.State.addStationTime)) {
                    distance = Math.sqrt(Math.pow(evt.getClientX() - app.State.addStationLocation[0], 2),
                                         Math.pow(evt.getClientY() - app.State.addStationLocation[1], 2));
                }
                if ((Date.now() - app.State.addStationTime >= 300) || // at least 300ms past last station added
                    (distance >= 5 || distance == -1)) { // at least five client pixels away from the last station
                    // or no previous click or added station
                    // start state change leading to adding a station
                    app.State.addStationOnMouseUp = true;
                    app.State.mouseDownLocation = [evt.getClientX(),
                                                   evt.getClientY()];
                }
            },

            addStationsMouseMove: function(evt) {
                if (_.isUndefined(app.State.mouseDownLocation))
                    return;
                var distance = Math.sqrt(Math.pow(evt.getClientX() - app.State.mouseDownLocation[0], 2),
                                         Math.pow(evt.getClientY() - app.State.mouseDownLocation[1], 2));
                if (distance >= 5) { // allow for small movements due to double-clicking on touchpad
                    app.State.addStationOnMouseUp = false;
                    app.State.mouseDownLocation = undefined;
                }
            },

            addStationsMouseUp: function(evt) {
                if (_.isUndefined(app.State.mouseDownLocation))
                    return;
                if (!_.isBoolean(app.State.addStationOnMouseUp) ||
                    !app.State.addStationOnMouseUp)
                    return;
                var distance = Math.sqrt(Math.pow(evt.getClientX() - app.State.mouseDownLocation[0], 2),
                                         Math.pow(evt.getClientY() - app.State.mouseDownLocation[1], 2));
                if (distance < 5) { // all conditions met to add station
                    var coords = [evt.getLongitude(), evt.getLatitude()];
                    var station = app.models.stationFactory({
                        coordinates: coords
                    });
                    var seq = app.currentPlan.get('sequence');
                    seq.appendStation(station); // returns a segment if one was created
                    // this returns an array of the last three elements
                    var end = seq.last(3);

                    // Jump through some hoops to avoid a slow total re-render.  Not really thrilled with this solution.
                    app.currentPlan.kmlView.drawStation(station);

                    // only drow a segment if other stations exist
                    if (end.length == 3) {
                        app.currentPlan.kmlView.drawSegment(end[1], end[0],
                                                            end[2]);
                    }

                    // set time and location for added station
                    app.State.addStationLocation = [evt.getClientX(),
                                                    evt.getClientY()];
                    app.State.addStationTime = Date.now();
                }

                // reset state
                app.State.mouseDownLocation = undefined;
                app.State.addStationOnMouseUp = false;
            },

            processStation: function(stationPoint, handle) {
                // do all the other things related to drawing a station on the map
                var view = app.currentPlan.kmlView;
                var station = getGeCache(stationPoint).view;
                if (app.mapRotationHandles) {
                    station._geHandle = handle;
                    view.dragHandlesFolder.getFeatures().appendChild(
                        station._geHandle);
                }
                view
                    .addGeEvent(
                        stationPoint,
                        'dblclick',
                        function(evt) {
                            evt.preventDefault();
                            app.Actions.disable();
                            var pm = evt.getTarget();
                            var sequence = app.currentPlan
                                .get('sequence');
                            var index = sequence
			        .indexOf(getGeCache(pm).view.model);
                            var segmentBefore = sequence
                                .at(index - 1);
                            var segmentAfter = sequence
                                .at(index + 1);
                            sequence.removeStation(getGeCache(pm).view.model);
                            getGeCache(pm).view.remove();
                            var newSegment = sequence.at(index - 1);
                            view.stationsFolder.getFeatures()
                                .removeChild(pm);
                            if (!_.isUndefined(segmentBefore))
                                view.segmentsFolder
                                .getFeatures()
                                .removeChild(
                                    segmentBefore._geSegment.placemark);
                            if (!_.isUndefined(segmentAfter))
                                view.segmentsFolder
                                .getFeatures()
                                .removeChild(
                                    segmentAfter._geSegment.placemark);
                            if (app.mapRotationHandles) {
                                view.dragHandlesFolder
                                    .getFeatures().removeChild(
                                        station._geHandle);
                            }
                            view.stationsFolder.getFeatures()
                                .removeChild(stationPoint);
                            if (!_.isUndefined(newSegment))
                                view.drawSegment(newSegment,
                                                 sequence.at(index - 2),
                                                 sequence.at(index));
                            view.destroyMidpoints();
                            view.drawMidpoints();
                            app.Actions.enable();
                            app.Actions.action();
                        });
                window.ge_gex.edit.makeDraggable(stationPoint, {
                    bounce: false,
                    dragCallback: function() {
                        //nothing
                    },
                    dropCallback: function() {
                        // 'this' is the placemark GE object
                        app.Actions.disable();
                        var theView = getGeCache(stationPoint).view;
                        var model = theView.model;
                        var point = this.getGeometry();
                        
                        model.setPoint({
                            lng: point.getLongitude(),
                            lat: point.getLatitude()
                        });
                        if (app.mapRotationHandles) {
                            var newHandle = station.createDragRotateHandle();
                            view.dragHandlesFolder.getFeatures().removeChild(station._geHandle);
                            station._geHandle = newHandle;
                            view.dragHandlesFolder.getFeatures().appendChild(station._geHandle);
                        }
                        view.updateStationMidpoints(station.model);
                        app.Actions.enable();
                        app.Actions.action();
                    }
                });
            },

            updateMidpointPlacemark: function(midpointPlacemark, station1, station2){
                var points = [];
                _.each([station1, station2], function(station) {
                    var coords = station.get('geometry').coordinates;
                    points.push([coords[1], coords[0]]);
                });
                var midpoint = calcMidpoint(points);
                var kmlPoint = midpointPlacemark.getGeometry();
                kmlPoint.setLatLng.apply(kmlPoint, midpoint);
            },

            updateStationMidpoints: function(station) {
                if (!this.midpointsFolder) {
                    this.drawMidpoints();
                    return;
                }
                var fldrFeatures = this.midpointsFolder.getFeatures();

                this.collection.each(function(item, idx, list) {
                    var station1, station2;
                    if (item.get('type') == 'Segment') {
                        if (list[idx + 1] == station) {
                            // first segment, next point is station
                            var midpointIndex = Math.floor(idx / 2);
                            var midpointPlacemark = fldrFeatures.getChildNodes().item(midpointIndex);
                            app.currentPlan.kmlView.updateMidpointPlacemark(midpointPlacemark, list[idx - 1], list[idx + 1]);
                        } else if (list[idx -1 ] == station) {
                            // last segment
                            var midpointIndex = Math.floor(idx / 2);
                            var midpointPlacemark = fldrFeatures.getChildNodes().item(midpointIndex);
                            app.currentPlan.kmlView.updateMidpointPlacemark(midpointPlacemark, list[idx - 1], list[idx + 1]);
                            return;
                        }
                    }
                }, this);
            },

            drawMidpoints: function() {
                if (!this.midpointsFolder) {
                    this.midpointsFolder = window.ge_gex.dom.buildFolder({
                        name: 'midpoints'
                    });
                }
                this.doc.getFeatures().appendChild(this.midpointsFolder);
                var fldrFeatures = this.midpointsFolder.getFeatures();

                this.collection.each(function(item, idx, list) {
                    var station1, station2;
                    if (item.get('type') == 'Segment') {
                        station1 = list[idx - 1];
                        station2 = list[idx + 1];
                        midpoint = midpointPlacemark({
                            ge: this.ge,
                            segment: item,
                            index: idx,
                            station1: station1,
                            station2: station2,
                            view: this
                        });
                        fldrFeatures.appendChild(midpoint);
                    }
                }, this);
                this.kmlFolders.push(this.midpointsFolder);
            },

            destroyMidpoints: function() {
                this.doc.getFeatures().removeChild(this.midpointsFolder);
                this.kmlFolders.pop();
                delete this.midpointsFolder;
            }
        });

    // This view class manages the map point for a single Station model
    var StationPointView = Backbone.View
        .extend({
            initialize: function(options) {
                this.options = options || {};
                this.planKmlView = this.options.planKmlView;

                // var gex = this.options.ge_gex;
                var gex = window.ge_gex;
                var pmOptions = {};
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                pmOptions.name = name || this.model.toString();
                pmOptions.altitudeMode = app.options.plannerClampMode ||
                    this.options.ge.ALTITUDE_RELATIVE_TO_GROUND; // ALTITUDE_CLAMP_TO_GROUND;
                var point = this.model.get('geometry').coordinates; // lon, lat

                var pointGeom = gex.dom.buildPoint([point[1], point[0], 1.0]); // lat, lon  //FIX for drawing polygons on top

                pmOptions.point = pointGeom;
                this.placemark = gex.dom.buildPlacemark(pmOptions);
                this.updateStyle();

                // Change click event for station points
                google.earth.addEventListener(this.placemark, 'click', _
                                              .bind(function(evt) {
                                                  evt.preventDefault();
                                                  app.State.stationSelected = this.model;
                                                  app.State.metaExpanded = true;
                                                  app.State.addCommandsExpanded = false;
                                                  app.State.commandSelected = undefined;
                                                  if (app.currentTab != 'sequence') {
                                                      app.vent.trigger('setTabRequested',
                                                                       'sequence');
                                                  } else {
                                                      app.tabs.currentView.tabContent.currentView
                                                          .render();
                                                  }
                                              }, this));

                // Keep from creating a new station when clicking on an existing one in
                // add stations mode
                google.earth.addEventListener(this.placemark, 'mousedown',
                                              function(evt) {
                                                  app.State.disableAddStation = true;
                                              });

                getGeCache(this.placemark).view = this; // 2-way link for GE event handlers to use
                this.listenTo(this.model, 'change', this.redraw);
                this.listenTo(this.model, 'add:sequence remove:sequence',
                              function(command, collection, event) {
                                  if (command.hasParam('showWedge')) {
                                      this.redrawPolygons();
                                  } else if (command.get('type').indexOf('Pattern') > 0) {
                                      this.redrawPolygons();
                                  }
                              });

                // redraw when we're selected
                this.listenTo(app.vent, 'showItem:station', function() {
                    this.redraw();
                });
                // redraw when we've been unselected
                this.listenTo(app.vent, 'tab:change', function() {
                    this.redraw();
                });
                this.listenTo(app.vent, 'showItem:segment', function() {
                    this.redraw();
                });
            },

            redrawHandles: function() {
                if (!app.mapRotationHandles)
                    return;
                if (_.isUndefined(this._geHandle))
                    return;
                if (app.currentPlan.kmlView.currentModeName != 'reposition')
                    return;
                app.currentPlan.kmlView.dragHandlesFolder.getFeatures()
                    .removeChild(this._geHandle);
                this._geHandle = this.createDragRotateHandle();
                app.currentPlan.kmlView.dragHandlesFolder.getFeatures()
                    .appendChild(this._geHandle);
                app.currentPlan.kmlView.destroyMidpoints();
                app.currentPlan.kmlView.drawMidpoints();
            },

            redraw: function() {
                if (this.placemark === undefined){
                    return;
                }
                // redraw code. To be invoked when relevant model attributes change.
                app.Actions.disable();
                var kmlPoint = this.placemark.getGeometry();

                var coords = this.model.get('geometry').coordinates; // lon, lat
                if (this.placemark.getGeometry().getLongitude() - coords[0] != 0 ||
                    this.placemark.getGeometry().getLatitude() - coords[1] != 0)
                    this.redrawHandles();
                coords = [coords[1], coords[0]]; // lat, lon
                kmlPoint.setLatLng.apply(kmlPoint, coords);
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                this.placemark.setName(name || this.model.toString());
                this.updateStyle();
//                console.log('redrawing point ' + name);

                if (this.wedgeViews) {
                    _.each(this.wedgeViews, function(wedgeView) {
                        wedgeView.update();
                    });
                }
                if (this.commandViews) {
                    _.each(this.commandViews, function(commandView) {
                        commandView.update();
                    });
                }
                app.Actions.enable();
                app.Actions.action();
            },

            updateHeadingStyle: function() {
                var heading = 0.0;
                try {
                    heading = this.model.get('headingDegrees');
                } catch(err) {
                    // nothing
                }
                if (_.isUndefined(heading) || _.isNull(heading)){
                    heading = 0.0;
                }  
                var style = this.placemark.getStyleSelector();
                if (_.isUndefined(style) || _.isNull(style)){
                    style = ge.createStyle('');
                    this.placemark.setStyleSelector(style);
                }
                var iconStyle = style.getIconStyle();
                if (!_.isUndefined(iconStyle)){
                    iconStyle.setHeading(heading);
                }
            },

            updateStyle: function() {
                if (app.State.stationSelected === this.model) {
                    if (this.model.get('isDirectional')) {
                        this.placemark.setStyleUrl("#selectedDirection");
                        this.updateHeadingStyle();
                    } else {
                        this.placemark.setStyleUrl("#selectedStation");
                    }
                } else {
                    if (this.model.get('isDirectional')) {
                        this.placemark.setStyleUrl("#direction");
                        this.updateHeadingStyle();
                    } else {
                        this.placemark.setStyleUrl("#station");
                    }
                }
            },


            dragRotateHandleCoords: function() {

                //var radius = 14.0; // distance in meters in front of the waypoint location to place the rotational handle.  Should be made dynamic with zoom level
                var cameraAltitude = ge.getView().copyAsCamera(
                    ge.ALTITUDE_RELATIVE_TO_GROUND).getAltitude();
                var radius = 0.25 * cameraAltitude; // distance in meters in front of the waypoint location to place the rotational handle.

                var theta = this.model.get('headingDegrees') * Math.PI / 180.00; // radians
                var stationCoords = this.model.get('geometry').coordinates;
                var stationPosMeters = latLonToMeters({
                    lat: stationCoords[1],
                    lng: stationCoords[0]
                });
                var handlePosMeters = {
                    x: stationPosMeters.x + radius * Math.sin(theta),
                    y: stationPosMeters.y + radius * Math.cos(theta)
                };
                return metersToLatLon(handlePosMeters);
            },

            updateDragRotateHandlePm: function() {
                var gex = this.options.ge_gex;
                var newLatLng = this.dragRotateHandleCoords();

                var geom = this.dragHandlePm.getGeometry(); // a MultiGeometry
                var point = geom.getGeometries().getFirstChild();
                point.setLatLng(newLatLng.lat, newLatLng.lng);

                var stLoc = this.model.get('geometry').coordinates; // lon, lat
                stLoc = _.object(['lat', 'lng'], stLoc);

                var newLineString = gex.dom.buildLineString([
                    [stLoc.lat, stLoc.lng],
                    [newLatLng.lat, newLatLng.lng]]);
                var oldLineString = geom.getGeometries().getLastChild();
                geom.getGeometries().replaceChild(newLineString,
                                                  oldLineString);
            },

            createDragRotateHandle: function() {
                if (!app.mapRotationHandles)
                    return;
                var station = this.model;
                var gex = this.options.ge_gex;

                var coords = this.dragRotateHandleCoords();
                var stLoc = _.object(['lng', 'lat'], this.model
                                     .get('geometry').coordinates);
                var linestring = gex.dom.buildLineString([
                    [stLoc.lat, stLoc.lng],
                    [coords.lat, coords.lng]], {
                        tessellate: true
                    });

                this.dragHandlePm = gex.dom.buildPlacemark({
                    point: new geo.Point([coords.lat, coords.lng]),
                    lineString: linestring,
                    style: '#direction' // circle with a target
                });

                this.model.on('change:headingDegrees',
                              this.updateDragRotateHandlePm, this);
                var station = this.model;

                makeDraggable(this.dragHandlePm, {
                    //getPosition: function(placemark) { var loc = placemark.getGeometry().getLocation(); return [loc.getLatitude(), loc.getLongitude()]; },
                    startCallback: function(placemark, data) {
                        //console.log('mousedown');
                        var coords = station.get('geometry').coordinates;
                        data.stationLoc = {
                            lng: coords[0],
                            lat: coords[1]
                        };
                        data.startHeading = station.get('headingDegrees');
                    },
                    dragCallback: function(placemark, data) {
                        var newHeading = getBearing(data.stationLoc, _
                                                    .object(['lat', 'lng'], data.cursorPos));
                        //console.log(newHeading);
                        station.set({
                            headingDegrees: newHeading,
                            isDirectional: true
                        });
                    }
                });

                return this.dragHandlePm;
            },

            addPolygons: function() {
                var station = this.model;
                var commandViews = this.commandViews = [];
                var commandFeatures = this.planKmlView.commandFolder.getFeatures();

                var wedgeViews = this.wedgeViews = [];
                var wedgeFeatures = this.planKmlView.fovWedgesFolder.getFeatures();

                this.model.get('sequence').each(function(command) {
                    if (command.hasParam('showWedge')) {
                        var wedgeView = new PanoWedgeView({
                            station: station,
                            command: command,
                            wedgeFeatures: wedgeFeatures
                        });
                        wedgeViews.push(wedgeView);
                        wedgeFeatures.appendChild(wedgeView.placemark);
                    } else {
                        if (command.get('type') in app.commandRenderers) {
                            var typeKey = command.get('type');
                            var foundClass = app.commandRenderers[typeKey];
                            var theClass = window[foundClass];

                            var commandView = new theClass({
                                station: station,
                                command: command,
                                commandFeatures: commandFeatures
                            });
                            commandViews.push(commandView);
                            commandFeatures.appendChild(commandView.placemark);
                        }
                    }
                });
            },

            destroyPolygons: function() {
                var wedgeFeatures = this.planKmlView.fovWedgesFolder
                    .getFeatures();

                if (!_.isUndefined(this.wedgeViews)) {
                    while (this.wedgeViews.length > 0) {
                        wedgeView = this.wedgeViews.pop();
                        wedgeFeatures.removeChild(wedgeView.placemark);
                        wedgeView.close();
                    }
                }

                var commandFeatures = this.planKmlView.commandFolder.getFeatures();

                if (!_.isUndefined(this.commandViews)) {
                    while (this.commandViews.length > 0) {
                        commandView = this.commandViews.pop();
                        commandFeatures.removeChild(commandView.placemark);
                        commandView.close();
                    }
                }

            },

            redrawPolygons: function() {
                this.destroyPolygons();
                this.addPolygons();
            },

            close: function() {
                this.destroyPolygons();
                this.stopListening();
            }

        });

    var SegmentLineView = Backbone.View
        .extend({
            initialize: function(options) {
                this.options = options || {};
                var options = this.options;
                if (!options.ge && options.toStation && options.fromStation) {
                    throw 'Missing a required option!';
                }
                this.ge = this.options.ge;
                this.gex = this.options.ge_gex;
                this.fromStation = this.options.fromStation;
                this.toStation = this.options.toStation;
                this.otherStation = {};
                this.otherStation[options.toStation.cid] = options.fromStation;
                this.otherStation[options.fromStation.cid] = options.toStation;
                _
                    .each(
                        [this.fromStation, this.toStation],
                        function(stationModel) {
                            stationModel
                                .on(
                                    'change:geometry',
                                    function() {
                                        this
                                            .updateGeom(stationModel);
                                    }, this);
                            stationModel
                                .on(
                                    'dragUpdate',
                                    function(placemark) {
                                        var geom = placemark
                                            .getGeometry();
                                        var coords = {
                                            lat: geom
                                                .getLatitude(),
                                            lng: geom
                                                .getLongitude()
                                        };
                                        this
                                            .update(
						this.otherStation[getGeCache(placemark.view).model.cid],
                                                coords);
                                    }, this);
                        }, this);
                this.render();
                this.listenTo(this.model,
                              'add:sequence delete:sequence change:sequence',
                              function(evt, options) {
                                  this.updateStyle();
                              }, this);
            },

            render: function() {
                //console.log('re-rendering segment');
                var coords = _.map([this.fromStation, this.toStation],
                                   function(station) {
                                       var geom = station.get('geometry').coordinates;
                                       return [geom[1], geom[0]]; // Lon, Lat
                                   });

                var linestring = window.ge_gex.dom.buildLineString(coords, {
                    tessellate: true
                });
                var style = this.model.get('sequence').isEmpty() ?
                    '#segment' : '#segment_with_commands';
                this.placemark = window.ge_gex.dom.buildPlacemark({
                    lineString: linestring,
                    style: style,
                    altitudeMode: app.options.plannerClampMode ||
                        this.ge.ALTITUDE_CLAMP_TO_GROUND
                });
                this.updateGeom.apply(this, coords);
            },

            /*
            ** Update the endpoints of the segment when either adjacent station changes.
            ** points can be either station PathElements, or an array of coordinates (lon, lat)
            ** You can also supply just one station PathElement
            */
            updateGeom: function(point1, point2) {

                if (_.isUndefined(point2) && !_.isUndefined(point1) && point1.cid) {
                    // only one model was supplied for update.  Go get the other one.
                    point2 = this.otherStation[point1.cid];
                }

                if (point1 && point2) {
                    var coords = [];
                    _.each([point1, point2], function(point) {
                        if (_.isArray(point)) {
                            coords.push(point);
                        } else if (_.isObject(point) && _.has(point, 'lat') && _.has(point, 'lng')) {
                            coords.push([point.lat, point.lng]);
                        } else if (_.isObject(point) && _.isFunction(point.get)) {
                            var geom = point.get('geometry').coordinates;
                            coords.push([geom[1], geom[0]]); // Lon, Lat --> lat, lon
                        }
                    });

                    var linestring = window.ge_gex.dom.buildLineString(coords, {
                        tessellate: true
                    });
                    this.placemark.setGeometry(linestring); // ???
                }

            },

            updateStyle: function() {
                var style = this.model.get('sequence').isEmpty() ?
                    '#segment' : '#segment_with_commands';
                this.placemark.setStyleUrl(style);
            }
        });

    /*
    ** Calculate the midpoint from an array of arrays of coordinates.
    */
    var calcMidpoint = function(coordsArr) {
        var sums = _.reduce(coordsArr, function(memo, arr) {
            var result = [];
            _.each(arr, function(n, idx) {
                result.push(n + memo[idx]);
            });
            return result;
        }, _.map(coordsArr[0], function() {
            return 0;
        }));
        return _.map(sums, function(n) {
            return n / coordsArr.length;
        });
    };

    var midpointPlacemark = function(options) {
        var points = [];
        _.each([options.station1, options.station2], function(station) {
            var coords = station.get('geometry').coordinates;
            points.push([coords[1], coords[0]]);
        });
        var midpoint = calcMidpoint(points);
        var placemark = window.ge_gex.dom.buildPlacemark({
            point: midpoint,
            style: '#midpoint'
        });

        window.ge_gex.edit.makeDraggable(placemark, {
            bounce: false,
            dropCallback: function() {
                app.Actions.disable();
                var view = options.view, index = options.index;
                var geom = this.getGeometry();
                var seq = app.currentPlan.get('sequence');
                var oldSegment = seq.at(index);
                var station = app.models.stationFactory({
                    coordinates: [geom.getLongitude(), geom.getLatitude()]
                });
                view.collection.insertStation(index, station);
                view.segmentsFolder.getFeatures().removeChild(
                    oldSegment._geSegment.placemark);
                var stationPointView = view.drawStation(station);
                var handle = stationPointView.createDragRotateHandle();
                view.processStation(stationPointView.placemark, handle);
                var idx = seq.indexOf(station);
                view.drawSegment(seq.at(idx - 1), seq.at(idx - 2), station);
                view.drawSegment(seq.at(idx + 1), station, seq.at(idx + 2));
                view.destroyMidpoints();
                view.drawMidpoints();
                app.Actions.enable();
                app.Actions.action();
            }
        });

        return placemark;
    };

    var PanoWedgeView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            //console.log('PanoWedgeView init: ' + this.cid);
            this.station = this.options.station;
            this.command = this.options.command;
            this.wedgeFeatures = this.options.wedgeFeatures;

            this.lineColor = 'ffffffff';
            var rgbFillColor = app
                .request('getColor', this.command.get('type'));
            this.fillColor = kmlColor(rgbFillColor, '80');
            this.placemark = this.createWedgePlacemark(this
                                                       .computeWedgeCoords());

            this.listenTo(this.command, 'change', this.update);
            this.listenTo(this.station, 'change', this.update);
            this.listenTo(this.station, 'change:geometry', this.update);
            this.listenTo(this.station, 'change:headingDegrees', this.update);
            this.listenTo(this.command, 'remove', this.erase);
            this.listenTo(this.station, 'remove', this.erase);
        },

        /*
         * Calculate the wedge polygon's coordinates and output them
         * as an array of objects with lat & lng properties.
         */
        computeWedgeCoords: function() {
            var station = this.station;
            var command = this.command;

            var stationLL = _.object(['lng', 'lat'],
                                     station.get('geometry').coordinates);
            var headingRadians = station.get('headingDegrees') * DEG2RAD;
            var hfov = command.get('hfov');
            var range = command.get('range');

            var fullCircle, leftAngle, RightAngle;
            if (hfov >= 360) {
                fullCircle = true;
                leftAngle = 0.0;
                rightAngle = 2 * Math.PI;
            } else {
                fullCircle = false;
                halfAngle = (hfov / 2.0) * DEG2RAD;
                leftAngle = headingRadians - halfAngle;
                rightAngle = headingRadians + halfAngle;
                while ((rightAngle - leftAngle) > 2 * Math.PI) {
                    rightAngle = rightAngle - 2 * Math.PI;
                }
                while ((rightAngle - leftAngle) < 0) {
                    rightAngle = rightAngle + 2 * Math.PI;
                }
            }
            wedgeCoords = [];

            // start wedge at the station point
            if (!fullCircle) {
                wedgeCoords.push(stationLL);
            }

            var theta = leftAngle;
            var dtheta = 3 * Math.PI / 180;
            var offsetMeters;

            while (theta < rightAngle) {
                offsetMeters = {
                    x: range * Math.sin(theta),
                    y: range * Math.cos(theta)
                };
                wedgeCoords.push(geo.addMeters(stationLL, offsetMeters));
                theta = theta + dtheta;
            }

            // end wedge at the station point
            if (!fullCircle) {
                wedgeCoords.push(stationLL);
            }

            return wedgeCoords;
        },

        createWedgePlacemark: function(wedgeCoords) {
            var gex = ge_gex;

            var visibility = this.command.get('showWedge');
            if (visibility === undefined)
                visibility = false;

            var polygon = gex.dom.buildPolygon(_.map(wedgeCoords, function(
                coord) {
                return [coord.lat, coord.lng];
            }));

            var style = gex.dom.buildStyle({
                line: {
                    color: this.lineColor
                },
                poly: {
                    fill: true,
                    outline: true,
                    color: this.fillColor
                }
            });

            var placemark = gex.dom.buildPolygonPlacemark(polygon, {
                style: style
            });
            placemark.setVisibility(visibility);
            return placemark;
        },

        update: function() {
            var visibility = this.command.get('showWedge');
            this.placemark.setVisibility(visibility);
            if (visibility) {
                var wedgeCoords = this.computeWedgeCoords();
                var polygon = ge_gex.dom.buildPolygon(_.map(wedgeCoords,
                                                            function(coord) {
                                                                return [coord.lat, coord.lng];
                                                            }));
                this.placemark.setGeometry(polygon);
            }
        },

        erase: function() {
            if (!_.isUndefined(this.placemark)) {
                var geometry = this.placemark.getGeometry();
                var station = this.options.station;
                this.wedgeFeatures.removeChild(this.placemark);
                this.close();
            }
        },

        close: function() {
            this.stopListening();
        }
    });

});
