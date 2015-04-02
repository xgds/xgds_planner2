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

function transform(coords){
    return ol.proj.transform(coords, 'EPSG:4326',   'EPSG:3857');    
}

function inverse(coords){
    return ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');    
}

var DEBUG_SEGMENTS = false;
var KML_PROJECTION = ol.proj.get('EPSG:3857');

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
                
                this.kmlGroup = new ol.layer.Group();
                
                this.map = new ol.Map({
                    target: 'map',
                    layers: [
                      new ol.layer.Tile({
//                          source: new ol.source.MapQuest({layer: 'sat'})
                          source: new ol.source.MapQuest({layer: 'osm'})
                      }),
                      this.kmlGroup
                    ],
                    view: new ol.View({
                        // we will center the view later
                        zoom: 6
                    })
                  });
                this.buildStyles();
                this.updateBbox();
                app.vent.on('layers:loaded', this.render);
                app.vent.on('layers:loaded', this.initializeMapLayers);
                app.vent.on('tree:loaded', this.updateMapLayers);
                app.vent.trigger('layers:loaded');
//                this.drawPlan();
            },
            
            // load map tree ahead of time to load layers into map
            initializeMapLayers: function() {
                $.ajax({
                    url: app.options.layerFeedUrl,
                    success: function(data) {
                        app.treeData = data; 
//                        this.updateMapLayers();
                    },
                    dataType: 'json'
                  });
//                $.get( app.options.layerFeedUrl, function(data) {
//                   app.treeData = data; 
//                }, this);
            },
            
            nodeVisitor: function(node){
                if (_.isUndefined(node.kmlLayerView) && node.selected){
                    // create the kml layer view
                    var kmlLayerView = new KmlLayerView({
                        node: node,
                        kmlGroup: this.kmlGroup
                    });
                    node.kmlLayerView = kmlLayerView;
                }
                if (node.selected){
                    node.kmlLayerView.render();
                }
                return true;
            },
            
            updateMapLayers: function() {
                if (!_.isUndefined(app.tree)){
                    var selectedNodes = app.tree.getSelectedNodes();
                    selectedNodes.forEach(function(node){
                        if (_.isUndefined(node.kmlLayerView) && node.selected){
                            // create the kml layer view
                            var kmlLayerView = new KmlLayerView({
                                node: node,
                                kmlGroup: this.kmlGroup
                            });
                            node.kmlLayerView = kmlLayerView;
                        }
                        if (node.selected){
                            node.kmlLayerView.render();
                        }
                        return true;
                    }, this);
//                    app.tree.visit(this.nodeVisitor(), true);
                }
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
//                    zIndex: Infinity
                    });
                app.styles['selectedPlacemarkImage'] = new ol.style.Icon({
                    src: app.options.placemarkCircleHighlightedUrl,
                    scale: 1.2
//                    zIndex: Infinity
                    });
                app.styles['selectedStation'] = new ol.style.Style({
                    image: app.styles['selectedPlacemarkImage']
//                    zIndex: Infinity
                    });
                app.styles['direction'] = {
                        src: app.options.placemarkDirectionalUrl,
                        scale: 0.85,
                        rotation: 0.0,
                        rotateWithView: true
//                        zIndex: Infinity
                        };
                app.styles['selectedDirection'] = {
                        src: app.options.placemarkSelectedDirectionalUrl,
                        scale: 1.2,
                        rotation: 0.0,
                        rotateWithView: true
//                        zIndex: Infinity
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
//                        zIndex: 10
                };
                app.styles['segmentText'] = {
                        font: '14px Calibri,sans-serif',
                        stroke: new ol.style.Stroke({
                            color: 'red',
                            width: 1
                        })
//                        zIndex: 10
                    };

            },

            render: function() {
                //           console.log('re-rendering map');
                this.updateMapLayers();
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
                
                this.stationsLayer = new ol.layer.Vector({'name':'stations',
                                                          'source': this.stationsVector
                                                          });
                
                if (this.currentMode) {
                    this.resetMode();
                }
                
                // scale map to focus on plan
                if (!_.isEmpty(this.segmentsVector.getFeatures())){
                    this.map.getView().fitExtent(this.segmentsVector.getExtent(), this.map.getSize());
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
                    featureOverlay: this.featureOverlay,
                    planLayerView: this
                });
                return segmentLineView;
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

            getLastStationCoords: function() {
                var endStation = this.collection.at(this.collection.length - 1);
                if (!_.isUndefined(endStation)) {
                    return transform(endStation.get('geometry').coordinates);
                }
                return undefined;
            },
            
            addStationsMode: {
                enter: function() {
                    app.State.disableAddStation = false; // reset state possibly set in other mode
                    if (_.isUndefined(this.stationAdder)){
//                        this.stationAdder = new ol.interaction.StationRubberband({
                        this.stationAdder = new ol.interaction.Draw({
                            features: this.featureOverlay.getFeatures(),
                            type: ol.interaction.DrawMode.POINT
//                            startCoordinates: this.getLastStationCoords()
                        }, this);
//                        this.stationAdder.on('drawstart', function(event) {
//                                console.log(event);
//                                endStation = this.collection.at(this.collection.length - 1);
//                                firstCoords = transform(endStation.get('geometry').coordinates);
//                                var newGeometry = event.feature.getGeometry();
//                                firstCoords.push(newGeometry.getCoordinates());
//                                newGeometry.setCoordinates(firstCoords);
//                            }, this);
                        this.stationAdder.on('drawend', function(event) {
                            var geometry = event.feature.getGeometry();
                            var coords = inverse(geometry.getCoordinates());
                            var station = app.models.stationFactory({
                                coordinates: coords
                            });
                            var sequence = app.currentPlan.get('sequence');
                            var newSegment = sequence.appendStation(station); // returns a segment if one was created

                            var stationPointView = this.drawStation(station);
                            this.stationViews.push(stationPointView);

                            if (!_.isUndefined(newSegment)) {
                                var segIndex = sequence.indexOf(newSegment);
                                this.drawSegment(newSegment, sequence.at(segIndex - 1), station);
                            }

                            // set time and location for added station
                            app.State.addStationLocation = coords;
                            app.State.addStationTime = Date.now();
                        }, this);
                    }
                    this.map.addInteraction(this.stationAdder);
                },
                exit: function() {
                    this.map.removeInteraction(this.stationAdder);
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
                                      console.log('style method ');
                                      console.log(model.get('type'));
                                      switch (model.get('type')) {
                                      case 'Station':
                                          var iconStyle = feature.get('selectedIconStyle');
                                          var textStyle = feature.get('textStyle');
                                          return [iconStyle, textStyle];
                                      case 'Segment':
                                          return [app.styles['selectedSegment']];
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
                    var snav = this.selectNavigate;
                    var features = this.selectNavigate.getFeatures();
                    var foundFeature = selectedItem['feature'];
                    if (features.getLength() > 0){
                        if (features.item(0) == foundFeature) {
                            return;
                        }
                        features.forEach(function(item, index, array){
                            var model = item.get('model');
                            switch (model.get('type')) {
                            case 'Station':
                                var iconStyle = item.get('iconStyle');
                                var textStyle = item.getStyle()[1];
                                item.setStyle([iconStyle, textStyle]);
                                break;
                            case 'Segment':
                                item.setStyle([app.styles['segment']]);
                                break;
                            }
                        });
                        features.clear();
                    }
                    
                    features.push(foundFeature);
                    switch (foundFeature.get('model').get('type')) {
                    case 'Station':
                        var iconStyle = foundFeature.get('selectedIconStyle');
                        var textStyle = foundFeature.get('textStyle');
                        foundFeature.setStyle([iconStyle, textStyle]);
                        break;
                    case 'Segment':
                        foundFeature.setStyle([app.styles['selectedSegment']]);
                        break;
                    }
                }  
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
                        this.stationDeleter = new ol.interaction.Select({
                            layers: [this.stationsLayer],
                            // for debugging
                            style: new ol.style.Style({
                                image: new ol.style.Circle({
                                  radius: 12,
                                  fill: new ol.style.Fill({
                                    color: 'rgba(255, 0, 0, 0.5)'
                                  })
                                })
                              }),
                            addCondition: function(event) {
                                return ol.events.condition.shiftKeyOnly(event)
                                && ol.events.condition.singleClick(event);
                              }
                            });
                        
                        this.stationDeleter.getFeatures().on('add', function(e) {
                            var feature = e.element;
                            var model = feature.get('model');
                            if (!_.isUndefined(model)){
                                // delete the station
                                var killedSegment = this.collection.removeStation(model);
                            }
                            
                        }, this);
                        this.listenTo(app.vent, 'station:remove', function(killedStation) {
                            if (!_.isUndefined(killedStation)){
                                var feature = killedStation.feature;
                                if (!_.isUndefined(feature)){
                                    this.stationDeleter.getFeatures().clear();
                                }
                            }
                        }, this);
                    }
                    this.map.addInteraction(this.repositioner);
                    this.map.addInteraction(this.stationDeleter);
                }, // end enter
                exit: function() {
                    this.map.removeInteraction(this.repositioner);
                    this.map.removeInteraction(this.stationDeleter);
                }
            } // end repositionMode

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
            this.planLayerView = this.options.planLayerView;
            this.fromStation = this.options.fromStation;
            this.toStation = this.options.toStation;
            this.otherStation = {};
            this.otherStation[this.toStation.cid] = this.fromStation;
            this.otherStation[this.fromStation.cid] = this.toStation;
            _.each([this.fromStation, this.toStation],
                    function(stationModel) {
                        this.addChangeListener(stationModel);
                    }, this);
