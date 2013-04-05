$(function(){
    app.views = app.views || {};

    function parseAltitudeMode(ge, modeString) {
        // Return an AltitudeMode object corresponding to the given string.
        // Stolen directly from the old planner
        var kml = ('<Document>'
                   +'<Placemark>'
                   +'<Point>'
                   +'<coordinates>0,0</coordinates>'
                   +'<altitudeMode>'+modeString+'</altitudeMode>'
                   +'</Point>'
                   +'</Placemark>'
                   +'</Document>');
        return (ge.parseKml(kml)
                .getFeatures()
                .getFirstChild()
                .getGeometry()
                .getAltitudeMode());
    }

    function makeDraggable( placemark, options) {
        options = _.defaults(options, {
            dragCallback: function(placemark, lat, lon){},
            dropCallback: function(placemark, lat, lon){},
            getPosition: function(placemark){ var geom = placemark.getGeometry(); return [ geom.getLatitude(), geom.getLongitude() ]; },
            /*
            setPosition: function(placemark, lat, lon) {
                var geom = placemark.getGeometry();
                geom.setLatitiude(lat);
                geom.setLongitude(lon);
            },
            */
        });

        function vectorDiff(vec1, vec2){ var l = vec1.length; return _.map( _.range(l), function(i){ return vec1[i] - vec2[i]; }) };
        function vectorAdd(vec1, vec2){ var l = vec1.length; return _.map( _.range(l), function(i){ return vec1[i] + vec2[i]; }) };

        var dragEngaged = false;
        var startPos, dragOffset;

        function dragStart(evt) {
            startPos = options.getPosition(placemark);
            var cursorPos = [evt.getLatitude(), evt.getLongitude()];
            dragOffset = vectorDiff( cursorPos, startPos );
            dragEngaged = true;
            google.earth.addEventListener( placemark, 'mouseup', dragEnd)
            google.earth.addEventListener( placemark, 'mousemove', dragMove)
        };
        
        function dragMove(evt) {
            var cursorPos = [evt.getLatitude(), evt.getLongitude()];
            var newPos = vectorAdd(cursorPos, dragOffset);
            //options.setPosition(placemark, newPos[0], newPos[1]);
            options.dragCallback( placemark, newPos[0], newPos[1] );
        };

        function dragEnd(evt){
            dragEngaged = false;
            dragOffset = undefined;
            google.earth.removeEventListener( placemark, 'mouseup', dragEnd)
            google.earth.removeEventListener( placemark, 'mousemove', dragMove)
        };

        google.earth.addEventListener( placemark, 'mousedown', dragStart);
        return [placemark, 'mousedown', dragStart];  // Need these references to tear down the event handler later.
    };

    app.views.EarthView = Backbone.View.extend({
        el: 'div',

        initialize: function(){
            _.bindAll(this);
            if ( ! app.options.offline ) {
                this.on('earth:loaded', this.render);
                google.load('earth', '1', {
                    callback: this.render, 
                });
            } else {
                this.$el.css({'background-color': 'blue', 'height': '800px'});
            }
        },

       render: function(){
           google.earth.createInstance(this.el, _.bind(this.earthInit, this), _.bind(this.earthFailure, this));
        },

        earthInit: function(ge){
            this.ge = ge;
            window.ge = ge;
            ge.getWindow().setVisibility(true);
            app.vent.trigger("earth:init");

            // Configure the Earth instance
            ge.getNavigationControl().setVisibility(ge.VISIBILITY_AUTO);
            ge.getLayerRoot().enableLayerById(ge.LAYER_BORDERS, true);
            ge.getLayerRoot().enableLayerById(ge.LAYER_ROADS, true);
            ge.getOptions().setScaleLegendVisibility(true);
            ge.getOptions().setUnitsFeetMiles(false);
            ge.getOptions().setFlyToSpeed(ge.SPEED_TELEPORT);

            // Disable the terrain
            ge.getLayerRoot().enableLayerById(ge.LAYER_TERRAIN, false);
            
            ge.gex = new GEarthExtensions(ge);

            app.options.XGDS_PLANNER_CLAMP_MODE_JS =
                parseAltitudeMode(this.ge, app.options.XGDS_PLANNER2_CLAMP_MODE_KML || 'relativeToSeaFloor');
            
            app.vent.trigger('earth:init');
            this.trigger('earth:init');
            this.drawPlan();
        },

        earthFailure: function(){
            alert("Earth plugin failed to load.");
        },

        drawPlan: function(){
            if (this.planView){ alert("PlanView was previosly instantiated.  It's intended to be a singleton."); }
            this.planView = new PlanKmlView({ 
                collection: app.currentPlan.get('sequence'), 
                ge: this.ge,
            });
            this.planView.render();
            this.ge.getFeatures().appendChild(this.planView.doc);
            this.ge.gex.util.flyToObject( this.planView.doc );
        },

    });



    // This view class manages a KML Document object that represents an entire plan.
    // On instantiation, pass in the plan sequence Backbone collection as the "collection" arguement.
    var PlanKmlView = Backbone.View.extend({
        // KML boilerplate and styles live in templates/handlebars/plan-kml.handlebars
        template: Handlebars.compile($('#template-plan-kml').html()),
        geEvents: [], // container holds GE events for later removal

        initialize: function(){
            var ge = this.ge = this.options.ge;
            var doc = this.doc = ge.parseKml( this.template( {options: app.options} ) );
            this.stationsFolder = ge.gex.dom.buildFolder({ name: "stations" });
            this.stationDirectionsFolder = ge.gex.dom.buildFolder({ name: "station_directions" });
            this.segmentsFolder = ge.gex.dom.buildFolder({ name: "segments" });
            this.kmlFolders = [this.stationsFolder, this.segmentsFolder, this.stationDirectionsFolder];
            _.each( this.kmlFolders, function(folder){ doc.getFeatures().appendChild(folder); });

            // re-rendering the whole KML View on add proves to be pretty slow.
            //this.collection.on('add', this.render, this);
            app.vent.on('mapmode', this.setMode, this);
            app.vent.trigger('mapmode', 'navigate');

            this.collection.resequence();  // Sometimes it doesn't resequence itself on load
            this.collection.plan.kmlView = this; // This is here so we can reference it via global scope from inside GE Event handlers.  Grrrr....
        },

        clearKmlFolder: function(folder){
            var featureContainer = folder.getFeatures();
            while( featureContainer.hasChildNodes() ) { featureContainer.removeChild( featureContainer.getLastChild() ); }
        },

        render: function(){
            _.each( this.kmlFolders, this.clearKmlFolder);
            this.drawStations();
            this.drawSegments();
            if (this.currentMode) {
                this.resetMode();
            }
        },

        drawStation: function(station){
            var stationPointView = new StationPointView({ge: this.ge, model: station});          
            var stationFeatures = this.stationsFolder.getFeatures();
            stationFeatures.appendChild(stationPointView.placemark);
            this.drawStationDirection(station);
        },

        drawStationDirection: function(station) {
            var stationDirection = new StationDirectionView({ge: this.ge, model: station});          
            var directionFeatures = this.stationDirectionsFolder.getFeatures();
            directionFeatures.appendChild(stationDirection.placemark);
        },

        drawStations: function(){
            _.each( 
                this.collection.filter( function(model){ return model.get('type') == 'Station'; } ),
                this.drawStation,
                this // view context
            );
        },

        drawSegment: function(segment, fromStation, toStation){
            var segmentLineView = new SegmentLineView({
                model: segment,
                fromStation: fromStation,
                toStation: toStation,
                ge: this.ge
            });
            this.segmentsFolder.getFeatures().appendChild(segmentLineView.placemark);
        },

        drawSegments: function(){
            if ( this.segmentsFolder.getFeatures().hasChildNodes() ) {
                this.clearKmlFolder( this.segmentsFolder);
            }
            this.collection.each(function(item, index, list){
                if (item.get('type') == 'Segment') {
                    var fromStation = list[index-1];
                    var toStation = list[index+1];
                    this.drawSegment(item, fromStation, toStation);
                }
            }, this);
        },

        // Add an event handler and store a reference to it so we can clean up later.
        addGeEvent: function(target, eventID, listenerCallback, useCapture) {
            this.geEvents.push(arguments);
            google.earth.addEventListener(target, eventID, listenerCallback, useCapture);
        },

        // Remove event handlers that were added with this.addGeEvent()
        clearGeEvents: function() {
            while( this.geEvents.length > 0 ) {
                google.earth.removeEventListener.apply(google.earth, this.geEvents.pop() );
            }
        },

        setMode: function(modeName){
            console.log("Set mouse mode: " + modeName);
            var modeMap = {
                'addStations': 'addStationsMode',
                'navigate': 'navigateMode',
                'reposition': 'repositionMode',
            };

            if ( this.currentMode ) { this.currentMode.exit.call(this); }
            var mode = _.isObject(modeName) ? modeName : this[modeMap[modeName]];
            mode.enter.call(this);
            this.currentMode = mode;
        },

        // Clean up, then re-enter the mode.  Useful for re-draws/
        resetMode: function() {
            if ( this.currentMode) {
                var mode = this.currentMode;
                mode.exit.call(this);
                mode.enter.call(this);
            }
        },

        addStationsMode: {
            enter: function(){
                this.addGeEvent(this.ge.getGlobe(), 'click', this.clickAddStation);
            },
            exit: function(){
                this.clearGeEvents();
            },
        }, // end addStationMode

        navigateMode: {
            enter: function(){
                var stations = this.stationsFolder.getFeatures().getChildNodes();
                var l = stations.getLength();
                for ( var placemark,i=0; i<l; i++ ) {
                    placemark = stations.item(i);
                    this.addGeEvent( placemark, 'dblclick', function(evt){ evt.preventDefault(); });
                }
            },
            exit: function(){
                this.clearGeEvents();
            }
        },

        repositionMode: {
            enter: function(){
                var planview = this;
                var stations = this.stationsFolder.getFeatures().getChildNodes();
                var l = stations.getLength();
                var point;
                for ( var station,i=0; i<l; i++ ) {
                    station = stations.item(i);
                    //point = station.getGeometry().getGeometries().getFirstChild();
                    this.ge.gex.edit.makeDraggable(station, {
                        bounce: false,
                        dragCallback: function(){
                            this.view.model.trigger('dragUpdate', this);
                        },
                        dropCallback: function(){
                            // "this" is the placemark GE object.
                            var model = this.view.model;
                            var point = this.getGeometry();
                            model.setPoint(point.getLongitude(), point.getLatitude());
                            planview.render();
                        },
                    });

                    // Double-click to delete
                    var planKmlView = this;
                    this.addGeEvent( station, 'dblclick', function(evt){
                        evt.preventDefault();
                        var pm = evt.getTarget();
                        planKmlView.stationsFolder.getFeatures().removeChild(pm);
                        var view = pm.view;
                        var sequence = app.currentPlan.get('sequence');
                        sequence.removeStation(view.model);
                        planKmlView.render();
                    });
                }
                this.drawMidpoints();
            }, // end enter
            exit: function(){
                this.destroyMidpoints();
                var stations = this.stationsFolder.getFeatures().getChildNodes();
                var l = stations.getLength();
                for ( var station,i=0; i<l; i++ ) {
                    station = stations.item(i);
                    this.ge.gex.edit.endDraggable(station);
                }
            },
        }, // end repositionMode

        clickAddStation: function(evt){
            console.log("Add Station");
            var coords = [evt.getLongitude(), evt.getLatitude()];
            var station = app.models.stationFactory({ coordinates: coords });
            var segment = app.models.segmentFactory();
            app.currentPlan.get('sequence').appendStation(station);

            // Jump through some hoops to avoid a slow total re-render.  Not really thrilled with this solution.
            app.currentPlan.kmlView.drawStation(station);
            var seq = app.currentPlan.get('sequence');
            var l = seq.length;
            app.currentPlan.kmlView.drawSegment( seq.at(l-2), seq.at(l-3), seq.at(l-1) );
        },

        drawMidpoints: function(){
            if (! this.midpoitnsFolder) { this.midpointsFolder = this.ge.gex.dom.buildFolder({ name: "midpoints" }); }
            this.doc.getFeatures().appendChild(this.midpointsFolder);
            var fldrFeatures = this.midpointsFolder.getFeatures();

            this.collection.each(function(item, idx, list){
                var station1, station2;
                if ( item.get('type') == "Segment" ) {
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

        destroyMidpoints: function(){
            this.doc.getFeatures().removeChild( this.midpointsFolder );
            this.kmlFolders.pop();
            delete this.midpointsFolder;
        },
    });

    // This view class manages the map point for a single Station model
    var StationPointView = Backbone.View.extend({
        initialize: function(){
            var gex = this.options.ge.gex;
            var pmOptions = {};
            pmOptions.name = this.model.get('sequenceLabel') || this.model.toString();
            pmOptions.altitudeMode = app.options.plannerClampMode || this.options.ge.ALTITUDE_CLAMP_TO_GROUND;
            pmOptions.style = '#waypoint';
            var point =  this.model.get('geometry').coordinates;

            var pointGeom = gex.dom.buildPoint([ point[1], point[0] ]);
            //pointGeom.setAltitudeMode(pmOptions.altitudeMode);
            //delete pmOptions.altitudeMode;

            //pmOptions.point = [ point[1], point[0] ]; // Lon, Lat
            pmOptions.point = pointGeom;
            this.placemark = gex.dom.buildPlacemark(
                pmOptions
            );
            
            // Stop the balloon from popping on click.
            google.earth.addEventListener(this.placemark, 'click', function(evt){ evt.preventDefault() });

            this.placemark.view = this; // 2-way link for GE event handlers to use
            this.model.on('change', this.redraw, this);
        },

        redraw: function(){
            // redraw code. To be invoked when relevant model attributes change.
            var kmlPoint = this.placemark.getGeometry();

            var coords = this.model.get('geometry').coordinates;
            coords = [coords[1], coords[0]];
            kmlPoint.setLatLng.apply(kmlPoint, coords);
            this.placemark.setName( this.model.get('sequenceLabel') || this.model.toString() );
        },
    });

    var StationDirectionView = Backbone.View.extend({
        initialize: function(){
            var gex = this.options.ge.gex;
            var pmOptions = {};
            pmOptions.style = '#waypoint';
            var point =  this.model.get('geometry').coordinates;

            this.kmlModel = gex.dom.buildModel( 
                'http://{host}/static/xgds_planner2/models/rover.dae'.format({host: window.location.host}), 
                {
                    location: [ point[1], point[0] ], // Lon, Lat
                    scale: 2.0,
                    orientation: {heading: this.model.get('headingDegrees')},
                }
            )
            pmOptions.model = this.kmlModel;

            this.placemark = gex.dom.buildPlacemark(pmOptions);
            this.placemark.bbStationModel = this.model; //reference back to backbone model,  for event handlers
            this.model.on('change', this.redraw, this);
        },

        redraw: function(){
            var kmlModel = this.kmlModel;
            var coords = this.model.get('geometry').coordinates;
            var location = kmlModel.getLocation();
            location.setLatLngAlt(coords[1], coords[0], 0.0);
            var orientation = kmlModel.getOrientation();
            orientation.setHeading( this.model.get('headingDegrees') );
        },
    });

    var SegmentLineView = Backbone.View.extend({
        initialize: function(){
            var options = this.options;
            if ( ! options.ge && options.toStation && options.fromStation) { throw "Missing a required option!"; }
            this.ge = this.options.ge;
            this.gex = this.options.ge.gex;
            this.fromStation = this.options.fromStation;
            this.toStation = this.options.toStation;
            this.otherStation = {};
            this.otherStation[options.toStation.cid]= options.fromStation;
            this.otherStation[options.fromStation.cid]= options.toStation;
            _.each([this.fromStation, this.toStation], function(stationModel){
                stationModel.on('change:geometry', function(){ this.update(stationModel); }, this);
                stationModel.on('dragUpdate', function( placemark ) {
                    var geom = placemark.getGeometry();
                    var coords = [geom.getLatitude(), geom.getLongitude()];
                    this.update( this.otherStation[placemark.view.model.cid], coords );
                }, this);
            }, this);
            this.render();
        },

        render: function(){
            var coords = _.map( [this.fromStation, this.toStation], function(station){
                var geom = station.get('geometry').coordinates;
                return [geom[1], geom[0]]; // Lon, Lat
            });

            var linestring = this.gex.dom.buildLineString(coords, {tessellate: true});
            this.placemark = this.gex.dom.buildPlacemark({
                lineString: linestring,
                style: '#segment',
                altitudeMode: app.options.plannerClampMode || this.ge.ALTITUDE_CLAMP_TO_GROUND,
            });
            this.update.apply(this, coords );
        },

        /*
        ** Update the endpoints of the segment when either adjacent station changes.
        ** points can be either station PathElements, or an array of coordinates (lon, lat)
        ** You can also supply just one station PathElement
        */
        update: function(point1, point2){

            if ( _.isUndefined(point2) && point1.cid ) {
                // only one model was supplied for update.  Go get the other one.
                point2 = this.otherStation[point1.cid];
            }

            var coords = [];
            _.each([point1, point2], function(point) {
                if ( _.isArray(point) ) { 
                    coords.push(point);
                } else if ( _.isObject(point) && _.isFunction(point.get) ) {
                    var geom = point.get('geometry').coordinates;
                    coords.push( [geom[1], geom[0]] ); // Lon, Lat
                }
            });

            var linestring = this.gex.dom.buildLineString(coords, {tessellate: true});
            this.placemark.setGeometry(linestring); // ???
        },
    });

    /*
    ** Calculate the midpoint from an array of arrays of coordinates.
    */
    var calcMidpoint = function(coordsArr){
        var sums = _.reduce( coordsArr, function(memo, arr) {
                var result = [];
                _.each(arr, function(n, idx){
                    result.push(n + memo[idx]);
                });
                return result
            }, 
            _.map(coordsArr[0], function(){return 0;})
        );
        return _.map(sums, function(n){ return n / coordsArr.length });
    };

    var midpointPlacemark = function(options){        
        var points = [];
        _.each([options.station1,options.station2], function(station){
            var coords = station.get('geometry').coordinates;
            points.push([coords[1], coords[0]]);
        });
        var midpoint = calcMidpoint(points);
        var placemark = this.ge.gex.dom.buildPlacemark({
            point: midpoint,
            style: "#midpoint"
        });

        options.ge.gex.edit.makeDraggable(placemark, {
            bounce: false,
            dropCallback: function(){
                var view = options.view, index = options.index;
                var geom = this.getGeometry();
                var station = app.models.stationFactory({
                    coordinates: [geom.getLongitude(), geom.getLatitude()],
                });
                view.collection.insertStation( index, station );
                view.render(); //redraw
            },
        });

        return placemark;
    };

});
