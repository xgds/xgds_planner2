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
            'earth:loaded': 'render',
            'earth:init': 'drawPlan',
        },

        initialize: function(){
            var view = this;
            if ( ! app.options.offline ) {
                view.on('earth:loaded', view.render);
                google.load('earth', '1', {
                    callback: function(){view.trigger('earth:loaded');}
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
            ge.getWindow().setVisibility(true);
            app.vent.trigger("earth:init");

            // Configure the Earth instance
            ge.getNavigationControl().setVisibility(ge.VISIBILITY_AUTO);
            ge.getLayerRoot().enableLayerById(ge.LAYER_BORDERS, true);
            ge.getLayerRoot().enableLayerById(ge.LAYER_ROADS, true);
            ge.getOptions().setScaleLegendVisibility(true);
            ge.getOptions().setUnitsFeetMiles(false);
            ge.getOptions().setFlyToSpeed(ge.SPEED_TELEPORT);
            
            ge.gex = new GEarthExtensions(ge);

            app.options.XGDS_PLANNER_CLAMP_MODE_JS =
                parseAltitudeMode(this.ge, app.options.XGDS_PLANNER2_CLAMP_MODE_KML || 'relativeToSeaFloor');
            
            app.vent.trigger('earth:init');
            this.trigger('earth:init');
        },

        earthFailure: function(){
            alert("Earth plugin failed to load.");
        },

        renderPlan: function(){
            // KML boilerplate and styles live in templates/handlebars/plan-kml.handlebars
            var doc = ge.parseKml( Handlebars.compile($('#template-plan-kml').html())({options: app.options}) );

            if ( this.planKmlObject ) { this.ge.getFeatures().removeChild(this.planKmlObject); }
            this.planKmlObject = this.ge.getFeatures.appendChild( doc );

        },

    });



    // This view class manages a KML Document object that reprents an entire plan.
    var PlanKmlView = Backbone.View.extend({
        // KML boilerplate and styles live in templates/handlebars/plan-kml.handlebars
        template: Handlebars.compile($('#template-plan-kml').html()),
        initialize: function(){
            this.ge = this.options.ge;
            this.doc = this.ge.parseKml( this.temlpate( {options: app.options} ) );
        },
        render: function(){
            _.each( 
                _.filter( this.collection, function(model){ return model.get('type') == 'Station'; } ),
                function(station){
                    var stationPointView = new StationPointView({ge: this.ge, model: station});          
                    this.doc.getFeatures().appendChild(stationPointView.placemark);
                },
                this // view context
            );

        },
    });

    // This view class manages the map point for a single Station model
    var StationPointView = Backbone.View.extend({
        initialize: function(){
            var gex = this.options.ge.gex;
            this.placemark = gex.dom.buildPointPlacemark(
                this.model.get('geometry').coordinates, // [lat, lon]

                {
                    name: this.model.toString(),
                    altitudeMode: app.options.plannerClampMode || 'clampToGround',
                    style: '#waypoint',
                }
            );
        },

        render: function(){
            // redraw code. To be invoked when relevant model attributes change.
            var kmlPoint = this.placemark.getGeometry();
            kmlPoint.setLatLng.apply(kmlPoint, this.model.get('geometry').coordinates);
        },
    });


});
