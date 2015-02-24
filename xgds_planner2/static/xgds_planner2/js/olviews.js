var DEG2RAD = Math.PI / 180.0;

function transform(coords){
    return ol.proj.transform(coords, 'EPSG:4326',   'EPSG:3857')    
}

$(function() {
    app.views = app.views || {};

    app.views.OLView = Backbone.View.extend({
            el: 'div',

            initialize: function(options) {
                this.options = options || {};
                _.bindAll(this);
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
                this.map = new ol.Map({
                    target: 'map',
                    layers: [
                      new ol.layer.Tile({
//                          source: new ol.source.MapQuest({layer: 'sat'})
                          source: new ol.source.MapQuest({layer: 'osm'})
                      })
                    ],
                    view: new ol.View({
                        // we will center the view later
                        zoom: 6
                    })
                  });
                this.buildStyles();
                this.updateBbox();
                this.on('layers:loaded', this.render);
                app.vent.trigger('layers:loaded');
                this.drawPlan();
            },
            
            updateBbox: function() {
             // move to bounding box defined in plan
                var site = app.currentPlan.get('site');
                if (site != undefined)
                    var bbox = site.bbox;
                if (bbox != undefined) {
                    var extent = [bbox[1], bbox[0], bbox[3], bbox[2]];
                    extent = ol.extent.applyTransform(extent, ol.proj.getTransform("EPSG:4326", "EPSG:3857"));
                    this.map.getView().fitExtent(extent, this.map.getSize());
                }
            },
            
            buildStyles: function() {
                app.styles = new Object();
                
                app.styles['segment'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'yellow',
                        width: 2
                      })
                    });
            },

            render: function() {
                //           console.log('re-rendering map');
                this.drawPlan();
            },
            
            drawPlan: function() {
                if (this.planView) {
                    alert("PlanView was previosly instantiated.  It's intended to be a singleton.");
                }
                
                this.planView = new PlanLayerView({
                    collection: app.currentPlan.get('sequence'),
                    map: this.map
                });
                this.planView.render();
            }
        });
    
    // This view class manages the layers that represents an entire plan.
    // On instantiation, pass in the plan sequence Backbone collection as the "collection" arguement.
    var PlanLayerView = Backbone.View
        .extend({
            initialize: function(options) {
                this.options = options || {};
                this.map = this.options.map
                
                this.segmentsVector = new ol.source.Vector({
                   // create an empty vector 
                });
                
                this.collection.resequence(); // Sometimes it doesn't resequence itself on load
                this.collection.plan.kmlView = this; // This is here so we can reference it via global scope from inside GE Event handlers.  Grrrr....
                this.listenTo(app.currentPlan, 'sync', this.render, this);

                // set state so untilt can begin
                app.State.planKMLLoaded = true;
            },

            render: function() {
                //console.log('re-rending kml');
//                this.drawStations();
                this.drawSegments();
                var segmentsLayerVector = new ol.layer.Vector({'name':'segments',
                                                               'source': this.segmentsVector,
                                                               'style': app.styles['segment']})
                this.map.addLayer(segmentsLayerVector);
                
                //TODO this did not work
                if (!_.isEmpty(this.segmentsVector.getFeatures())){
                    this.map.getView().fitExtent(this.segmentsVector.getExtent(), this.map.getSize());
                }

                if (this.currentMode) {
                    this.resetMode();
                }
            },

            drawStation: function(station) {
//                console.log("making station point view " + station.id)
                var stationPointView = new StationPointView({
                    map: this.map,
                    model: station,
                    planKmlView: this
                });

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
                    map: this.map,
                    segmentsVector: this.segmentsVector

                });
            },

            drawSegments: function() {
                this.collection.each(function(item, index, list) {
                    if (item.get('type') == 'Segment') {
                        var fromStation = list[index - 1];
                        var toStation = list[index + 1];
                        this.drawSegment(item, fromStation, toStation);
                    }
                }, this);

            }
        });
    
    var SegmentLineView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            var options = this.options;
            if (!options.map && options.toStation && options.fromStation) {
                throw 'Missing a required option!';
            }
            this.map = this.options.map;
            this.segmentsVector = this.options.segmentsVector;
            this.fromStation = this.options.fromStation;
            this.toStation = this.options.toStation;
            this.otherStation = {};
            this.otherStation[options.toStation.cid] = options.fromStation;
            this.otherStation[options.fromStation.cid] = options.toStation;
            _.each([this.fromStation, this.toStation],
                    function(stationModel) {
                        stationModel.on('change:geometry',
                                        function() {this.updateGeom(stationModel);}, 
                                        this);
                        stationModel.on('dragUpdate',
                                function(placemark) {
                                    var geom = placemark.getGeometry();
                                    var coords = {
                                        lat: geom.getLatitude(),
                                        lng: geom.getLongitude()
                                    };
                                    this.update(this.otherStation[getGeCache(placemark.view).model.cid],
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
            this.coords = _.map([this.fromStation, this.toStation],
                               function(station) {
                                   return transform(station.get('geometry').coordinates);
                               });

            this.geometry = new ol.geom.LineString([this.coords[0], this.coords[1]], 'XY');
            var segmentFeature = new ol.Feature({'geometry': this.geometry,
                                                 'id': this.fromStation.attributes['id']});
            this.segmentsVector.addFeature(segmentFeature);
        }
    });

    
});