//            this.model.on('change:geometry', function() {
//                this.updateGeometry(this.fromStation, this.toStation);
//            }, this);
            this.model.on('alter:stations', function() {
                this.updateStations();
                this.updateGeometry(this.fromStation, this.toStation);
            }, this);
            this.model.on('segment:remove', function() {
                var feature = this.feature;
                if (!_.isUndefined(feature)){
                    this.removeChangeListener(this.fromStation);
                    this.removeChangeListener(this.toStation);
                    this.segmentsVector.removeFeature(feature);
                    this.featureOverlay.removeFeature(feature);
                }
            }, this);
            this.render();
        },
        
        updateStations: function() {
            // make sure we have the correct from and to stations.
            var segmentIndex = this.planLayerView.collection.indexOf(this.model);
            if (segmentIndex < 1){
                return;
            }
            var newFromStation = this.planLayerView.collection.at(segmentIndex - 1);
            var newToStation = this.planLayerView.collection.at(segmentIndex + 1);
            var changed = false;
            
            if (newFromStation != this.fromStation){
                this.removeChangeListener(this.fromStation);
                this.fromStation = newFromStation;
                this.addChangeListener(this.fromStation);
                changed = true;
            }
            
            if (newToStation != this.toStation){
                this.removeChangeListener(this.toStation);
                this.toStation = newToStation;
                this.addChangeListener(this.toStation);
                changed = true;
            }
            if (changed){
                this.otherStation[this.toStation.cid] = this.fromStation;
                this.otherStation[this.fromStation.cid] = this.toStation;
                // for debugging
                if (DEBUG_SEGMENTS){
                    if (!_.isEqual(this.getLabel(), this.textStyle.getText().getText())){
                        delete this.textStyle; // for garbage collection
                        this.feature.setStyle(this.getStyles());
                    }
                }
            }
        },
        
        removeChangeListener: function(station){
          station.off('change:geometry');  
        },
        addChangeListener: function(station) {
            station.on('change:geometry',
                    function() {
                        this.updateGeometry(station);
                    }, 
                    this);
        },

        getStyles: function() {
            if (DEBUG_SEGMENTS){
                this.initTextStyle();
                return [app.styles['segment'], this.textStyle]
            } else {
                return [app.styles['segment']];
            }
            
        },
        render: function() {
            this.coords = _.map([this.fromStation, this.toStation],
                               function(station) {
                                   return transform(station.get('geometry').coordinates);
                               });

            this.geometry = new ol.geom.LineString([this.coords[0], this.coords[1]], 'XY');
            this.feature = new ol.Feature({'geometry': this.geometry,
                                                 'id': this.fromStation.attributes['id'],
                                                 'model': this.model
                                                 });
            // for some reason you have to set the style this way
            this.feature.setStyle(this.getStyles());
            this.geometry.on('change', function(event) {
                var geometry = event.target;
                var newCoordinates = geometry.getCoordinates();
                if (newCoordinates.length > 2) {
                    // add the new station!
                    var oldSegment = this.model; //event.target.get('model');
                    var oldFirstStation = this.fromStation;
                    var newStation = app.models.stationFactory({
                        coordinates: inverse(newCoordinates[1])
                    });
                    var segmentBefore = this.planLayerView.collection.insertStation(oldSegment, newStation);
                    var stationPointView = this.planLayerView.drawStation(newStation);
                    this.planLayerView.stationViews.push(stationPointView);
                    
                    if (!_.isUndefined(segmentBefore)){
                        this.planLayerView.drawSegment(segmentBefore, oldFirstStation, newStation);
                    }
                    
                    //total hack, remove and readd this segment to the feature
                    // this will prevent continuing to edit the second point of the segment (ie the one we just added)
                    try {
                        this.featureOverlay.removeFeature(this.feature);
                    } catch (err){
                        // ulp
                    }
                    this.featureOverlay.addFeature(this.feature);
                    
                }
                
            }, this);
            this.model['feature'] = this.feature;
            this.segmentsVector.addFeature(this.feature);
            this.featureOverlay.addFeature(this.feature);
        },
        /*
         ** Update the endpoints of the segment when either adjacent station changes.
         ** points can be either station PathElements, or an array of coordinates (lon, lat)
         ** You can also supply just one station PathElement
         */
         updateGeometry: function(point1, point2) {
             if (!_.isUndefined(this.fromStation) && !_.isUndefined(this.toStation)){
                 this.coords = _.map([this.fromStation, this.toStation],
                         function(station) {
                             return transform(station.get('geometry').coordinates);
                         });
                 this.geometry.setCoordinates(this.coords);
             }

//             if (_.isUndefined(point2) && !_.isUndefined(point1) && point1.cid) {
//                 // only one model was supplied for update.  Go get the other one.
//                 point2 = this.otherStation[point1.cid];
//             }
//
//             if (point1 && point2) {
//                 var coords = [];
//                 _.each([point1, point2], function(point) {
//                     if (_.isArray(point)) {
//                         coords.push(transform(point));
//                     } else if (_.isObject(point) && _.has(point, 'lat') && _.has(point, 'lng')) {
//                         coords.push(transform([point.lng, point.lat]));
//                     } else if (_.isObject(point) && _.isFunction(point.get)) {
//                         coords.push(transform(point.get('geometry').coordinates));
//                     }
//                 });
//                 
//                 this.geometry.setCoordinates(coords);
//             }

         },
         
         // for debugging put a label on the segment
         getLabel: function() {
             var sequence = app.currentPlan.get('sequence');
             var segIndex = sequence.indexOf(this.model);
             var name = '' + segIndex + '(' + sequence.indexOf(this.fromStation) + ',' + sequence.indexOf(this.toStation) + ')';
             return name;
         },
         
         initTextStyle: function() {
             if (DEBUG_SEGMENTS){
                 var name = this.getLabel();
                 app.styles['segmentText']['text'] = name;
                 this.textStyle = new ol.style.Style({
                     text: new ol.style.Text(app.styles['segmentText'])
                 });
                 app.styles['segmentText']['text'] = null;
             }
         }
    });
    
    var KmlLayerView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            this.kmlGroup = this.options.kmlGroup;
            this.node = this.options.node;
            
            if (!options.kmlGroup && !options.node) {
                throw 'Missing a required option!';
            }
            this.constructVector();
            this.render();
        },
        constructVector: function() {
            if (_.isUndefined(this.kmlVector)){
                var kmlfile = this.node.data.kmlFile;
                this.kmlVector = new ol.layer.Vector({
                    source: new ol.source.KML({
                        projection: KML_PROJECTION,
                        url: this.node.data.kmlFile
                    })
                });
            }
        },
        render: function() {
            if (this.node.selected){
                this.constructVector();
                this.kmlGroup.getLayers().push(this.kmlVector);
            } else if (!_.isUndefined(this.kmlVector)){
                this.kmlGroup.getLayers().remove(this.kmlVector);
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

                this.listenTo(this.model, 'change', this.redraw);
                this.listenTo(this.model, 'add:sequence remove:sequence',
                              function(command, collection, event) {
                                  if (command.hasParam('showWedge')) {
                                      this.redrawPolygons();
                                  } else if (command.get('type').indexOf('Pattern') > 0) {
                                      this.redrawPolygons();
                                  }
                              });
                this.model.on('station:remove', function() {
                    this.stationsVector.removeFeature(this.feature);
                    this.featureOverlay.removeFeature(this.feature);
                }, this);

            },
            
            render: function() {
                this.geometry = new ol.geom.Point(this.point);
                this.feature = new ol.Feature({'geometry': this.geometry,
                                               'id': this.model.attributes['id'],
                                               'model': this.model,
                                               'iconStyle': this.iconStyle,
                                               'selectedIconStyle': this.selectedIconStyle,
                                               'textStyle': this.textStyle
                                            });
                this.feature.setStyle([this.iconStyle, this.textStyle]);
                this.feature.on('remove', function(event) {
                    console.log(this);
                }, this);
                this.feature.on('change', function(event) {
                    var geometry = event.target.get('geometry');
                    var model = event.target.get('model');
                    var coords = inverse(geometry.flatCoordinates);
                    model.setPoint({
                        lng: coords[0],
                        lat: coords[1]
                    });
                });

                this.model['feature'] = this.feature;
                this.stationsVector.addFeature(this.feature);
                this.featureOverlay.addFeature(this.feature);
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
                if (!_.isEqual(this.getLabel(), this.textStyle.getText().getText())){
                    // You can't change text of an existing style, you have to make a new one.
                    // https://github.com/openlayers/ol3/pull/2678
//                    textInStyle.set('text',name);
                    delete this.textStyle; // for garbage collection
                    this.initTextStyle();
                    this.feature.setStyle([this.iconStyle, this.textStyle]);
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
                var name = this.getLabel();
                
                app.styles['stationText']['text'] = name;
                this.textStyle = new ol.style.Style({
                    text: new ol.style.Text(app.styles['stationText'])
                });
                app.styles['stationText']['text'] = null;
            },

            close: function() {
                this.stopListening();
            }

        });
    
});
