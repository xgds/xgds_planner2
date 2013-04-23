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

    function vectorDiff(vec1, vec2){ var l = vec1.length; return _.map( _.range(l), function(i){ return vec1[i] - vec2[i]; }) };
    function vectorAdd(vec1, vec2){ var l = vec1.length; return _.map( _.range(l), function(i){ return vec1[i] + vec2[i]; }) };
    function vectorAbs(vec) { return Math.sqrt( _.reduce(vec, function(memo, num){ return memo + Math.pow(num, 2); }, 0) ); };


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
        return {x: mx,
                y: my};
    }

    function metersToLatLon(meters) {
        var lng = meters.x * 180 / ORIGIN_SHIFT;
        var lat = meters.y * 180 / ORIGIN_SHIFT;
        lat = ((Math.atan(Math.exp((lat * (Math.PI / 180)))) * 360) / Math.PI) - 90;
        return { lat: lat, lng: lng }
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

        var bearing = Math.atan2(Math.sin(lon2-lon1)*Math.cos(lat2), Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(lon2-lon1)) % (2*Math.PI);
        bearing = bearing * 180 / Math.PI; // radions --> degrees
        if ( bearing < 0.0 ) { bearing = bearing + 360.0 }
        return bearing;
    }

    function makeDraggable( placemark, options) {
        options = _.defaults(options, {
            startCallback: function(placemark, data){},
            dragCallback: function(placemark, data){},
            dropCallback: function(placemark, data){},
            getObjectPosition: function(placemark){ var geom = placemark.getGeometry(); return [ geom.getLatitude(), geom.getLongitude() ]; },
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
            cursorPos: undefined, // [lat, lon] of the current cursor while dragging
            //objectStartPos: undefined,
            //objectPos: undefined, // Whatever we determine to be the object's "location" ( i.e. the output of the getObjectPosition() callback )
            //dragOffset: undefined, // [lat, lon] offset between the curson position and object position         
        };

        function dragStart(evt) {
            evt.preventDefault();
            dragEngaged = true;
            //data.objectPos = data.objectStartPos = options.getObjectPosition(placemark);
            data.cursorStartPos = data.cursorPos = [evt.getLatitude(), evt.getLongitude()];
            google.earth.addEventListener( ge.getWindow(), 'mouseup', dragEnd)
            google.earth.addEventListener( ge.getWindow(), 'mousemove', dragMove)
            options.startCallback(placemark, data);
        };
        
        function dragMove(evt) {
            evt.preventDefault();
            data.cursorPos = [evt.getLatitude(), evt.getLongitude()];
            options.dragCallback( placemark, data);
        };

        function dragEnd(evt){
            evt.preventDefault();
            dragEngaged = false;
            //data.dragOffset = undefined;
            google.earth.removeEventListener( ge.getWindow(), 'mouseup', dragEnd)
            google.earth.removeEventListener( ge.getWindow(), 'mousemove', dragMove)
            options.dropCallback(placemark, data);
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
            this.dragHandlesFolder = ge.gex.dom.buildFolder({ name: "drag_handles" });
            this.segmentsFolder = ge.gex.dom.buildFolder({ name: "segments" });
            this.kmlFolders = [this.stationsFolder, this.segmentsFolder, this.dragHandlesFolder];
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

            //debug:
            station.on('change', function(station){
                console.log("geometry change: " + JSON.stringify(station.get('geometry').coordinates));
            });
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
                            model.setPoint({lng: point.getLongitude(), lat: point.getLatitude()});
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

                    var handle = station.view.createDragRotateHandle();
                    this.dragHandlesFolder.getFeatures().appendChild(handle);
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

                    station.view.model.off('change:headingDegrees'); // kill drag handle update binding
                }
                
                this.clearKmlFolder(this.dragHandlesFolder);

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
            pmOptions.style = this.buildStyle();
            var point =  this.model.get('geometry').coordinates; // lon, lat

            var pointGeom = gex.dom.buildPoint([ point[1], point[0] ]); // lat, lon

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

            var coords = this.model.get('geometry').coordinates; // lon, lat
            coords = [coords[1], coords[0]]; // lat, lon
            kmlPoint.setLatLng.apply(kmlPoint, coords);
            this.placemark.setName( this.model.get('sequenceLabel') || this.model.toString() );
            //this.placemark.setStyle( this.getStyle() );
            this.placemark.getStyleSelector().getIconStyle().setHeading( this.model.get('headingDegrees') );
            this.placemark.getStyleSelector().getIconStyle().getIcon().setHref( this.model.get('isDirectional') ?
                    'http://earth.google.com/images/kml-icons/track-directional/track-0.png' : 'http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png' );
        },

        buildStyle: function(){
            var gex = this.options.ge.gex;
            var ge = this.options.ge;

            var iconUrl = this.model.get('isDirectional') ? 
                'http://earth.google.com/images/kml-icons/track-directional/track-0.png' : 'http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png';
            var icon = ge.createIcon('');
            icon.setHref(iconUrl);
            var style = ge.createStyle('');
            style.getIconStyle().setIcon(icon);
            style.getIconStyle().setHeading( this.model.get('headingDegrees'));
            return style;
        },

        dragRotateHandleCoords: function(){
            
            //var radius = 14.0; // distance in meters in front of the waypoint location to place the rotational handle.  Should be made dynamic with zoom level
            var cameraAltitude = ge.getView().copyAsCamera(ge.ALTITUDE_RELATIVE_TO_GROUND).getAltitude();
            var radius = 0.25 * cameraAltitude; // distance in meters in front of the waypoint location to place the rotational handle. 

            var theta = this.model.get('headingDegrees') * Math.PI / 180.00; // radians
            var stationCoords = this.model.get('geometry').coordinates;
            var stationPosMeters = latLonToMeters( { lat: stationCoords[1], lng: stationCoords[0] } );
            var handlePosMeters = {
                x: stationPosMeters.x + radius * Math.sin(theta),
                y: stationPosMeters.y + radius * Math.cos(theta),
            };
            return metersToLatLon( handlePosMeters );
        },

        updateDragRotateHandlePm: function(){
            var gex = this.options.ge.gex;
            var newLatLng = this.dragRotateHandleCoords();

            var geom = this.dragHandlePm.getGeometry(); // a MultiGeometry
            var point = geom.getGeometries().getFirstChild();
            point.setLatLng( newLatLng.lat, newLatLng.lng );
            
            var stLoc = this.model.get('geometry').coordinates; // lon, lat
            stLoc = _.object(['lat','lng'], stLoc);

            var newLineString = gex.dom.buildLineString([[stLoc.lat, stLoc.lng], [newLatLng.lat, newLatLng.lng]]);
            var oldLineString = geom.getGeometries().getLastChild();
            geom.getGeometries().replaceChild(newLineString, oldLineString);
        },

        createDragRotateHandle: function(){
            var station = this.model;
            var gex = this.options.ge.gex;

            var coords = this.dragRotateHandleCoords();
            var stLoc = _.object(['lng', 'lat'], this.model.get('geometry').coordinates);
            var linestring = gex.dom.buildLineString(
                    [ [stLoc.lat, stLoc.lng], [coords.lat, coords.lng] ],
                    {tessellate: true}
            );

            this.dragHandlePm = gex.dom.buildPlacemark(
                {
                    point: new geo.Point([coords.lat, coords.lng]),
                    lineString: linestring,
                    style: '#direction', // circle with a target
                }
            );

            this.model.on( 'change:headingDegrees', this.updateDragRotateHandlePm, this );
            var station = this.model;

            makeDraggable( this.dragHandlePm, {
                //getPosition: function(placemark){ var loc = placemark.getGeometry().getLocation(); return [loc.getLatitude(), loc.getLongitude()]; },
                startCallback: function(placemark, data){
                    console.log('mousedown');
                    var coords = station.get('geometry').coordinates;
                    data.stationLoc = { lng: coords[0], lat: coords[1] };
                    data.startHeading = station.get('headingDegrees');
                } ,
                dragCallback: function(placemark, data){
                    var newHeading = getBearing( data.stationLoc, _.object(['lat','lng'], data.cursorPos) );
                    console.log(newHeading);
                    station.set({
                        headingDegrees: newHeading,
                        isDirectional: true 
                    });
                },
            });
            
            return this.dragHandlePm;
        },
    });

    var SegmentLineView = Backbone.View.extend({
        initialize: function(){
            console.log("segment init: "+ this.cid);
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
                    var coords = {lat: geom.getLatitude(), lng: geom.getLongitude()};
                    this.update( this.otherStation[placemark.view.model.cid], coords );
                }, this);
            }, this);
            this.render();
            this.listenTo( this.model, 'add:sequence delete:sequence change:sequence', function(evt, options){
                this.updateStyle();
            }, this );
        },

        render: function(){
            var coords = _.map( [this.fromStation, this.toStation], function(station){
                var geom = station.get('geometry').coordinates;
                return [geom[1], geom[0]]; // Lon, Lat
            });

            var linestring = this.gex.dom.buildLineString(coords, {tessellate: true});
            var style = this.model.get('sequence').isEmpty() ? '#segment' : '#segment_with_commands';
            this.placemark = this.gex.dom.buildPlacemark({
                lineString: linestring,
                style: style,
                altitudeMode: app.options.plannerClampMode || this.ge.ALTITUDE_CLAMP_TO_GROUND,
            });
            this.updateGeom.apply(this, coords );
        },

        /*
        ** Update the endpoints of the segment when either adjacent station changes.
        ** points can be either station PathElements, or an array of coordinates (lon, lat)
        ** You can also supply just one station PathElement
        */
        updateGeom: function(point1, point2){

            if ( _.isUndefined(point2) && ! _.isUndefined(point1) && point1.cid ) {
                // only one model was supplied for update.  Go get the other one.
                point2 = this.otherStation[point1.cid];
            }

            if ( point1 && point2 ) {
                var coords = [];
                _.each([point1, point2], function(point) {
                    if ( _.isArray(point) ) { 
                        coords.push(point);
                    } else if ( _.isObject(point) && _.has(point, 'lat') && _.has(point, 'lng') ) {
                        coords.push( [ point.lat, point.lng ] );
                    } else if ( _.isObject(point) && _.isFunction(point.get) ) {
                        var geom = point.get('geometry').coordinates;
                        coords.push( [geom[1], geom[0]] ); // Lon, Lat --> lat, lon
                    }
                });

                var linestring = this.gex.dom.buildLineString(coords, {tessellate: true});
                this.placemark.setGeometry(linestring); // ???
            }

        },

        updateStyle: function() {
            var style = this.model.get('sequence').isEmpty() ? '#segment' : '#segment_with_commands';
            this.placemark.setStyleUrl(style);
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
