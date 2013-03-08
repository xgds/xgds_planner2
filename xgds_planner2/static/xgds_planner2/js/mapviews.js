$(function(){
    app.views = app.views || {};

    function parseAltitudeMode(ge, modeString) {
        // Return an AltitudeMode object corresponding to the given string.
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

    app.views.EarthView = Backbone.View.extend({
        el: 'div',

        events:{
            //'earth:loaded': 'render',
            //'earth:init': 'drawPlan',
        },

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
            if (this.planView){ alert("PlanView was previosly rendered."); }
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
            this.segmentsFolder = ge.gex.dom.buildFolder({ name: "segments" });
            this.kmlFolders = [this.stationsFolder, this.segmentsFolder];
            _.each( this.kmlFolders, function(folder){ doc.getFeatures().appendChild(folder); });

            // re-rendering the whole KML View on add proves to be pretty slow.
            //this.collection.on('add', this.render, this);
            app.vent.on('mapmode', this.setMode, this);
            app.vent.trigger('mapmode', 'navigate');

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
        },

        drawStation: function(station){
            var stationPointView = new StationPointView({ge: this.ge, model: station});          
            this.stationsFolder.getFeatures().appendChild(stationPointView.placemark);
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

        addGeEvent: function(target, eventID, listenerCallback, useCapture) {
            this.geEvents.push(arguments);
            google.earth.addEventListener(target, eventID, listenerCallback, useCapture);
        },

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

            this.clearGeEvents();
            this[modeMap[modeName]]();
        },

        addStationsMode: function(){
            var events = [];
            events.push([this.ge.getGlobe(), 'click', this.clickAddStation]);
            _.each(events, function(args){ this.addGeEvent.apply(this, args); }, this);
        },

        navigateMode: function(){},

        repositionMode: function(){
            var stations = this.stationsFolder.getFeatures().getChildNodes();
            var l = stations.getLength();
            for ( var station,i=0; i<l; i++ ) {
                station = stations.item(i);
                this.ge.gex.edit.makeDraggable(station, {
                    dropCallback: function(){
                        // "this" is the placemark GE object.
                        var model = this.view.model;
                        var point = this.getGeometry();
                        model.setPoint(point.getLongitude(), point.getLatitude());
                        setTimeout(_.bind(app.currentPlan.kmlView.drawSegments, app.currentPlan.kmlView), 200);
                    },
                });
            }
        },

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
    });

    // This view class manages the map point for a single Station model
    var StationPointView = Backbone.View.extend({
        initialize: function(){
            var gex = this.options.ge.gex;
            var pmOptions = {};
            pmOptions.name = this.model.toString();
            pmOptions.altitudeMode = app.options.plannerClampMode || this.options.ge.ALTITUDE_CLAMP_TO_GROUND;
            pmOptions.style = '#waypoint';
            var point =  this.model.get('geometry').coordinates;
            pmOptions.point = [ point[1], point[0] ]; // Lon, Lat
            this.placemark = gex.dom.buildPlacemark(
                pmOptions
            );
            this.placemark.view = this; // 2-way link for GE event handlers to use
            this.model.on('change', this.redraw, this);
        },

        redraw: function(){
            // redraw code. To be invoked when relevant model attributes change.
            var kmlPoint = this.placemark.getGeometry();
            var coords = this.model.get('geometry').coordinates;
            coords = [coords[1], coords[0]];
            kmlPoint.setLatLng.apply(kmlPoint, coords);
            this.placemark.setName( this.model.toString() );
        },
    });

    var SegmentLineView = Backbone.View.extend({
        initialize: function(){
            var options = this.options;
            if ( ! options.ge && options.toStation && options.fromStation) { throw "Missing a required option!" }
            this.ge = this.options.ge;
            this.gex = this.options.ge.gex;
            this.fromStation = this.options.fromStation;
            this.toStation = this.options.toStation;
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
        },

        redraw: function(){
            // STUB: Update the endpoints of the segment when either adjacent station changes.
        },
    });


});
