var DEG2RAD = Math.PI / 180.0;

function transform(coords){
    return ol.proj.transform(coords, 'EPSG:4326',   'EPSG:3857');    
}

function inverse(coords){
    return ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');    
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
                        width: app.options.planLineWidthPixels
                      })
                    });
                app.styles['edit'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'orange',
                        width: app.options.planLineWidthPixels
                      }),
                    image: new ol.style.Circle({
                        radius: 8,
                        fill: new ol.style.Fill({
                          color: 'lightblue'
                        }),
                        stroke: new ol.style.Stroke({
                            color: 'orange',
                            width: 2
                          }),
                      })
                    });
                app.styles['selectedSegment'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'cyan',
                        width: app.options.planLineWidthPixels + 2
                      })
                    });
                app.styles['placemarkImage'] = new ol.style.Icon({
                    src: app.options.placemarkCircleUrl,
                    scale: .8,
                    rotateWithView: false,
                    opacity: 1.0
                    });
                app.styles['station'] = new ol.style.Style({
                    image: app.styles['placemarkImage']
                    });
                app.styles['selectedPlacemarkImage'] = new ol.style.Icon({
                    src: app.options.placemarkCircleHighlightedUrl,
                    scale: 1.2
                    });
                app.styles['selectedStation'] = new ol.style.Style({
                    image: app.styles['selectedPlacemarkImage']
                    });
                app.styles['direction'] = {
                        src: app.options.placemarkDirectionalUrl,
                        scale: 0.85,
                        rotation: 0.0,
                        rotateWithView: true
                        };
                app.styles['selectedDirection'] = {
                        src: app.options.placemarkSelectedDirectionalUrl,
                        scale: 1.2,
                        rotation: 0.0,
                        rotateWithView: true
                        };
                
                app.styles['stationText'] = {
                    font: '16px Calibri,sans-serif',
                    fill: new ol.style.Fill({
                        color: '#000'
                    }),
                    stroke: new ol.style.Stroke({
                        color: '#fff',
                        width: 2
                    }),
                    offsetY: -20
                };

            },

            render: function() {
                //           console.log('re-rendering map');
                this.drawPlan();
            },
            
            drawPlan: function() {
                if (this.planView) {
                    alert("PlanView was previously instantiated.  It's intended to be a singleton.");
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
                
                this.segmentsVector = new ol.source.Vector({});
                this.stationsVector = new ol.source.Vector({});

                // for editing
                this.featureOverlay = new ol.FeatureOverlay({
                    style: (function() {
                          return function(feature, resolution) {
                            return feature.getStyle();
                          };
                        })()
                });
                this.featureOverlay.setMap(this.map);
                
                app.vent.on('mapmode', this.setMode, this);
                app.vent.trigger('mapmode', 'navigate');
                
                this.collection.resequence(); // Sometimes it doesn't resequence itself on load
                this.listenTo(app.currentPlan, 'sync', this.render, this);

                app.State.planLoaded = true;
            },

            render: function() {
                this.drawStations();
                this.drawSegments();
                this.segmentsLayer = new ol.layer.Vector({'name':'segments',
                                                          'source': this.segmentsVector
                                                          });
//                this.map.addLayer(this.segmentsLayer);
                
                this.stationsLayer = new ol.layer.Vector({'name':'stations',
                                                          'source': this.stationsVector
                                                          });
//                this.map.addLayer(this.stationsLayer);
                
                //TODO this did not work
//                if (!_.isEmpty(this.segmentsVector.getFeatures())){
//                    this.map.getView().fitExtent(this.segmentsVector.getExtent(), this.map.getSize());
//                }

                if (this.currentMode) {
                    this.resetMode();
                }
            },

            drawStation: function(station) {
                var stationPointView = new StationPointView({
                    model: station,
                    stationsVector: this.stationsVector,
                    featureOverlay: this.featureOverlay
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

//                _.each(this.stationViews, function(stationView) {
//                    stationView.addPolygons();
//                });
            },

            drawSegment: function(segment, fromStation, toStation) {
                var segmentLineView = new SegmentLineView({
                    model: segment,
                    fromStation: fromStation,
                    toStation: toStation,
                    segmentsVector: this.segmentsVector,
                    featureOverlay: this.featureOverlay
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
                    app.State.disableAddStation = false; // reset state possibly set in other mode
                },
                exit: function() {
                    // nothing
                }
            }, // end addStationMode

            navigateMode: {
                enter: function() {
                    if (_.isUndefined(this.selectNavigate)){
                        this.selectNavigate = new ol.interaction.Select({
                            layers: [this.segmentsLayer, this.stationsLayer],
                            style: (function() {
                                  return function(feature, resolution) {
                                      var model = feature.get('model');
                                      switch (model.get('type')) {
                                      case 'Station':
                                          return [feature.get('selectedStyle'), feature.getStyle()[1]];
                                          break;
                                      case 'Segment':
                                          return [app.styles['selectedSegment']];
                                          break;
                                      }
                                  };
                                })()
                            });
                        
                        this.selectNavigate.getFeatures().on('add', function(e) {
                            var feature = e.element;
                            var model = feature.get('model');
                            switch (model.get('type')) {
                            case 'Station':
                                app.State.stationSelected = feature.get('model');
                                app.State.segmentSelected = undefined;
                                break;
                            case 'Segment':
                                app.State.segmentSelected = feature.get('model');
                                app.State.stationSelected = undefined;
                                break;
                            }
                            
                            app.State.metaExpanded = true;
                            app.State.addCommandsExpanded = false;
                            app.State.commandSelected = undefined;
                            if (app.currentTab != 'sequence') {
                                app.vent.trigger('setTabRequested','sequence');
                            } else {
                                app.tabs.currentView.tabContent.currentView.render();
                            }
                        });
                        this.listenTo(app.vent, 'showItem:station', function() {
                            var selectedItem = app.State.stationSelected;
                            this.mapSelect(selectedItem);
                        });
                        
                        this.listenTo(app.vent, 'showItem:segment', function() {
                            var selectedItem = app.State.stationSelected;
                            this.mapSelect(selectedItem);
                        });
                        
                    };
                    this.map.addInteraction(this.selectNavigate);
                    
                },
                exit: function() {
                    this.map.removeInteraction(this.selectNavigate);
                }
            },
            
            mapSelect: function(selectedItem){
                if (!_.isUndefined(selectedItem)){
                    var features = this.selectNavigate.getFeatures();
                    var foundFeature = selectedItem['feature'];
                    if (features.getLength() > 0){
                        if (features.item(0) == foundFeature) {
                            return;
                        }
                    }
                    features.clear();
                    features.push(foundFeature);
                }  
            },
            
            updateFeatureOverlayFeatures: function(fill) {
//                this.featureOverlay.getFeatures().clear();
//                if (fill){
//                    this.stationsVector.getFeatures().forEach(function(feature){
//                        this.addFeature(feature); 
//                     }, this.featureOverlay);
//                     this.segmentsVector.getFeatures().forEach(function(feature){
//                         this.addFeature(feature); 
//                     }, this.featureOverlay);
//                }
  
            },

            repositionMode: {
                enter: function() {
                    if (_.isUndefined(this.repositioner)){
                        this.repositioner = new ol.interaction.Modify({
                            features: this.featureOverlay.getFeatures(),
                            deleteCondition: function(event) {
                                return ol.events.condition.shiftKeyOnly(event) &&
                                       ol.events.condition.singleClick(event);
                            }
                        });
                    }
                    this.updateFeatureOverlayFeatures(true);

                    this.map.addInteraction(this.repositioner);
//                    for (var station, i = 0; i < l; i++) {
//                        station = stations.item(i);
//                        if (app.options.mapRotationHandles) {
//                            var handle = getGeCache(station).view
//                                .createDragRotateHandle();
//                        }
//                        this.processStation(station, handle);
//                    }

                }, // end enter
                exit: function() {
                    this.map.removeInteraction(this.repositioner);
                    this.updateFeatureOverlayFeatures(false);

//                    var l = stations.getLength();
//                    for (var station, i = 0; i < l; i++) {
//                        station = stations.item(i);
//                        window.ge_gex.edit.endDraggable(station);
//                        getGeCache(station).view.model.off('change:headingDegrees'); // kill drag handle update binding
//                    }


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
            }
        });
    
    var SegmentLineView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            var options = this.options;
            if (!options.featureOverlay && options.toStation && options.fromStation) {
                throw 'Missing a required option!';
            }
            this.segmentsVector = this.options.segmentsVector;
            this.featureOverlay = this.options.featureOverlay;
            this.fromStation = this.options.fromStation;
            this.toStation = this.options.toStation;
            this.otherStation = {};
            this.otherStation[options.toStation.cid] = options.fromStation;
            this.otherStation[options.fromStation.cid] = options.toStation;
            _.each([this.fromStation, this.toStation],
                    function(stationModel) {
                        stationModel.on('change:geometry',
                                        function() {this.updateGeometry(stationModel);}, 
                                        this);
                    }, this);
            this.render();
//            this.listenTo(this.model,
//                          'add:sequence delete:sequence change:sequence',
//                          function(evt, options) {
//                              this.updateStyle();
//                          }, this);
        },

        render: function() {
            //console.log('re-rendering segment');
            this.coords = _.map([this.fromStation, this.toStation],
                               function(station) {
                                   return transform(station.get('geometry').coordinates);
                               });

            this.geometry = new ol.geom.LineString([this.coords[0], this.coords[1]], 'XY');
            this.segmentFeature = new ol.Feature({'geometry': this.geometry,
                                                 'id': this.fromStation.attributes['id'],
                                                 'model': this.model,
                                                 'style': [app.styles['segment']]
                                                 });
            this.segmentFeature.setStyle([app.styles['segment']]);
            this.segmentFeature.on('change', function(event) {
                console.log(event);
//                app.Actions.disable();
//                var view = options.view, index = options.index;
//                // new stuff
//                var geometry = event.target.get('geometry');
//                // TODO have to get the point
//                var model = event.target.get('model');
//                var coords = inverse(geometry.flatCoordinates);
//                
//                var seq = app.currentPlan.get('sequence');
//                var oldSegment = seq.at(index);
//                var station = app.models.stationFactory({
//                    coordinates: [geom.getLongitude(), geom.getLatitude()]
//                });
//                view.collection.insertStation(index, station);
//                view.segmentsFolder.getFeatures().removeChild(
//                    oldSegment._geSegment.placemark);
//                var stationPointView = view.drawStation(station);
//                var handle = stationPointView.createDragRotateHandle();
//                view.processStation(stationPointView.placemark, handle);
            });
            this.model['feature'] = this.segmentFeature;
            this.segmentsVector.addFeature(this.segmentFeature);
            this.featureOverlay.addFeature(this.segmentFeature);
        },
        /*
         ** Update the endpoints of the segment when either adjacent station changes.
         ** points can be either station PathElements, or an array of coordinates (lon, lat)
         ** You can also supply just one station PathElement
         */
         updateGeometry: function(point1, point2) {

             if (_.isUndefined(point2) && !_.isUndefined(point1) && point1.cid) {
                 // only one model was supplied for update.  Go get the other one.
                 point2 = this.otherStation[point1.cid];
             }

             if (point1 && point2) {
                 var coords = [];
                 _.each([point1, point2], function(point) {
                     if (_.isArray(point)) {
                         coords.push(transform(point));
                     } else if (_.isObject(point) && _.has(point, 'lat') && _.has(point, 'lng')) {
                         coords.push(transform([point.lng, point.lat]));
                     } else if (_.isObject(point) && _.isFunction(point.get)) {
                         coords.push(transform(point.get('geometry').coordinates));
                     }
                 });
                 
                 this.geometry.setCoordinates(coords);
             }

         }
    });
    
 // This view class manages the map point for a single Station model
    var StationPointView = Backbone.View
        .extend({
            initialize: function(options) {
                this.options = options || {};
                this.stationsVector = this.options.stationsVector;
                this.featureOverlay = this.options.featureOverlay;
                
                if (!options.featureOverlay && !options.model) {
                    throw 'Missing a required option!';
                }

                var pmOptions = {};
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                pmOptions.name = name || this.model.toString();
                this.point = transform(this.model.get('geometry').coordinates); // lon, lat

                this.initIconStyle();
                this.initTextStyle();
                this.render();

//
//                // Keep from creating a new station when clicking on an existing one in
//                // add stations mode
//                google.earth.addEventListener(this.placemark, 'mousedown',
//                                              function(evt) {
//                                                  app.State.disableAddStation = true;
//                                              });

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
//                this.listenTo(app.vent, 'showItem:station', function() {
//                    this.redraw();
//                });
                // redraw when we've been unselected
//                this.listenTo(app.vent, 'tab:change', function() {
//                    this.redraw();
//                });
//                this.listenTo(app.vent, 'showItem:segment', function() {
//                    this.redraw();
//                });
            },
            
            render: function() {
                this.geometry = new ol.geom.Point(this.point);
                this.stationFeature = new ol.Feature({'geometry': this.geometry,
                                                       'id': this.model.attributes['id'],
                                                       'model': this.model,
                                                       'selectedStyle': this.selectedIconStyle,
                                                       'style': [this.iconStyle, this.textStyle]
                                                    });
                this.stationFeature.setStyle([this.iconStyle, this.textStyle]);
                this.stationFeature.on('change', function(event) {
                    var geometry = event.target.get('geometry');
                    var model = event.target.get('model');
                    var coords = inverse(geometry.flatCoordinates);
                    model.setPoint({
                        lng: coords[0],
                        lat: coords[1]
                    });
                });

                this.model['feature'] = this.stationFeature;
                this.stationsVector.addFeature(this.stationFeature);
                this.featureOverlay.addFeature(this.stationFeature);
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
                if (_.isUndefined(this.geometry)){
                    return;
                }
                // redraw code. To be invoked when relevant model attributes change.
                app.Actions.disable();

                var coords = transform(this.model.get('geometry').coordinates);
                var existingCoords = this.geometry.getCoordinates();
                if ((coords[0] != existingCoords[0]) || 
                    (coords[1] != existingCoords[1])) {
                    this.geometry.setCoordinates(coords);
                }
//                if (existingCoords[0] - coords[0] != 0 ||
//                    existingCoords[1] - coords[1] != 0)
//                    this.redrawHandles();
                var name = this.getLabel();
                var textInStyle = this.textStyle.getText();
                if (!_.isEqual(name, textInStyle.getText())){
                    //TODO this totally does not work.  sucky.  I think we have to make a new style.
                    // https://github.com/openlayers/ol3/pull/2678
//                    textInStyle.set('text',name);
                    this.stationFeature.setStyle([this.iconStyle, this.textStyle]);
                }
                this.updateHeadingStyle();

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

            getHeading: function() {
                var heading = 0.0;
                try {
                    heading = this.model.get('headingDegrees');
                } catch(err) {
                    // nothing
                }
                if (_.isUndefined(heading) || _.isNull(heading)){
                    heading = 0.0;
                }  
                return heading;
            },
            
            initIconStyle: function() {
                if (this.model.get('isDirectional')) {
                    heading = this.getHeading();
                    app.styles['direction']['rotation'] = heading;
                    app.styles['selectedDirection']['rotation'] = heading;
                    this.iconStyle = new ol.style.Style({image: new ol.style.Icon(app.styles['direction'])});
                    this.selectedIconStyle = new ol.style.Style({image: new ol.style.Icon(app.styles['selectedDirection'])});
                    app.styles['direction']['rotation'] = 0.0;
                    app.styles['selectedDirection']['rotation'] = 0.0;
                } else {
                    this.iconStyle = app.styles['station'];
                    this.selectedIconStyle = app.styles['selectedStation'];
                }
            },
            
            updateHeadingStyle: function() {
                if (this.model.get('isDirectional')) {
                    var heading = this.getHeading();
                    this.iconStyle.set('rotation', heading);
                    this.selectedIconStyle.set('rotation', heading);
                } 
            },
            
            getLabel: function() {
                var name = '' + this.model._sequenceLabel;
                if (!_.isUndefined(this.model.get('name'))) {
                    name += ' ' + this.model.get('name');
                }
                return name;
            },
            
            initTextStyle: function() {
                app.styles['stationText']['text'] = name || this.model.toString();
                var textStyle = new ol.style.Text(app.styles['stationText']);
                app.styles['stationText']['text'] = null;
                
                var name = this.getLabel();
                this.textStyle = new ol.style.Style({
                    text: textStyle
                });
            },

//            updateStyle: function(model) {
//                if (app.State.stationSelected === this.model) {
//                    if (this.model.get('isDirectional')) {
//                        this.iconStyle.scale = 1.5;
//                        this.iconStyle.src = app.styles['selectedDirection'].src;
//                        this.updateHeadingStyle();
//                    } else {
//                        this.iconStyle = app.styles['selectedStation'];
//                    }
//                } else {
//                    if (this.model.get('isDirectional')) {
//                        this.iconStyle.scale = 0.85;
//                        this.iconStyle.src = app.styles['direction'].src;
//                        this.updateHeadingStyle();
//                    } else {
//                        this.iconStyle = app.styles['station'];
//                    }
//                }
//                var result = [this.iconStyle, this.textStyle];
//                return result;
//            },


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

    
});
